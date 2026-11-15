import { onUnmounted, ref } from 'vue';
import {
    createLiveGame, finishLiveGame, getLiveGame, joinLiveGame, kickLiveGuest, leaveLiveGame, syncLiveGame,
    type LiveBinding, type LiveGame, type LiveProgress,
} from './knechtLive';

// Synchronisiert ein laufendes Knecht-Spiel mit dem Server (Live-Ticker, zweites Handy).
//
// - Jede lokale Aenderung wird kurz danach hochgeladen, mit der zuletzt bekannten Version (baseVersion).
// - Alle 1,5 s wird der Serverstand abgefragt; hat das andere Handy etwas eingetragen, wird es uebernommen.
// - Haben beide gleichzeitig eingetragen (Konflikt), gilt der Stand, der zuerst beim Server war, und das andere
//   Handy bekommt einen Hinweis. Zwei Eintraege innerhalb einer Sekunde sind fast immer derselbe Wurf, doppelt
//   erfasst - anhaengen wuerde ihn doppelt zaehlen.
// - Zwei Handys: jedes steht an einem Tischende (side = Teamindex). Das zweite waehlt seine Seite beim Beitreten,
//   das erste steht gegenueber. Das erste Handy kann das zweite trennen (neuer Code, kein Wiedereintritt).

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
    // Zweites Handy: das erste Handy hat es getrennt
    onKicked: () => void;
};

const keyOf = (progress: LiveProgress) => JSON.stringify([progress.startTeamIndex, progress.startedAt, progress.actions, progress.match?.cupColors ?? null]);
const progressOf = (game: LiveGame): LiveProgress => ({ startTeamIndex: game.startTeamIndex, startedAt: game.startedAt, actions: game.actions, match: game.match });

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

    // Zweites Handy getrennt? (seine Kennung ist nicht mehr die des Spiels)
    const wasKicked = (game: LiveGame) => binding.value?.role === 'guest' && game.guestId !== binding.value.guestId;

    const adopt = (game: LiveGame) => {
        synced = progressOf(game);
        devices.value = game.devices;
        if (!binding.value) return;
        // Erstes Handy: steht gegenueber dem zweiten (ohne zweites Handy: keine feste Seite)
        const side = binding.value.role === 'host' ? (game.guestSide === null ? null : 1 - game.guestSide) : binding.value.side ?? null;
        if (side !== (binding.value.side ?? null) && binding.value.role === 'host') {
            options.onNotice(side === null ? 'Zweites Handy getrennt – du zählst wieder allein' : 'Zweites Handy verbunden – jedes Handy zeigt jetzt die Becher des Gegners');
        }
        setBinding({ ...binding.value, version: game.version, side });
    };

    // Konflikt: der Stand des anderen Handys (zuerst beim Server) gilt
    const resolveConflict = (server: LiveGame) => {
        const local = options.getProgress();
        adopt(server);
        options.applyRemote(progressOf(server));
        if (local && JSON.stringify(local.actions) !== JSON.stringify(server.actions))
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
                if (wasKicked(result.game)) return kicked();
                if (result.game.status !== 'live') return ended(result.game);
                resolveConflict(result.game);
            } else if (binding.value?.role === 'guest') {
                // Schreibrecht weg: getrennt
                return kicked();
            }
        } catch (error: any) {
            if (error?.response?.status === 404 && binding.value?.role === 'guest') return kicked();
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
        if (wasKicked(game)) return kicked();
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

    const kicked = () => {
        stop();
        options.onKicked();
    };

    // ─── Oeffentliche Funktionen ───
    const host = async (match: Match, progress: LiveProgress) => {
        status.value = 'connecting';
        try {
            const { game, binding: created } = await createLiveGame(match, progress);
            setBinding({ ...created, side: null });
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

    // Zweites Handy: mit gewaehlter Tischseite beitreten (wirft LiveJoinError)
    const join = async (code: string, side: number) => {
        status.value = 'connecting';
        try {
            const { game, binding: joined } = await joinLiveGame(code, side);
            setBinding(joined);
            adopt(game);
            status.value = 'live';
            startPolling();
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

    // Erstes Handy: zweites Handy trennen, alleine weiterzaehlen (neuer Code)
    const kick = async () => {
        if (!binding.value || binding.value.role !== 'host') return false;
        try {
            const { game, code } = await kickLiveGuest(binding.value);
            setBinding({ ...binding.value, code });
            adopt(game);
            return true;
        } catch {
            return false;
        }
    };

    const finish = async (result: 'done' | 'aborted') => {
        const current = binding.value;
        stop();
        if (current) await finishLiveGame(current, result);
    };

    // Nur dieses Handy steigt aus (das Spiel laeuft auf dem anderen weiter), der Platz wird frei
    const leave = () => {
        const current = binding.value;
        stop();
        if (current?.role === 'guest') leaveLiveGame(current);
    };

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

    return { binding, status, devices, host, join, resume, kick, finish, leave, schedulePush };
};
