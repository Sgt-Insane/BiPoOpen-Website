import { describe, it, expect } from 'vitest';
import { getTurnIcon } from './knechtIcons';

const turn = (teamIndex: number, playerIndex: number, type: Turn['type'], data: Record<string, unknown> = {}): Turn =>
    ({ teamIndex, playerIndex, type, data, time: 0 } as Turn);

describe('Symbole im Verlauf', () => {
    it('zeigt das Symbol der Art des Eintrags', () => {
        expect(getTurnIcon(turn(0, 0, 'hit', { cupIndex: 0 }))).toBe('hit');
        expect(getTurnIcon(turn(0, 0, 'bomb', { cupIndex1: 0, cupIndex2: 1 }))).toBe('bomb');
        expect(getTurnIcon(turn(0, 0, 'airball'))).toBe('airball');
    });

    it('zeigt beim Treffer des Faengers nach einem Trickshot-Fang den Trickshot', () => {
        const caught = turn(0, 1, 'trickshot', { catcherIndex: 0 });
        expect(getTurnIcon(turn(0, 0, 'hit', { cupIndex: 3 }), caught)).toBe('trickshot');
        expect(getTurnIcon(turn(0, 1, 'hit', { cupIndex: 3 }), caught)).toBe('hit');     // nicht der Faenger
        expect(getTurnIcon(turn(1, 0, 'hit', { cupIndex: 3 }), caught)).toBe('hit');     // anderes Team
    });
});
