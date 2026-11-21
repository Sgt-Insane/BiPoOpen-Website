import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnechtAction } from './knechtEngine';
import type { LiveGame, LiveProgress } from './knechtLive';

// Netz nachgestellt: nur die Funktionen, die die Synchronisation braucht
const server = vi.hoisted(() => ({ sync: vi.fn(), get: vi.fn(), wait: vi.fn() }));
vi.mock('./knechtLive', () => ({
    createLiveGame: async (match: Match) => ({
        game: { id: 'g', match, startTeamIndex: 0, startedAt: 1, actions: [], version: 1, status: 'live', devices: [{ id: 'me', name: 'Anna', team: 0, player: 0, joinedAt: 1 }], savingBy: null, endedBy: null, updatedAt: 1 },
        binding: { id: 'g', code: 'ABCDE', token: 't', deviceId: 'me', version: 1, team: 0, player: 0 },
    }),
    syncLiveGame: server.sync,
    getLiveGame: server.get,
    waitForLiveGame: server.wait,
    joinLiveGame: vi.fn(), bindLiveDevice: vi.fn(), kickLiveDevice: vi.fn(), leaveLiveGame: vi.fn(),
    claimLiveGame: vi.fn(), releaseLiveGame: vi.fn(), finishLiveGame: vi.fn(),
}));

const { useKnechtLiveSync } = await import('./useKnechtLiveSync');

const match = { _id: 'm', team1: { _id: 't1', players: [{ _id: 'a', name: 'Anna', score: 0 }, { _id: 'n', name: 'Nora', score: 0 }] }, team2: { _id: 't2', players: [{ _id: 'b', name: 'Ben', score: 0 }] } } as Match;
const throwOf = (player: number, cup: number): KnechtAction => ({ type: 'throw', player, outcome: 'hit', cup, time: cup });
const gameWith = (actions: KnechtAction[], version: number): LiveGame => ({
    id: 'g', match, startTeamIndex: 0, startedAt: 1, actions, version, status: 'live',
    devices: [{ id: 'me', name: 'Anna', team: 0, player: 0, joinedAt: 1 }, { id: 'nora', name: 'Nora', team: 0, player: 1, joinedAt: 2 }],
    savingBy: null, endedBy: null, updatedAt: 1,
});

const setup = (validate: (actions: KnechtAction[]) => boolean = () => true) => {
    let local: LiveProgress = { startTeamIndex: 0, startedAt: 1, actions: [], match };
    const applied: LiveProgress[] = [];
    const notices: string[] = [];
    const live = useKnechtLiveSync({
        getProgress: () => local,
        applyRemote: (progress) => {
            if (!validate(progress.actions)) return false;
            applied.push(progress);
            local = { ...progress };
            return true;
        },
        onEnded: vi.fn(),
        onBindingChange: vi.fn(),
        onNotice: (message) => notices.push(message),
        onKicked: vi.fn(),
    });
    return { live, applied, notices, setLocal: (actions: KnechtAction[]) => { local = { ...local, actions }; } };
};

describe('Mehrere Handys: gleichzeitig eingetragen', () => {
    beforeEach(() => { vi.useFakeTimers(); server.sync.mockReset(); server.get.mockReset(); server.wait.mockReset(); server.wait.mockResolvedValue('unsupported'); });
    afterEach(() => { vi.useRealTimers(); });

    it('haengt den eigenen Wurf hinter den des Mitspielers', async () => {
        const { live, applied, notices, setLocal } = setup();
        await live.host(match, { startTeamIndex: 0, startedAt: 1, actions: [], match }, { name: 'Anna', team: 0, player: 0 });
        await vi.runOnlyPendingTimersAsync();

        // Anna traegt ein, Nora war gleichzeitig schneller beim Server
        setLocal([throwOf(0, 3)]);
        server.sync
            .mockResolvedValueOnce({ ok: false, game: gameWith([throwOf(1, 5)], 2) })
            .mockImplementationOnce(async (_binding, progress: LiveProgress) => ({ ok: true, game: gameWith(progress.actions, 3) }));
        live.schedulePush(0);
        await vi.runOnlyPendingTimersAsync();
        await vi.runOnlyPendingTimersAsync();

        expect(applied.at(-1)?.actions).toEqual([throwOf(1, 5), throwOf(0, 3)]);
        // Zusammengefuehrter Stand geht auf dem neuen Serverstand (Version 2) raus
        expect(server.sync).toHaveBeenLastCalledWith(expect.objectContaining({ version: 2 }), expect.objectContaining({ actions: [throwOf(1, 5), throwOf(0, 3)] }));
        expect(notices.filter(notice => notice.includes('prüfen'))).toEqual([]);
        live.leave();
    });

    it('passt das Zusammenfuehren nicht zu den Regeln, gilt der Serverstand mit Hinweis', async () => {
        const { live, applied, notices, setLocal } = setup(actions => actions.length < 2);
        await live.host(match, { startTeamIndex: 0, startedAt: 1, actions: [], match }, { name: 'Anna', team: 0, player: 0 });
        await vi.runOnlyPendingTimersAsync();

        setLocal([throwOf(0, 3)]);
        server.sync.mockResolvedValueOnce({ ok: false, game: gameWith([throwOf(1, 5)], 2) });
        live.schedulePush(0);
        await vi.runOnlyPendingTimersAsync();

        expect(applied.at(-1)?.actions).toEqual([throwOf(1, 5)]);
        expect(notices.filter(notice => notice.includes('prüfen'))).toHaveLength(1);
        live.leave();
    });
});

describe('Mehrere Handys: Long-Polling', () => {
    beforeEach(() => { vi.useFakeTimers(); server.sync.mockReset(); server.get.mockReset(); server.wait.mockReset(); });
    afterEach(() => { vi.useRealTimers(); });

    it('uebernimmt den Wurf vom anderen Handy, sobald der Server antwortet, ohne Abfrage-Pause', async () => {
        const { live, applied } = setup();
        server.wait
            .mockResolvedValueOnce({ unchanged: true })
            .mockResolvedValueOnce({ game: gameWith([throwOf(1, 5)], 2) })
            .mockImplementation(() => new Promise(() => {}));      // danach wartet die Abfrage beim Server
        await live.host(match, { startTeamIndex: 0, startedAt: 1, actions: [], match }, { name: 'Anna', team: 0, player: 0 });
        await vi.advanceTimersByTimeAsync(200);

        expect(applied.at(-1)?.actions).toEqual([throwOf(1, 5)]);
        expect(server.get).not.toHaveBeenCalled();
        // Erst mit der bekannten Version, nach der Uebernahme mit der neuen
        expect(server.wait.mock.calls.map(call => call[1])).toEqual([1, 1, 2]);
        live.leave();
    });

    it('faellt auf regelmaessiges Abfragen zurueck, wenn das Backend kein Long-Polling kennt', async () => {
        const { live, applied } = setup();
        server.wait.mockResolvedValue('unsupported');
        server.get.mockResolvedValue(gameWith([throwOf(1, 5)], 2));
        await live.host(match, { startTeamIndex: 0, startedAt: 1, actions: [], match }, { name: 'Anna', team: 0, player: 0 });
        await vi.advanceTimersByTimeAsync(200);

        expect(applied.at(-1)?.actions).toEqual([throwOf(1, 5)]);
        expect(server.wait).toHaveBeenCalledTimes(1);
        live.leave();
    });
});
