import { describe, it, expect } from 'vitest';
import {
    replay, canReRack, getAllowedThrowers, getFinalPlayerPoints, getHittableCups, getPlayerPoints, getStandingCups, getTeamPoints, previewHit,
    type KnechtAction, type KnechtConfig, type KnechtState,
} from './knechtEngine';

// ─── Helfer ───
const DUO: KnechtConfig = { playerCounts: [2, 2], startTeamIndex: 0 };
const SOLO: KnechtConfig = { playerCounts: [1, 1], startTeamIndex: 0 };

const hit = (player: number, cup: number, extra: Partial<Extract<KnechtAction, { type: 'throw' }>> = {}): KnechtAction =>
    ({ type: 'throw', player, outcome: 'hit', cup, time: 0, ...extra });
const miss = (player: number): KnechtAction => ({ type: 'throw', player, outcome: 'miss', time: 0 });
const airball = (player: number): KnechtAction => ({ type: 'throw', player, outcome: 'airball', time: 0 });

const play = (config: KnechtConfig, actions: KnechtAction[]): KnechtState => {
    const result = replay(config, actions);
    expect(result.error).toBeNull();
    return result.state;
};

const expectError = (config: KnechtConfig, actions: KnechtAction[]) => {
    expect(replay(config, actions).error?.index).toBe(actions.length - 1);
};

// Team 0 raeumt im 1 gegen 1 alle 10 Becher von Team 1 ab: erst eine Leerrunde, damit der
// letzte Becher mit dem ersten Ball faellt (Ball 2 = Entscheidungswurf).
const soloClearWithFirstBall = (): KnechtAction[] => [
    hit(0, 0), miss(0),                     // Team 0: 1 Becher
    miss(0), miss(0),                       // Team 1
    hit(0, 1), hit(0, 2),                   // Balls Back
    hit(0, 3), hit(0, 4),
    hit(0, 5), hit(0, 6),
    hit(0, 7), hit(0, 8),
    hit(0, 0),                              // letzter Becher steht an der Spitze (0)
];

const expectPointsMatchCups = (state: KnechtState) => {
    const taken = state.racks.map(rack => rack.hit.length + rack.pending.length);
    const points = getTeamPoints(state);
    if (state.overtimeCount === 0) {
        expect(points[0]).toBeCloseTo(taken[1] + (state.winnerTeamIndex === 0 ? state.victoryBonus : 0));
        expect(points[1]).toBeCloseTo(taken[0] + (state.winnerTeamIndex === 1 ? state.victoryBonus : 0));
    }
    if (state.status === 'over')
        expect(points[state.winnerTeamIndex!]).toBeGreaterThan(points[1 - state.winnerTeamIndex!]);
};

