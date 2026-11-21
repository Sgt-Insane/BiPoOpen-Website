import { describe, it, expect } from 'vitest';
import { findFormation, KNECHT_FORMATIONS } from './knechtFormations';
import { applyAction, createInitialState } from './knechtEngine';
import { getCelebrations, getNewFormations } from './useBiPoKnecht';

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
        expect(findFormation(indices(1, 3, 4, 7, 9, 10))?.name).toBe('Sharingan');
        expect(findFormation(indices(1, 2, 6, 7, 8, 10))?.name).toBe('Sharingan');
        expect(findFormation(indices(1, 3, 4, 5, 7, 9, 10))?.name).toBe('Windmühle');
        expect(findFormation(indices(1, 2, 5, 6, 7, 8, 10))?.name).toBe('Windmühle');
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

    it('zeigt die Merkel-Route nur, wenn Wuerfe sie stehen lassen, nicht nach einem Re-Rack', () => {
        expect(findFormation(indices(1, 2, 3, 5))?.name).toBe('Merkel-Route');
        // Stand vorher: 1 2 3 5 6 stehen bei Team 2 (Rack 1)
        const before = createInitialState({ playerCounts: [1, 1], startTeamIndex: 0 });
        before.racks[1] = { hit: indices(4, 7, 8, 9, 10), pending: [] };
        const thrown = { ...before, racks: [before.racks[0], { hit: indices(4, 6, 7, 8, 9, 10), pending: [] }] } as typeof before;
        const hit = { type: 'throw', player: 0, outcome: 'hit', cup: 5, time: 1 } as const;
        expect(getCelebrations(before, thrown, hit).formations.map(entry => entry.formation.name)).toEqual(['Merkel-Route']);
        // Gleiche Stellung, aber vom Re-Rack aufgestellt
        expect(getCelebrations(before, thrown, { type: 'reRack', time: 1 }).formations).toEqual([]);
    });
});
