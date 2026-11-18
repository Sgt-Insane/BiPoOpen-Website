import { describe, expect, it } from 'vitest';
import { createLocalServer, createMemoryStore } from './multiplayerLocalServer';

const setup = () => {
    let now = 1_000_000;
    const server = createLocalServer(createMemoryStore(() => now));
    return { server, tick: (ms: number) => { now += ms; } };
};

describe('Mehrspieler: Sessions', () => {
    it('verteilt Beitretende abwechselnd auf beide Teams', () => {
        const { server } = setup();
        const session = server.create('a', 'Anna');
        server.join(session.code, 'b', 'Ben');
        server.join(session.code, 'c', 'Cleo');
        const full = server.join(session.code, 'd', 'Dana');
        expect(full.players.map(player => player.team)).toEqual([0, 1, 0, 1]);
    });

    it('nimmt nach dem Start niemanden mehr auf, laesst bekannte Handys aber zurueck', () => {
        const { server } = setup();
        const session = server.create('a', 'Anna');
        server.join(session.code, 'b', 'Ben');
        const current = server.get(session.code)!;
        server.update(session.code, current.version, { status: 'started' });
        expect(() => server.join(session.code, 'c', 'Cleo')).toThrow('läuft schon');
        expect(server.join(session.code, 'b', 'Ben').players).toHaveLength(2);
    });

    it('lehnt Aenderungen auf veraltetem Stand ab', () => {
        const { server } = setup();
        const session = server.create('a', 'Anna');
        const first = server.update(session.code, session.version, { cupColors: ['#1', '#2'] });
        const second = server.update(session.code, session.version, { cupColors: ['#2', '#1'] });
        expect(first.ok).toBe(true);
        expect(second.ok).toBe(false);
        expect(second.session.cupColors).toEqual(['#1', '#2']);
    });

    it('beendet die Lobby erst, wenn kein Handy mehr da ist (Spieler ohne Handy zaehlen nicht)', () => {
        const { server } = setup();
        const session = server.create('a', 'Anna');
        server.update(session.code, session.version, { players: [...session.players, { deviceId: 'np-1', name: 'Nora', team: 1, joinedAt: 5, phone: false }] });
        expect(server.leave(session.code, 'a')!.status).toBe('aborted');
    });
});

describe('Mehrspieler: Anstossen', () => {
    it('verbindet zwei Stoesse kurz nacheinander zu einer Lobby', () => {
        const { server, tick } = setup();
        const first = server.bump('a', 'Anna');
        expect('session' in first).toBe(false);
        tick(400);
        const second = server.bump('b', 'Ben');
        expect('session' in second && second.session.players.map(player => player.name)).toEqual(['Anna', 'Ben']);
        // Der fruehere Stoss erfaehrt beim naechsten Nachfragen dieselbe Lobby
        const polled = server.bumpStatus((first as { bumpId: string }).bumpId);
        expect('session' in polled && polled.session.code).toBe('session' in second && second.session.code);
    });

    it('verbindet keine Stoesse, die zu weit auseinanderliegen', () => {
        const { server, tick } = setup();
        server.bump('a', 'Anna');
        tick(5000);
        expect('session' in server.bump('b', 'Ben')).toBe(false);
    });

    it('holt weitere Spieler per Stoss in die bestehende Lobby', () => {
        const { server, tick } = setup();
        const lobby = server.create('a', 'Anna');
        server.join(lobby.code, 'b', 'Ben');
        server.bump('a', 'Anna', lobby.code);
        tick(300);
        const result = server.bump('c', 'Cleo');
        expect('session' in result && result.session.code).toBe(lobby.code);
        expect(server.get(lobby.code)!.players).toHaveLength(3);
    });

    it('verbindet zwei Handys derselben Lobby nicht miteinander', () => {
        const { server, tick } = setup();
        const lobby = server.create('a', 'Anna');
        server.join(lobby.code, 'b', 'Ben');
        server.bump('a', 'Anna', lobby.code);
        tick(200);
        expect('session' in server.bump('b', 'Ben', lobby.code)).toBe(false);
    });
});
