import { onUnmounted, ref } from 'vue';
import {
    bindLiveDevice, claimLiveGame, createLiveGame, finishLiveGame, getLiveGame, joinLiveGame, kickLiveDevice, leaveLiveGame, releaseLiveGame, syncLiveGame,
    type LiveBinding, type LiveGame, type LiveProgress,
} from './knechtLive';
import type { LiveDevice, LiveDeviceBinding } from './liveDevices';

// Synchronisiert ein laufendes Knecht-Spiel mit dem Server (Live-Ticker, mehrere Handys).
//
// - Jede lokale Aenderung wird kurz danach hochgeladen, mit der zuletzt bekannten Version (baseVersion).
// - Alle 1,5 s wird der Serverstand abgefragt; hat ein anderes Handy etwas eingetragen, wird es uebernommen.
// - Haben zwei Handys gleichzeitig eingetragen (Konflikt), werden die eigenen neuen Wuerfe hinter die des anderen
//   gehaengt (z.B. 2 gegen 2, beide Spieler werfen gleichzeitig). Passt das nicht zu den Regeln, gilt der Stand,
//   der zuerst beim Server war, und dieses Handy bekommt einen Hinweis.
// - Jedes Handy traegt fuer einen Spieler oder ein Tischende ein (siehe liveDevices.ts). Jedes Handy kann eintragen,
//   abbrechen und andere Handys trennen; eingetragen wird nur von einem Handy gleichzeitig (claim).

const POLL_MS = 1500;
const PUSH_DELAY_MS = 250;

export type LiveStatus = 'off' | 'connecting' | 'live' | 'offline';

type Options = {
    getProgress: () => LiveProgress | null;
    // Serverstand ins laufende Spiel uebernehmen; false = passt nicht (Regeln)
    applyRemote: (progress: LiveProgress) => boolean;
    // Ein anderes Handy hat das Spiel eingetragen oder abgebrochen
    onEnded: (status: 'done' | 'aborted', game: LiveGame) => void;
    onBindingChange: (binding: LiveBinding | null) => void;
    onNotice: (message: string) => void;
    // Dieses Handy wurde von einem anderen getrennt
    onKicked: () => void;
};

const readyOf = (progress: LiveProgress) => progress.paused ? [...(progress.pauseReady ?? [])].sort() : [];
const keyOf = (progress: LiveProgress) => JSON.stringify([progress.startTeamIndex, progress.startedAt, progress.actions, progress.match?.cupColors ?? null, !!progress.paused, progress.paused ? progress.pausedBy ?? null : null, readyOf(progress)]);
const progressOf = (game: LiveGame): LiveProgress => ({ startTeamIndex: game.startTeamIndex, startedAt: game.startedAt, actions: game.actions, match: game.match, paused: !!game.paused, pausedBy: game.pausedBy ?? null, pauseReady: game.pauseReady ?? [] });
const isPrefix = (prefix: unknown[], list: unknown[]) =>
    prefix.length <= list.length && prefix.every((entry, index) => JSON.stringify(entry) === JSON.stringify(list[index]));
const sameColors = (a?: Match, b?: Match) => JSON.stringify(a?.cupColors ?? null) === JSON.stringify(b?.cupColors ?? null);

export const deviceName = (device: LiveDevice | undefined | null) => device?.name || 'Ein Handy';

