import { describe, expect, it } from 'vitest';
import { applyAction, createInitialState, type KnechtAction } from './knechtEngine';
import { getCupOwners } from './knechtCupOwners';

const play = (playerCounts: [number, number], actions: Omit<KnechtAction, 'time'>[]) => {
    let state = createInitialState({ playerCounts, startTeamIndex: 0 });
    actions.forEach((action, index) => { state = applyAction(state, { ...action, time: 1000 + index } as KnechtAction); });
    return state;
};
const hit = (player: number, cup: number) => ({ type: 'throw', player, outcome: 'hit', cup, bouncer: false, extraCups: [] }) as const;
const miss = (player: number) => ({ type: 'throw', player, outcome: 'miss' }) as const;

describe('Becher: Werfer und Trinker', () => {
    it('merkt sich den Werfer auf dem Platz des Bechers', () => {
        const state = play([2, 2], [hit(1, 3), miss(0)]);
        const owners = getCupOwners(state);
        expect(owners.racks[1].get(3)?.thrower).toEqual({ teamIndex: 0, playerIndex: 1 });
    });

    it('laesst im getroffenen Team abwechselnd trinken, beginnend mit dem ersten Werfer', () => {
        // Team 1 wirft im eigenen Zug mit Spieler 1 zuerst - der trinkt den ersten Becher
        const state = play([2, 2], [hit(0, 0), miss(1), miss(1), miss(0), hit(0, 1), miss(1), miss(1), miss(0), hit(1, 2), miss(0)]);
        const drinkers = getCupOwners(state).removals.filter(removal => removal.rackTeam === 1).map(removal => removal.drinker);
        expect(drinkers).toEqual([1, 0, 1]);
    });
});
