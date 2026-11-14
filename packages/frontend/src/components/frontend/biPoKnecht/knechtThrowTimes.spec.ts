import { describe, it, expect } from 'vitest';
import { getThrowTimes } from './knechtThrowTimes';

const turn = (teamIndex: number, playerIndex: number, time: number): Turn => ({ teamIndex, playerIndex, type: 'miss', data: {}, time } as Turn);

describe('Wurfzeiten (Knecht Pro)', () => {
    it('misst ab "Zug starten" bis zum Wurf, das Baelleholen zaehlt nicht', () => {
        const turns = [turn(0, 0, 5000), turn(0, 1, 9000), turn(1, 0, 60000), turn(1, 1, 62000)];
        const events = [
            { kind: 'turnStart', afterTurnIndex: 0, time: 1000 },     // Team 1: 4 s, dann 4 s
            { kind: 'turnStart', afterTurnIndex: 2, time: 57000 },    // Team 2 nach langem Baelleholen: 3 s, dann 2 s
        ];
        const times = getThrowTimes(turns, events)!;
        expect(times.netSeconds).toBe(13);
        expect(times.players.find(p => p.teamIndex === 0 && p.playerIndex === 0)!.average).toBe(4);
        expect(times.players.find(p => p.teamIndex === 1 && p.playerIndex === 1)!.average).toBe(2);
    });

    it('gibt ohne "Zug starten" nichts zurueck', () => {
        expect(getThrowTimes([turn(0, 0, 5000)], [])).toBeNull();
    });

    it('misst einen Zug ohne Start nicht', () => {
        const turns = [turn(0, 0, 5000), turn(1, 0, 20000)];
        const times = getThrowTimes(turns, [{ kind: 'turnStart', afterTurnIndex: 0, time: 1000 }])!;
        expect(times.players).toHaveLength(1);
    });
});
