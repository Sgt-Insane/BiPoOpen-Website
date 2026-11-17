import { computed, ref } from 'vue';
import { mpApi } from './multiplayerApi';
import { MpError, getTeamPlayers, type MpPatch, type MpSession } from './multiplayerTypes';
import { readSetting, useProfile, writeSetting } from './useProfile';

// Gemeinsamer Stand des Mehrspieler-Knechts auf diesem Handy (ein Spiel gleichzeitig, modulweit).
// Eigene Aenderungen gehen nacheinander raus (commit), jede mit der zuletzt bekannten version. War ein anderes
// Handy schneller, wird der Patch auf dem neuen Stand neu gebaut. Fremde Aenderungen kommen per Echtzeit
// oder Abfrage im Takt.

const CODE_KEY = 'bipo_mp_code';
const POLL_FAST = 1500;
const POLL_LIVE = 4000;
const BUMP_TIMEOUT = 8000;

const readCode = () => readSetting(CODE_KEY);
const writeCode = (code: string | null) => writeSetting(CODE_KEY, code);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const session = ref<MpSession | null>(null);
const storedCode = ref<string | null>(readCode());
const live = ref(false);
const offline = ref(false);
const bumpState = ref<'idle' | 'searching' | 'found' | 'none'>('idle');

let inFlight = 0;
let queue: Promise<unknown> = Promise.resolve();
let unsubscribe: (() => void) | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let endedListener: ((session: MpSession | null, reason: string) => void) | null = null;

export type CommitResult = 'applied' | 'noop' | 'failed';

