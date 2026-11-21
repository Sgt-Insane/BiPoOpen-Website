import { describe, it, expect } from 'vitest';
import { getStandingCups, getTeamPoints, replay, type KnechtAction, type KnechtConfig } from './knechtEngine';

const DUO: KnechtConfig = { playerCounts: [2, 2], startTeamIndex: 0 };
const elbow = (team: number, player: number, cups: number[] = []): KnechtAction => ({ type: 'elbow', team, player, cups, time: 0 });

describe('Ellenbogen-Call', () => {
    it('gibt Strafbier mit Grund auch ohne vorherige Verwarnung und speichert den Grund', () => {
        const { state, error } = replay(DUO, [
            { type: 'elbow', team: 1, player: 0, cups: [4], card: 'red', reason: 'Irregulärer Eingriff ins Spiel', time: 0 },
            { type: 'elbow', team: 0, player: 1, cups: [], card: 'yellow', reason: 'Zu laut', time: 0 },
        ]);
        expect(error).toBeNull();
        expect(state.turns[0]).toMatchObject({ type: 'penalty', data: { card: 'red', cups: [4], reason: 'Irregulärer Eingriff ins Spiel' } });
        expect(state.turns[1]).toMatchObject({ type: 'penalty', data: { card: 'yellow', cups: [], reason: 'Zu laut' } });
        expect(getTeamPoints(state)).toEqual([1, 0]);
    });

    it('verlangt bei Strafbier genau einen stehenden eigenen Becher, bei der Verwarnung keinen', () => {
        expect(replay(DUO, [{ type: 'elbow', team: 1, player: 0, cups: [], card: 'red', time: 0 }]).error).not.toBeNull();
        expect(replay(DUO, [{ type: 'elbow', team: 1, player: 0, cups: [2], card: 'yellow', time: 0 }]).error).not.toBeNull();
    });

    it('gibt beim ersten Call gelb ohne Becher', () => {
        const { state, error } = replay(DUO, [elbow(1, 0)]);
        expect(error).toBeNull();
        expect(state.turns[0]).toMatchObject({ type: 'penalty', teamIndex: 1, data: { card: 'yellow', cups: [] } });
        expect(getStandingCups(state.racks[1])).toHaveLength(10);
    });

    it('nimmt ab dem zweiten Call einen eigenen Strafbecher, der fuer den Gegner zaehlt', () => {
        const { state, error } = replay(DUO, [elbow(1, 0), elbow(1, 0, [7]), elbow(1, 0, [3])]);
        expect(error).toBeNull();
        expect(state.turns.map(turn => (turn.data as { card: string }).card)).toEqual(['yellow', 'red', 'red']);
        expect(getStandingCups(state.racks[1])).not.toContain(7);
        expect(getTeamPoints(state)).toEqual([2, 0]);
    });

    it('zaehlt die Calls je Person', () => {
        const { error } = replay(DUO, [elbow(1, 0), elbow(1, 1)]);
        expect(error).toBeNull();      // zweite Person bekommt erst gelb, braucht keinen Becher
    });

    it('verlangt bei rot genau einen stehenden Becher und bei gelb keinen', () => {
        expect(replay(DUO, [elbow(1, 0, [3])]).error?.index).toBe(0);
        expect(replay(DUO, [elbow(1, 0), elbow(1, 0)]).error?.index).toBe(1);
    });
});
