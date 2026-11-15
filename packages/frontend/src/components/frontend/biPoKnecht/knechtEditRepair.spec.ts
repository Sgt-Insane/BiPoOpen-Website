import { describe, it, expect } from 'vitest';
import { replay, type KnechtAction, type KnechtConfig } from './knechtEngine';
import { planEdit } from './knechtEditRepair';

const DUO: KnechtConfig = { playerCounts: [2, 2], startTeamIndex: 0 };
const SOLO: KnechtConfig = { playerCounts: [1, 1], startTeamIndex: 0 };
const names = (team: number, player: number) => `T${team}P${player}`;

const hit = (player: number, cup: number, extra: Partial<Extract<KnechtAction, { type: 'throw' }>> = {}): KnechtAction =>
    ({ type: 'throw', player, outcome: 'hit', cup, time: 0, ...extra });
const miss = (player: number): KnechtAction => ({ type: 'throw', player, outcome: 'miss', time: 0 });

describe('planEdit', () => {
    it('uebernimmt eine einfache Korrektur ohne Folgen', () => {
        const actions = [hit(0, 0), miss(1), miss(0), miss(1)];
        const plan = planEdit(DUO, actions, 1, { type: 'throw', player: 1, outcome: 'airball', time: 0 }, names);
        expect(plan.error).toBeNull();
        expect(plan.changes).toEqual([]);
        expect(plan.scoreAfter).toEqual([1, 0]);
        expect(replay(DUO, plan.actions).error).toBeNull();
    });

    it('tauscht einen spaeteren Treffer auf den korrigierten Becher', () => {
        // Team 0 trifft Becher 0, spaeter Becher 5. Korrektur: der erste Treffer war Becher 5
        const actions = [hit(0, 0), miss(1), miss(0), miss(1), hit(0, 5), miss(1)];
        const plan = planEdit(DUO, actions, 0, hit(0, 5), names);
        expect(plan.error).toBeNull();
        expect(plan.changes).toHaveLength(1);
        expect(plan.changes[0].text).toContain('Becher 6 → 1');
        expect(plan.actions[4]).toMatchObject({ cup: 0 });
        expect(replay(DUO, plan.actions).error).toBeNull();
    });

    it('waehlt einen anderen Werfer, wenn der alte nicht mehr darf', () => {
        // Runde von Team 0: Spieler 0 dann Spieler 1. Korrektur: der erste Wurf war von Spieler 1
        const actions = [miss(0), miss(1), miss(0), miss(1)];
        const plan = planEdit(DUO, actions, 0, miss(1), names);
        expect(plan.error).toBeNull();
        expect(plan.actions[1]).toMatchObject({ player: 0 });
        expect(plan.changes[0].text).toContain('T0P1 → T0P0');
    });

    it('meldet einen verschobenen Zug statt Wuerfe dem falschen Team zuzuordnen', () => {
        // Aus zwei Fehlwuerfen werden zwei Treffer: Balls Back, Team 0 wirft noch einmal
        const actions = [hit(0, 0), miss(1), miss(0), miss(1), miss(0), miss(1)];
        const plan = planEdit(DUO, actions, 1, hit(1, 1), names);
        expect(plan.error).toMatch(/andere Team/);
        // nichts wird stillschweigend uebernommen
        expect(plan.actions.length).toBeLessThan(actions.length);
    });

    it('loescht den letzten Eintrag ohne Folgen', () => {
        const actions = [hit(0, 0), miss(1), miss(0)];
        const plan = planEdit(DUO, actions, 2, null, names);
        expect(plan.error).toBeNull();
        expect(plan.actions).toHaveLength(2);
    });

    it('laesst Eintraege nach einem frueheren Spielende wegfallen', () => {
        // 1 gegen 1: Team 0 raeumt alles ab, Team 1 trifft im Nachwurf nicht
        const clear: KnechtAction[] = [
            hit(0, 0), miss(0), miss(0), miss(0),
            hit(0, 1), hit(0, 2), hit(0, 3), hit(0, 4), hit(0, 5), hit(0, 6), hit(0, 7), hit(0, 8),
            miss(0), miss(0), hit(0, 9),
        ];
        const before = replay(SOLO, clear);
        expect(before.error).toBeNull();
        // Ein frueher Fehlwurf von Team 1 wird zum Treffer: das Spiel aendert sich, nichts darf stillschweigend falsch zugeordnet werden
        const plan = planEdit(SOLO, clear, 2, hit(0, 0), names);
        if (!plan.error) expect(replay(SOLO, plan.actions).error).toBeNull();
    });
});