export const useMultiplayerSession = () => {
    const { deviceId, profileName } = useProfile();

    const me = computed(() => session.value?.players.find(player => player.deviceId === deviceId) ?? null);
    const myTeam = computed(() => me.value?.team ?? 0);
    const myPlayerIndex = computed(() => {
        if (!session.value || !me.value) return 0;
        return getTeamPlayers(session.value.players, me.value.team).findIndex(player => player.deviceId === deviceId);
    });
    const isHost = computed(() => session.value?.hostId === deviceId);

    // ─── Fremde Staende ───
    const adopt = (next: MpSession) => {
        const current = session.value;
        if (!current || current.code !== next.code || next.version > current.version) session.value = next;
    };
    // Waehrend eigene Aenderungen unterwegs sind, wartet der fremde Stand (sonst flackert der eigene Wurf weg)
    const incoming = (next: MpSession) => { if (!inFlight) adopt(next); };

    const poll = async () => {
        const current = session.value;
        if (!current) return;
        try {
            const next = await mpApi.get(current.code, current.version);
            offline.value = false;
            if (next) incoming(next);
        } catch (error) {
            if (error instanceof MpError && error.status === 404) end('Das Spiel gibt es nicht mehr');
            else offline.value = true;
        }
    };

    const schedulePoll = () => {
        if (pollTimer) clearTimeout(pollTimer);
        if (!session.value) return;
        pollTimer = setTimeout(async () => {
            if (typeof document === 'undefined' || !document.hidden) await poll();
            schedulePoll();
        }, live.value ? POLL_LIVE : POLL_FAST);
    };

    const onVisible = () => { if (!document.hidden) poll(); };

    const startSync = (code: string) => {
        stopSync();
        unsubscribe = mpApi.subscribe(code, incoming, isLive => { live.value = isLive; });
        document.addEventListener('visibilitychange', onVisible);
        schedulePoll();
    };

    const stopSync = () => {
        unsubscribe?.();
        unsubscribe = null;
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = null;
        live.value = false;
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };

    const enter = (next: MpSession) => {
        session.value = next;
        storedCode.value = next.code;
        writeCode(next.code);
        startSync(next.code);
        // Beitritt: die anderen sollen den neuen Spieler sofort sehen
        mpApi.publish(next);
    };

    const clear = () => {
        stopSync();
        session.value = null;
        storedCode.value = null;
        writeCode(null);
    };

    const end = (reason: string) => {
        const last = session.value;
        clear();
        endedListener?.(last, reason);
    };

    const onEnded = (listener: typeof endedListener) => {
        endedListener = listener;
        return () => { if (endedListener === listener) endedListener = null; };
    };

    // ─── Beitreten ───
    const requireName = () => {
        if (!profileName.value) throw new MpError('Bitte zuerst ein Profil wählen');
        return profileName.value;
    };

    const create = async () => enter(await mpApi.create(deviceId, requireName()));

    const join = async (code: string) => {
        const cleaned = code.replace(/\D/g, '');
        if (session.value?.code === cleaned) return;
        const next = await mpApi.join(cleaned, deviceId, requireName());
        if (session.value) await mpApi.leave(session.value.code, deviceId).catch(() => {});
        enter(next);
    };

    // Gespeichertes Spiel nach Neuladen fortsetzen. false = gibt es nicht mehr / nicht mehr dabei.
    const resume = async (code = storedCode.value): Promise<boolean> => {
        if (!code) return false;
        if (session.value?.code === code) return true;
        try {
            const next = await mpApi.get(code);
            const isMember = !!next?.players.some(player => player.deviceId === deviceId);
            if (!next || !isMember || ['saved', 'aborted'].includes(next.status)) {
                if (storedCode.value === code) { storedCode.value = null; writeCode(null); }
                return false;
            }
            enter(next);
            return true;
        } catch (error) {
            if (error instanceof MpError && error.status === 404 && storedCode.value === code) {
                storedCode.value = null;
                writeCode(null);
            }
            return false;
        }
    };

    // Seite verlassen, Spiel laeuft weiter (Code bleibt gespeichert, resume() holt es zurueck)
    const suspend = () => {
        stopSync();
        session.value = null;
    };

    const leave = async () => {
        const current = session.value;
        clear();
        if (!current) return;
        const left = await mpApi.leave(current.code, deviceId).catch(() => null);
        if (left) mpApi.publish(left);
    };

    // ─── Eigene Aenderungen ───
    // makePatch bekommt den neuesten Stand und baut daraus den Patch (null = nichts zu tun).
    const runCommit = async (makePatch: (current: MpSession) => MpPatch | null): Promise<CommitResult> => {
        let base = session.value;
        if (!base) return 'failed';
        inFlight++;
        try {
            for (let attempt = 0; attempt < 8; attempt++) {
                const patch = makePatch(base);
                if (!patch) {
                    adopt(base);
                    return 'noop';
                }
                if (attempt === 0) session.value = { ...base, ...patch };     // sofort anzeigen

                let result;
                try {
                    result = await mpApi.update(base.code, base.version, patch);
                    offline.value = false;
                } catch (error) {
                    if (error instanceof MpError && error.status && error.status !== 409) break;
                    offline.value = true;
                    await sleep(Math.min(4000, 700 * (attempt + 1)));
                    continue;
                }
                if (result.ok) {
                    session.value = result.session;
                    mpApi.publish(result.session);
                    return 'applied';
                }
                base = result.session;
            }
            session.value = base;
            return 'failed';
        } finally {
            inFlight--;
        }
    };

    const commit = (makePatch: (current: MpSession) => MpPatch | null) => {
        const next = queue.then(() => runCommit(makePatch));
        queue = next.catch(() => {});
        return next;
    };

    // ─── Anstossen ───
    const bump = async () => {
        if (bumpState.value === 'searching' || !profileName.value) return;
        bumpState.value = 'searching';
        const settle = (state: 'found' | 'none') => {
            bumpState.value = state;
            setTimeout(() => { if (bumpState.value === state) bumpState.value = 'idle'; }, state === 'found' ? 1500 : 2500);
        };
        try {
            const startedAt = Date.now();
            let result = await mpApi.bump(deviceId, profileName.value, session.value?.code);
            while (!('session' in result) && !result.expired && Date.now() - startedAt < BUMP_TIMEOUT) {
                await sleep(400);
                result = await mpApi.bumpStatus(result.bumpId);
            }
            if ('session' in result && result.session) {
                if (session.value && session.value.code !== result.session.code) await mpApi.leave(session.value.code, deviceId).catch(() => {});
                if (session.value?.code === result.session.code) {
                    adopt(result.session);
                    mpApi.publish(result.session);
                } else {
                    enter(result.session);
                }
                navigator.vibrate?.([60, 40, 60]);
                settle('found');
            } else {
                settle('none');
            }
        } catch {
            settle('none');
        }
    };

    return {
        api: mpApi,
        session,
        storedCode,
        live,
        offline,
        bumpState,
        deviceId,
        me,
        myTeam,
        myPlayerIndex,
        isHost,
        create,
        join,
        resume,
        leave,
        suspend,
        clear,
        commit,
        bump,
        onEnded,
    };
};
