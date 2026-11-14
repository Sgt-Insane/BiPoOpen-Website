import { describe, it, expect } from 'vitest';
import { findFormation, KNECHT_FORMATIONS } from './knechtFormations';
import { applyAction, createInitialState } from './knechtEngine';
import { getNewFormations } from './useBiPoKnecht';

const indices = (...numbers: number[]) => numbers.map(number => number - 1);

describe('Formationen', () => {
    it('erkennt benannte Formationen der stehenden Becher', () => {
        expect(findFormation(indices(7, 8, 9, 10))?.name).toBe('Berliner Mauer');
        expect(findFormation(indices(2, 3))?.name).toBe('Twin Towers');
        expect(findFormation(indices(1, 2, 3, 4, 6, 7, 8, 9, 10))?.name).toBe('Arschlochbecher');
        expect(findFormation(indices(1, 2, 3))).toBeNull();
    });

    it('erkennt gespiegelte Formationen mit demselben Namen', () => {
        // Schneise: alle ausser 3-5-8, gespiegelt alle ausser 2-5-9
        expect(findFormation(indices(1, 2, 4, 6, 7, 9, 10))?.name).toBe('Schneise');
        expect(findFormation(indices(1, 3, 4, 6, 7, 8, 10))?.name).toBe('Schneise');
    });

    it('hat keine doppelten Formationen', () => {
        const keys = KNECHT_FORMATIONS.map(formation => [...formation.cups].sort((a, b) => a - b).join());
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('meldet eine Formation, sobald sie durch einen Treffer entsteht', () => {
        const before = createInitialState({ playerCounts: [1, 1], startTeamIndex: 0 });
        const next = applyAction(before, { type: 'throw', player: 0, outcome: 'hit', cup: 4, time: 1 });
        // Becher 5 getroffen: Team 2 hat jetzt den Arschlochbecher
        expect(getNewFormations(before, next)).toEqual([{ rackIndex: 1, formation: expect.objectContaining({ name: 'Arschlochbecher' }) }]);
        expect(getNewFormations(next, next)).toEqual([]);
    });
});
