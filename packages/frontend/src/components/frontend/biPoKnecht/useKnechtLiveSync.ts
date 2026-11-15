import { onUnmounted, ref } from 'vue';
import {
    createLiveGame, finishLiveGame, getLiveGame, joinLiveGame, syncLiveGame,
    type LiveBinding, type LiveGame, type LiveProgress,
} from './knechtLive';

// Synchronisiert ein laufendes Knecht-Spiel mit dem Server (Live-Ticker, zweites Handy).
//
// - Jede lokale Aenderung wird kurz danach hochgeladen, mit der zuletzt bekannten Version (baseVersion).
// - Alle 1,5 s wird der Serverstand abgefragt; hat das andere Handy etwas eingetragen, wird es uebernommen.
// - Haben beide gleichzeitig eingetragen (Konflikt), gilt der Stand, der zuerst beim Server war, und das andere
//   Handy bekommt einen Hinweis. Zwei Eintraege innerhalb einer Sekunde sind fast immer derselbe Wurf, doppelt
//   erfasst - anhaengen wuerde ihn doppelt zaehlen.

const POLL_MS = 1500;
const PUSH_DELAY_MS = 250;

export type LiveStatus = 'off' | 'connecting' | 'live' | 'offline';

type Options = {
    getProgress: () => LiveProgress | null;
    // Serverstand ins laufende Spiel uebernehmen; false = passt nicht (Regeln)
    applyRemote: (progress: LiveProgress) => boolean;
    // Das andere Handy hat das Spiel eingetragen oder abgebrochen
    onEnded: (status: 'done' | 'aborted', game: LiveGame) => void;
    onBindingChange: (binding: LiveBinding | null) => void;
    onNotice: (message: string) => void;
};

const keyOf = (progress: LiveProgress) => JSON.stringify([progress.startTeamIndex, progress.startedAt, progress.actions]);
const progressOf = (game: LiveGame): LiveProgress => ({ startTeamIndex: game.startTeamIndex, startedAt: game.startedAt, actions: game.actions });

export const useKnechtLiveSync = (options: Options) => {
    const binding = ref<LiveBinding | null>(null);
    const status = ref<LiveStatus>('off');
    const devices = ref(1);

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

    const adopt = (game: LiveGame) => {
        synced = progressOf(game);
        if (binding.value) setBinding({ ...binding.value, version: game.version });
        devices.value = game.devices;
    };

    // Konflikt: der Stand des anderen Handys (zuerst beim Server) gilt
    const resolveConflict = (server: LiveGame) => {
        const local = options.getProgress();
        adopt(server);
        options.applyRemote(progressOf(server));
        if (local && keyOf(local) !== keyOf(progressOf(server)))
            options.onNotice('Das andere Handy hat gerade eingetragen – bitte prüfen, ob dein Eintrag noch fehlt');
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
            else if (result.game) {
                if (result.game.status !== 'live') return ended(result.game);
                resolveConflict(result.game);
            }
        } catch {
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
        devices.value = game.devices;
        if (game.status !== 'live') return ended(game);
        if (resyncPending) {
            resyncPending = false;
            if (game.version === binding.value.version) {
                // Server steht noch auf unserem letzten Stand: eigene Aenderungen seit dem Neuladen nachreichen
                synced = progressOf(game);
                schedulePush(0);
            } else {
                // Das andere Handy war weiter: dessen Stand gilt
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

    // ─── Oeffentliche Funktionen ───
    const host = async (match: Match, progress: LiveProgress) => {
        status.value = 'connecting';
        try {
            const { game, binding: created } = await createLiveGame(match, progress);
            setBinding(created);
            adopt(game);
            status.value = 'live';
            startPolling();
            schedulePush(0);    // was seit dem Start schon passiert ist
            return true;
        } catch {
            status.value = 'offline';
            return false;
        }
    };

    const join = async (code: string) => {
        status.value = 'connecting';
        const { game, binding: joined } = await joinLiveGame(code);
        setBinding(joined);
        adopt(game);
        status.value = 'live';
        startPolling();
        return game;
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

    const finish = async (result: 'done' | 'aborted') => {
        const current = binding.value;
        stop();
        if (current) await finishLiveGame(current, result);
    };

    // Nur dieses Handy steigt aus (das Spiel laeuft auf dem anderen weiter)
    const leave = () => stop();

    const stop = () => {
        stopPolling();
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = null;
        setBinding(null);
        status.value = 'off';
        synced = null;
        resyncPending = false;
    };

    onUnmounted(() => {
        stopPolling();
        if (pushTimer) clearTimeout(pushTimer);
    });

    return { binding, status, devices, host, join, resume, finish, leave, schedulePush };
};
