import { describe, expect, it } from 'vitest';
import { getPlayerCupHeatmap } from './playerHeatmap';

const turn = (teamIndex: number, playerIndex: number, type: Turn['type'], data: unknown = null): Turn =>
    ({ teamIndex, playerIndex, type, data: data as Turn['data'], time: 0 });
const match = (turns: Turn[]): Match => ({
    _id: 'm', time: 0,
    team1: { players: [{ name: 'Anna', score: 0 }] },
    team2: { players: [{ name: 'Ben', score: 0 }] },
    turns,
} as unknown as Match);

describe('getPlayerCupHeatmap', () => {
    it('zaehlt Treffer nach Becherposition', () => {
        const heatmap = getPlayerCupHeatmap([match([turn(0, 0, 'hit', { cupIndex: 0 }), turn(1, 0, 'miss'), turn(0, 0, 'hit', { cupIndex: 4 })])], 'Anna');
        expect(heatmap?.hits[0]).toBe(1);
        expect(heatmap?.hits[4]).toBe(1);
        expect(heatmap?.games).toBe(1);
    });

    it('zaehlt auch alte Spiele ohne Re-Rack-Eintraege', () => {
        // Becher 1 faellt zweimal: dazwischen gab es ein Re-Rack, das alte Spiele nicht gespeichert haben
        const old = match([turn(0, 0, 'hit', { cupIndex: 0 }), turn(0, 0, 'hit', { cupIndex: 0 }), turn(1, 0, 'owncup', { cups: [3] })]);
        const heatmap = getPlayerCupHeatmap([old], 'Anna');
        expect(heatmap?.hits[0]).toBe(2);
        // Eigene Becher des Gegners zaehlen nicht als Treffer
        expect(getPlayerCupHeatmap([old], 'Ben')).toBeNull();
    });
});