describe('BiPo Knecht Regeln', () => {
    it('wechselt nach zwei Baellen das Team und uebernimmt die Treffer', () => {
        const state = play(DUO, [hit(0, 0), miss(1)]);
        expect(state.activeTeamIndex).toBe(1);
        expect(state.racks[1].hit).toEqual([0]);
        expect(getPlayerPoints(state)[0]).toEqual([1, 0]);
    });

    it('erlaubt eine freie Wurfreihenfolge, aber nur einen Ball pro Spieler', () => {
        const state = play(DUO, [miss(1)]);
        expect(getAllowedThrowers(state)).toEqual([0]);
        expectError(DUO, [miss(1), miss(1)]);
    });

    it('gibt bei zwei Treffern die Baelle zurueck (Balls Back)', () => {
        const state = play(DUO, [hit(1, 3), hit(0, 5)]);
        expect(state.turns.at(-1)!.type).toBe('ballsback');
        expect(state.activeTeamIndex).toBe(0);
        expect(state.round.ballsBack).toBe(true);
        expect(getAllowedThrowers(state)).toEqual([0, 1]);
        expect(canReRack(state)).toBe(false);
    });

    it('wertet zwei Baelle im selben Becher als Bombe mit 3 Bechern, aufgeteilt auf beide Werfer', () => {
        const before = play(DUO, [hit(0, 4)]);
        expect(previewHit(before, 4, false, 1)).toMatchObject({ type: 'bomb', extrasNeeded: 2 });
        const state = play(DUO, [hit(0, 4), hit(1, 4, { extraCups: [1, 2] })]);
        expect(state.turns.at(-1)!.type).toBe('bomb');
        expect(getPlayerPoints(state)[0]).toEqual([1.5, 1.5]);
        expect(state.activeTeamIndex).toBe(0);           // Bombe = Balls Back
        expect(state.racks[1].hit).toEqual([1, 2, 4]);
    });

    it('zaehlt einen Bouncer vor der Bombe als Extra-Becher (4 Becher, 2,5 + 1,5)', () => {
        const before = play(DUO, [hit(0, 4, { bouncer: true, extraCups: [7] })]);
        expect(previewHit(before, 4, false, 1).extrasNeeded).toBe(2);
        const state = play(DUO, [hit(0, 4, { bouncer: true, extraCups: [7] }), hit(1, 4, { extraCups: [8, 9] })]);
        expect(getPlayerPoints(state)[0]).toEqual([2.5, 1.5]);
        expect(state.racks[1].hit).toEqual([4, 7, 8, 9]);
    });

    it('gibt beim Bouncer in den Bombenbecher dem Bomber den Extra-Becher', () => {
        const before = play(DUO, [hit(0, 4)]);
        expect(previewHit(before, 4, true, 1)).toMatchObject({ type: 'bomb', extrasNeeded: 3 });
        const state = play(DUO, [hit(0, 4), hit(1, 4, { bouncer: true, extraCups: [1, 2, 3] })]);
        expect(state.turns.at(-1)).toMatchObject({ type: 'bomb', data: { cupIndex1: 4, cupIndex4: 3, bouncer: true } });
        expect(getPlayerPoints(state)[0]).toEqual([1.5, 2.5]);
        expectPointsMatchCups(state);
    });

    it('verlangt beim Bouncer einen zweiten Becher', () => {
        expectError(DUO, [hit(0, 4, { bouncer: true })]);
        const state = play(DUO, [hit(0, 4, { bouncer: true, extraCups: [9] })]);
        expect(state.turns[0].type).toBe('bouncer');
        expect(getPlayerPoints(state)[0][0]).toBe(2);
    });

    it('laesst Zusatzbecher nie den letzten Becher nehmen', () => {
        // Team 1 auf 2 Becher runter, dann Bouncer: nur der getroffene Becher faellt
        const state = play(SOLO, [
            hit(0, 0), hit(0, 1), hit(0, 2), hit(0, 3), hit(0, 4), hit(0, 5), hit(0, 6), hit(0, 7),
        ]);
        expect(getStandingCups(state.racks[1])).toHaveLength(2);
        expect(previewHit(state, 8, true).extrasNeeded).toBe(0);
        expect(previewHit(state, 8, false)).toMatchObject({ extrasNeeded: 0 });
    });

    it('kennt im 1 gegen 1 kein Heating Up / On Fire, der Spieler wirft beide Baelle', () => {
        const state = play(SOLO, [hit(0, 0), miss(0), miss(0), miss(0), hit(0, 1), miss(0), miss(0), miss(0), hit(0, 2)]);
        expect(state.turns.every(turn => turn.type !== 'onfire')).toBe(true);
        expect(getAllowedThrowers(state)).toEqual([0]);
    });

    it('macht im 2 gegen 2 beim dritten Treffer in Folge On Fire und laesst weiterwerfen', () => {
        const state = play(DUO, [
            hit(0, 0), hit(1, 1),                   // Balls Back
            hit(0, 2), hit(1, 3),                   // Balls Back
            hit(0, 4),
        ]);
        expect(state.turns.at(-1)!.type).toBe('onfire');
        expect(getAllowedThrowers(state)).toEqual([0]);
        expect(state.banner).toBe('on-fire');
    });

    it('beendet die Serie, sobald das andere Team an den Wurf kommt', () => {
        const state = play(DUO, [
            hit(0, 0), miss(1), miss(0), miss(1),
            hit(0, 1), miss(1), miss(0), miss(1),
            hit(0, 2),
        ]);
        expect(state.turns.at(-1)!.type).toBe('hit');
        expect(state.streaks[0][0]).toBe(1);
    });

    it('startet mit einem Trickshot-Treffer eine neue Serie des Faengers', () => {
        const state = play(DUO, [
            hit(0, 0), hit(1, 1),                   // Balls Back, Spieler 1 hat 1 Treffer
            hit(0, 2), { type: 'trickshot', player: 1, catcher: 0, time: 0 }, hit(0, 3),
        ]);
        expect(state.turns.at(-1)!.type).toBe('ballsback');
        expect(state.streaks[0]).toEqual([1, 0]);
    });

    it('spielt On Fire zuerst aus und gibt danach durch Balls Back beiden noch einen Wurf', () => {
        const state = play(DUO, [
            hit(0, 0), hit(1, 1),
            hit(0, 2), { type: 'trickshot', player: 1, catcher: 1, time: 0 }, hit(1, 3),   // Serie von Spieler 1 neu
            hit(0, 4), hit(0, 5), miss(0),          // On Fire bis zum Fehlwurf
            hit(1, 6),                               // zweiter Ball trifft -> Balls Back
        ]);
        expect(state.activeTeamIndex).toBe(0);
        expect(state.round.ballsBack).toBe(true);
        expect(getAllowedThrowers(state)).toEqual([0, 1]);
    });

    it('beendet den Ball nach dem letzten Becher auch bei On Fire: den Doppeltreffer wirft ein anderer Ball', () => {
        // Team 0 raeumt per Balls Back bis auf einen Becher ab, Spieler 0 ist On Fire
        const base: KnechtAction[] = [hit(0, 0), hit(1, 1), hit(0, 2), hit(1, 3), hit(0, 4), hit(0, 5), hit(0, 6), hit(0, 7), hit(0, 8)];
        const before = play(DUO, base);
        expect(getStandingCups(before.racks[1])).toEqual([9]);
        const state = play(DUO, [...base, hit(0, 9)]);
        expect(state.turns.at(-1)!.type).toBe('lastCup');
        expect(getAllowedThrowers(state)).toEqual([1]);
        expect(getHittableCups(state)).toEqual([9]);
        expectError(DUO, [...base, hit(0, 9), hit(0, 9)]);
        const won = play(DUO, [...base, hit(0, 9), hit(1, 9)]);
        expect(won.endReason).toBe('doubleLastCup');
    });

    it('laesst beim Trickshot den Faenger werfen und gibt ihm den Punkt', () => {
        const state = play(DUO, [{ type: 'trickshot', player: 0, catcher: 1, time: 0 }, hit(1, 6)]);
        expect(state.turns[0]).toMatchObject({ type: 'trickshot', playerIndex: 0, data: { catcherIndex: 1 } });
        expect(getPlayerPoints(state)[0]).toEqual([0, 1]);
        // Der Ball gehoert weiter Spieler 0, Ball 2 wirft Spieler 1
        expect(getAllowedThrowers(state)).toEqual([1]);
    });

    it('erlaubt Re-Rack nur vor dem ersten Wurf, bei 3/4/6 Bechern und hoechstens zweimal', () => {
        let actions: KnechtAction[] = [hit(0, 0), hit(1, 1), hit(0, 2), hit(1, 3), miss(0), miss(1)];
        let state = play(DUO, actions);
        expect(getStandingCups(state.racks[1])).toHaveLength(6);
        actions = [...actions, miss(0), miss(1)];            // Team 1 wirft, danach wieder Team 0
        state = play(DUO, actions);
        expect(canReRack(state)).toBe(true);
        state = play(DUO, [...actions, { type: 'reRack', time: 0 }]);
        expect(getStandingCups(state.racks[1])).toEqual([0, 1, 2, 3, 4, 5]);
        expect(state.reRacksLeft[0]).toBe(1);
        expect(canReRack(state)).toBe(false);                // schon in Formation
        expect(play(DUO, [...actions, miss(0)]).round.throwCount).toBe(1);
        expect(canReRack(play(DUO, [...actions, miss(0)]))).toBe(false);
    });

    it('stellt den letzten Becher an die Pyramidenspitze', () => {
        const state = play(SOLO, [hit(0, 1), hit(0, 2), hit(0, 3), hit(0, 4), hit(0, 5), hit(0, 6), hit(0, 7), hit(0, 8), hit(0, 0), miss(0), miss(0), miss(0)]);
        expect(getStandingCups(state.racks[1])).toEqual([0]);
    });

    it('gewinnt sofort, wenn ein weiterer Ball den letzten Becher trifft', () => {
        const state = play(SOLO, [...soloClearWithFirstBall(), hit(0, 0)]);
        expect(state.status).toBe('over');
        expect(state.winnerTeamIndex).toBe(0);
        expect(state.endReason).toBe('doubleLastCup');
        expectPointsMatchCups(state);
    });

    it('erlaubt nach dem letzten Becher nur noch Wuerfe auf diesen Becher', () => {
        const state = play(SOLO, soloClearWithFirstBall());
        expect(getHittableCups(state)).toEqual([0]);
    });

    it('gibt dem Gegner nach dem letzten Becher den Nachwurf (Gentleman\'s Rule)', () => {
        const state = play(SOLO, [...soloClearWithFirstBall(), miss(0)]);
        expect(state.status).toBe('playing');
        expect(state.nachwurfTeamIndex).toBe(1);
        expect(state.activeTeamIndex).toBe(1);
        expect(state.banner).toBe('nachwurf');
    });

    it('laesst im Nachwurf werfen, bis verfehlt wird, und beendet dann das Spiel', () => {
        const state = play(SOLO, [...soloClearWithFirstBall(), miss(0), hit(0, 0), hit(0, 1), miss(0)]);
        expect(state.status).toBe('playing');
        expect(getAllowedThrowers(state)).toEqual([0]);
        const end = play(SOLO, [...soloClearWithFirstBall(), miss(0), hit(0, 0), hit(0, 1), miss(0), hit(0, 2), miss(0)]);
        expect(end.status).toBe('over');
        expect(end.winnerTeamIndex).toBe(0);
        expect(end.endReason).toBe('cleared');
        expectPointsMatchCups(end);
    });

    const nachwurfEqualizer = (): KnechtAction[] => [
        ...soloClearWithFirstBall(), miss(0),
        // Team 1 hat 0 Becher getroffen: im Nachwurf alle 10 treffen
        hit(0, 0), hit(0, 1), hit(0, 2), hit(0, 3), hit(0, 4), hit(0, 5), hit(0, 6), hit(0, 7), hit(0, 8), hit(0, 9),
    ];

    it('geht bei Ausgleich im Nachwurf in die Verlaengerung mit 2x3 Bechern, ohne Re-Racks', () => {
        // Der letzte Becher beendet den Ball, der zweite Ball verfehlt -> Ausgleich
        const state = play(SOLO, [...nachwurfEqualizer(), miss(0)]);
        expect(state.overtimeCount).toBe(1);
        expect(state.activeTeamIndex).toBe(0);               // wer vorgelegt hat, beginnt
        expect(getStandingCups(state.racks[0])).toEqual([0, 1, 2]);
        expect(getStandingCups(state.racks[1])).toEqual([0, 1, 2]);
        expect(state.reRacksLeft).toEqual([0, 0]);
        expect(state.banner).toBe('overtime');
    });

    it('erlaubt die Bombe auch im Nachwurf, danach wirft der Bomber weiter', () => {
        const state = play(SOLO, [...soloClearWithFirstBall(), miss(0), hit(0, 4), miss(0), hit(0, 4, { extraCups: [5, 6] })]);
        expect(state.turns.at(-1)!.type).toBe('bomb');
        expect(state.nachwurfTeamIndex).toBe(1);
        expect(getAllowedThrowers(state)).toEqual([0]);
        expect(state.round.ballsDone).toBe(1);
        expect(getPlayerPoints(state)[1]).toEqual([3]);
    });

    it('gewinnt den Nachwurf sofort mit einem weiteren Ball im letzten Becher', () => {
        const state = play(SOLO, [...nachwurfEqualizer(), hit(0, 9)]);
        expect(state.status).toBe('over');
        expect(state.winnerTeamIndex).toBe(1);
        expect(state.endReason).toBe('nachwurfDouble');
        expectPointsMatchCups(state);
    });

    it('wertet beim Deathcup alle uebrigen Becher fuer den Werfer und beendet das Spiel', () => {
        const state = play(DUO, [hit(0, 0), miss(1), { type: 'deathcup', player: 1, time: 0 }]);
        expect(state.status).toBe('over');
        expect(state.winnerTeamIndex).toBe(1);
        expect(getPlayerPoints(state)[1]).toEqual([0, 10]);
        expectPointsMatchCups(state);
    });

    it('gibt eigene runtergeworfene Becher dem Gegner, aufgeteilt auf dessen Spieler', () => {
        const state = play(DUO, [{ type: 'ownCup', team: 0, player: 1, cups: [3], time: 0 }]);
        expect(getPlayerPoints(state)[1]).toEqual([0.5, 0.5]);
        expect(state.racks[0].hit).toEqual([3]);
        expectPointsMatchCups(state);
    });

    it('rundet am Spielende auf ganze Treffer, die Teamsumme bleibt gleich', () => {
        // Bombe 1,5 + 1,5, danach Deathcup: Team 0 hat 3 + 7 Becher
        const state = play(DUO, [hit(0, 4), hit(1, 4, { extraCups: [1, 2] }), { type: 'deathcup', player: 0, time: 0 }]);
        expect(getPlayerPoints(state)[0]).toEqual([8.5, 1.5]);
        expect(getFinalPlayerPoints(state)[0]).toEqual([9, 1]);
        const ownCups = play({ playerCounts: [3, 1], startTeamIndex: 1 }, [
            { type: 'ownCup', team: 1, player: 0, cups: [1, 2], time: 0 }, { type: 'deathcup', player: 0, time: 0 },
        ]);
        expect(getPlayerPoints(ownCups)[0].reduce((a, b) => a + b, 0)).toBeCloseTo(2);
        expect(getFinalPlayerPoints(ownCups)[0]).toEqual([1, 1, 0]);
        expect(getFinalPlayerPoints(ownCups)[1]).toEqual([10]);
        expect(getFinalPlayerPoints(play(DUO, [hit(0, 4)]))[0]).toEqual([1, 0]);
    });

    it('gibt beim letzten eigenen Becher dem Gegner den Sieg nicht sofort, sondern dem Team den Nachwurf', () => {
        const state = play(SOLO, [
            { type: 'ownCup', team: 1, player: 0, cups: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], time: 0 },
        ]);
        expect(state.status).toBe('playing');
        expect(state.cleared).toEqual([true, false]);
        expect(state.nachwurfTeamIndex).toBe(1);
        expect(state.activeTeamIndex).toBe(1);
        expect(state.banner).toBe('nachwurf');
        const end = play(SOLO, [{ type: 'ownCup', team: 1, player: 0, cups: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], time: 0 }, miss(0), miss(0)]);
        expect(end.status).toBe('over');
        expect(end.winnerTeamIndex).toBe(0);
        expect(end.endReason).toBe('cleared');
        expectPointsMatchCups(end);
    });

    it('beendet den eigenen Zug, wenn das werfende Team den letzten eigenen Becher umstoesst', () => {
        const state = play(DUO, [hit(0, 0), { type: 'ownCup', team: 0, player: 1, cups: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], time: 0 }]);
        expect(state.racks[1].hit).toEqual([0]);
        expect(state.nachwurfTeamIndex).toBe(0);
        expect(state.activeTeamIndex).toBe(0);
        expect(state.round.throwCount).toBe(0);
        expect(getAllowedThrowers(state)).toEqual([0, 1]);
    });

    it('geht in die Verlaengerung, wenn im Nachwurf des Gegners der letzte eigene Becher faellt', () => {
        const state = play(SOLO, [...soloClearWithFirstBall(), miss(0), { type: 'ownCup', team: 0, player: 0, cups: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], time: 0 }]);
        expect(state.overtimeCount).toBe(1);
        expect(state.activeTeamIndex).toBe(0);
        expect(state.status).toBe('playing');
    });

    it('stellt nach einem eigenen Becher den einzelnen Restbecher sofort an die Spitze', () => {
        const state = play(DUO, [{ type: 'ownCup', team: 1, player: 0, cups: [0, 1, 2, 3, 4, 5, 6, 7, 9], time: 0 }]);
        expect(getStandingCups(state.racks[1])).toEqual([0]);
        expect(getHittableCups(state)).toEqual([0]);
    });

    it('gibt dem Sieger bei Punktgleichstand einen Siegpunkt', () => {
        // Team 0 raeumt ab, Team 1 trifft im Nachwurf 9 und wirft dann einen Deathcup
        const state = play(SOLO, [
            ...soloClearWithFirstBall(), miss(0),
            hit(0, 0), hit(0, 1), hit(0, 2), hit(0, 3), hit(0, 4), hit(0, 5), hit(0, 6), hit(0, 7), hit(0, 8),
            { type: 'deathcup', player: 0, time: 0 },
        ]);
        expect(state.winnerTeamIndex).toBe(1);
        expect(state.victoryBonus).toBe(1);
        expectPointsMatchCups(state);
    });

    it('akzeptiert keine Airballs mit Becher und keine Aktionen nach Spielende', () => {
        expectError(SOLO, [{ type: 'throw', player: 0, outcome: 'airball', cup: 3, time: 0 }]);
        expectError(SOLO, [...soloClearWithFirstBall(), hit(0, 0), airball(0)]);
    });
});
