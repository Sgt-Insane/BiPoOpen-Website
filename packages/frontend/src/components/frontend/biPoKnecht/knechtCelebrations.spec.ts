import { describe, it, expect } from 'vitest';
import { replay, type KnechtAction, type KnechtConfig } from './knechtEngine';
import { findFormation } from './knechtFormations';
import { getCelebrations } from './useBiPoKnecht';

const DUO: KnechtConfig = { playerCounts: [2, 2], startTeamIndex: 0 };
const hit = (player: number, cup: number, extra: Partial<Extract<KnechtAction, { type: 'throw' }>> = {}): KnechtAction =>
    ({ type: 'throw', player, outcome: 'hit', cup, time: 0, ...extra });

// Animationen der letzten Aktion
const celebrationsOf = (actions: KnechtAction[]) => {
    const before = replay(DUO, actions.slice(0, -1)).state;
    const next = replay(DUO, actions).state;
    const { throwKinds, formations, followUps } = getCelebrations(before, next, actions.at(-1)!, actions.at(-2));
    return { throwKinds, formations: formations.map(entry => entry.formation.name), followUps };
};

describe('Reihenfolge der Animationen', () => {
    it('zeigt bei Balls Back zuerst die neue Formation, danach Balls Back', () => {
        // Zwei Balls-Back-Runden suchen, nach deren zweiter eine benannte Formation stehen bleibt
        const all = Array.from({ length: 10 }, (_, cup) => cup);
        const pairs = all.flatMap(a => all.filter(b => b > a).map(b => [a, b]));
        let actions: KnechtAction[] | null = null;
        for (const [a, b] of pairs) {
            for (const [c, d] of pairs) {
                if ([c, d].some(cup => cup === a || cup === b)) continue;
                if (findFormation(all.filter(cup => ![a, b, c, d].includes(cup)))) { actions = [hit(0, a), hit(1, b), hit(0, c), hit(1, d)]; break; }
            }
            if (actions) break;
        }
        expect(actions).not.toBeNull();
        const result = celebrationsOf(actions!);
        expect(result.throwKinds).toEqual([]);
        expect(result.formations).toHaveLength(1);
        // Zweiter Treffer des Werfers in Folge: Heaten Up, danach kommen die Baelle zurueck
        expect(result.followUps).toEqual(['heating-up', 'ballsback']);
    });

    it('zeigt bei einer Bouncer-Bombe zuerst die Bombe, dann die Formation, dann Balls Back', () => {
        const actions = [hit(0, 4), hit(1, 4, { bouncer: true, extraCups: [1, 2, 3] })];
        const result = celebrationsOf(actions);
        expect(result.throwKinds).toEqual(['bomb']);
        expect(result.followUps).toEqual(['ballsback']);
        // Die Bombe war bisher nur ein Banner: Balls Back ging dabei verloren
        expect(replay(DUO, actions).state.events).toEqual(['bomb', 'ballsback']);
    });

    it('zeigt den Bouncer vor Heaten Up', () => {
        const result = celebrationsOf([hit(0, 0), hit(1, 1), hit(0, 2, { bouncer: true, extraCups: [3] })]);
        expect(result.throwKinds).toEqual(['bouncer']);
        expect(result.followUps).toEqual(['heating-up']);
    });
});