export const useKnechtLiveSync = (options: Options) => {
    const binding = ref<LiveBinding | null>(null);
    const status = ref<LiveStatus>('off');
    const devices = ref<LiveDevice[]>([]);
    const savingBy = ref<string | null>(null);     // Handy, das gerade eintraegt

    let synced: LiveProgress | null = null;     // Stand, den der Server zuletzt bestaetigt hat
    let pushing = false;
    let pushAgain = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let resyncPending = false;                  // nach dem Neuladen: erst den Serverstand pruefen

    const setBinding = (value: LiveBinding | null) => {
        binding.value = value;
        options.onBindingChange(value);
    };

    const isMember = (game: LiveGame) => !binding.value || game.devices.some(device => device.id === binding.value!.deviceId);

    // Wer ist dazugekommen, wer ist weg? (nur Hinweise, die Bindungen kommen vom Server)
    const announce = (before: LiveDevice[], after: LiveDevice[]) => {
        if (!before.length) return;
        const myId = binding.value?.deviceId;
        const joined = after.filter(device => device.id !== myId && !before.some(entry => entry.id === device.id));
        const left = before.filter(device => device.id !== myId && !after.some(entry => entry.id === device.id));
        joined.forEach(device => options.onNotice(`${deviceName(device)} ist dazugekommen`));
        left.forEach(device => options.onNotice(`${deviceName(device)} ist nicht mehr verbunden`));
    };

    const adopt = (game: LiveGame) => {
        synced = progressOf(game);
        announce(devices.value, game.devices);
        devices.value = game.devices;
        savingBy.value = game.status === 'saving' ? game.savingBy : null;
        if (!binding.value) return;
        const me = game.devices.find(device => device.id === binding.value!.deviceId);
        setBinding({ ...binding.value, version: game.version, team: me?.team ?? binding.value.team, player: me?.player ?? null });
    };

    // Konflikt: eigene neue Wuerfe hinter die des anderen Handys haengen, sonst gilt der Serverstand
    const resolveConflict = (server: LiveGame) => {
        const local = options.getProgress();
        const base = synced;
        adopt(server);
        const remote = progressOf(server);
        if (local && base && local.startTeamIndex === server.startTeamIndex && isPrefix(base.actions, local.actions) && isPrefix(base.actions, server.actions)) {
            const merged: LiveProgress = {
                ...remote,
                actions: [...server.actions, ...local.actions.slice(base.actions.length)],
                ...(!!local.paused !== !!base.paused ? { paused: !!local.paused, pausedBy: local.pausedBy ?? null } : { paused: !!server.paused, pausedBy: server.pausedBy ?? null }),
                // Bereit nach der Pause: beide Listen zusammen (zwei Handys druecken gleichzeitig)
                pauseReady: [...new Set([...(server.pauseReady ?? []), ...(local.paused && server.paused ? local.pauseReady ?? [] : [])])],
                match: !sameColors(local.match, base.match) && server.match ? { ...server.match, cupColors: local.match?.cupColors } : server.match,
            };
            if (options.applyRemote(merged)) {
                if (keyOf(merged) !== keyOf(remote)) schedulePush(0);
                return;
            }
        }
        options.applyRemote(remote);
        if (local && JSON.stringify(local.actions) !== JSON.stringify(server.actions))
            options.onNotice('Ein anderes Handy hat gerade eingetragen – bitte prüfen, ob dein Eintrag noch fehlt');
    };

    // Stand vom Server, der nicht von diesem Handy kommt: vorbei, getrennt oder neuer Stand
    const handleServer = (game: LiveGame): boolean => {
        if (game.status === 'done' || game.status === 'aborted') { ended(game); return false; }
        if (!isMember(game)) { kicked(); return false; }
        return true;
    };

    const push = async () => {
        if (!binding.value || resyncPending) return;
        if (pushing) { pushAgain = true; return; }
        const progress = options.getProgress();
        if (!progress || (synced && keyOf(progress) === keyOf(synced))) return;
        pushing = true;
        try {
            const result = await syncLiveGame(binding.value, progress);
            status.value = 'live';
            if (result.ok) adopt(result.game);
            else if (result.game && handleServer(result.game)) {
                if (result.game.status === 'saving') adopt(result.game);
                else resolveConflict(result.game);
            }
        } catch (error: any) {
            if (error?.response?.status === 404) return kicked();
            status.value = 'offline';
        } finally {
            pushing = false;
            if (pushAgain) { pushAgain = false; schedulePush(0); }
        }
    };

    const schedulePush = (delay = PUSH_DELAY_MS) => {
        if (!binding.value) return;
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(() => { pushTimer = null; push(); }, delay);
    };

    const poll = async () => {
        if (!binding.value || pushing) return;
        const game = await getLiveGame(binding.value.id);
        if (!binding.value) return;
        if (!game) { status.value = 'offline'; return; }
        status.value = 'live';
        if (!handleServer(game)) return;
        if (resyncPending) {
            resyncPending = false;
            if (game.version === binding.value.version) {
                // Server steht noch auf unserem letzten Stand: eigene Aenderungen seit dem Neuladen nachreichen
                devices.value = game.devices;
                synced = progressOf(game);
                schedulePush(0);
            } else {
                // Ein anderes Handy war weiter: dessen Stand gilt
                adopt(game);
                options.applyRemote(progressOf(game));
            }
            return;
        }
        if (game.version > binding.value.version) {
            const local = options.getProgress();
            const hasLocalChanges = !!local && !!synced && keyOf(local) !== keyOf(synced);
            if (hasLocalChanges) resolveConflict(game);
            else {
                adopt(game);
                options.applyRemote(progressOf(game));
            }
        } else {
            // z.B. nach einem Netzaussetzer: eigene Aenderungen nachreichen
            schedulePush(0);
        }
    };

    const startPolling = () => {
        stopPolling();
        pollTimer = setInterval(poll, POLL_MS);
    };
    const stopPolling = () => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
    };

    const ended = (game: LiveGame) => {
        stop();
        options.onEnded(game.status === 'done' ? 'done' : 'aborted', game);
    };

    const kicked = () => {
        stop();
        options.onKicked();
    };

    const start = (created: LiveBinding, game: LiveGame) => {
        devices.value = [];
        setBinding(created);
        adopt(game);
        status.value = 'live';
        startPolling();
    };

    // ─── Oeffentliche Funktionen ───
    // Spiel live stellen (dieses Handy ist das erste). device: Name und wofuer dieses Handy eintraegt
    const host = async (match: Match, progress: LiveProgress, device: { name: string | null } & Partial<LiveDeviceBinding>) => {
        status.value = 'connecting';
        try {
            const { game, binding: created } = await createLiveGame(match, progress, device);
            start(created, game);
            schedulePush(0);    // was seit dem Start schon passiert ist
            return true;
        } catch {
            status.value = 'off';
            return false;
        }
    };

    // Weiteres Handy: als Spieler oder Tischende beitreten (wirft LiveJoinError)
    const join = async (code: string, device: { name: string | null } & LiveDeviceBinding) => {
        status.value = 'connecting';
        try {
            const { game, binding: joined } = await joinLiveGame(code, device);
            start(joined, game);
            return game;
        } catch (error) {
            status.value = 'off';
            throw error;
        }
    };

    // Nach dem Neuladen: mit gespeichertem Schreibrecht weitermachen
    const resume = (saved: LiveBinding) => {
        setBinding(saved);
        synced = null;
        resyncPending = true;   // der erste Abruf entscheidet, wessen Stand gilt
        status.value = 'connecting';
        startPolling();
        poll();
    };

    // Dieses Handy umstellen (wirft LiveJoinError('taken'))
    const bind = async (target: LiveDeviceBinding) => {
        if (!binding.value) return;
        adopt(await bindLiveDevice(binding.value, target));
    };

    // Anderes Handy trennen (z.B. Akku leer). Kein "nicht mehr verbunden"-Hinweis: das meldet der Aufrufer selbst.
    const kick = async (deviceId: string) => {
        if (!binding.value) return false;
        try {
            const game = await kickLiveDevice(binding.value, deviceId);
            devices.value = game.devices;
            adopt(game);
            return true;
        } catch {
            return false;
        }
    };

    // Eintragen beanspruchen: false = ein anderes Handy traegt schon ein
    const claim = async () => {
        if (!binding.value) return true;
        const result = await claimLiveGame(binding.value);
        if (result.game) adopt(result.game);
        return result.ok;
    };

    // Eintragen fehlgeschlagen: Spiel wieder freigeben
    const release = async () => {
        if (!binding.value) return;
        const game = await releaseLiveGame(binding.value);
        if (game) adopt(game);
    };

    // Revanche: freigeben und gleich den neuen Stand (leeres Spiel) hochladen. Solange keine Abfrage dazwischen,
    // sonst hielte sie das alte Spiel fuer eine Aenderung eines anderen Handys und spielte es zurueck.
    const restart = async () => {
        if (!binding.value) return;
        pushing = true;
        try {
            const game = await releaseLiveGame(binding.value);
            if (game) adopt(game);
        } finally {
            pushing = false;
        }
        await push();
    };

    // Eingetragen oder abgebrochen: gilt fuer alle Handys
    const finish = async (result: 'done' | 'aborted') => {
        const current = binding.value;
        stop();
        if (current) await finishLiveGame(current, result);
    };

    // Nur dieses Handy steigt aus, das Spiel laeuft auf den anderen weiter
    const leave = () => {
        const current = binding.value;
        stop();
        if (current) leaveLiveGame(current);
    };

    const stop = () => {
        stopPolling();
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = null;
        setBinding(null);
        status.value = 'off';
        devices.value = [];
        savingBy.value = null;
        synced = null;
        resyncPending = false;
    };

    onUnmounted(() => {
        stopPolling();
        if (pushTimer) clearTimeout(pushTimer);
    });

    return { binding, status, devices, savingBy, host, join, resume, bind, kick, claim, release, restart, finish, leave, schedulePush };
};
