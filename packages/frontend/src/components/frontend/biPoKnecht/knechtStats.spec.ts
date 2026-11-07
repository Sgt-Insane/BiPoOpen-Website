import { describe, it, expect } from 'vitest';
import { getKnechtCareerStats, getTurnCups, getTurnStats } from './knechtStats';

const turn = (teamIndex: number, playerIndex: number, type: Turn['type'], data: Record<string, unknown> = {}): Turn =>
    ({ teamIndex, playerIndex, type, data, time: 0 } as Turn);

const match = (names: [string[], string[]], scores: [number[], number[]], turns: Turn[]): Match => ({
    _id: 'placeholder',
    team1: { _id: 'a', players: names[0].map((name, index) => ({ _id: name, name, score: scores[0][index] })) },
    team2: { _id: 'b', players: names[1].map((name, index) => ({ _id: name, name, score: scores[1][index] })) },
    turns,
});

describe('Knecht-Statistik', () => {
    it('zaehlt Wuerfe, Treffer, Serien und Sonderwuerfe je Spieler', () => {
        const game = match([['Alice', 'Bob'], ['Chris', 'Dana']], [[3, 1], [0, 0]], [
            turn(0, 0, 'hit', { cupIndex: 0 }), turn(0, 1, 'ballsback', { cupIndex1: 1 }),
            turn(0, 0, 'bouncer', { cupIndex1: 2, cupIndex2: 3 }), turn(0, 1, 'trickshot', { catcherIndex: 0 }), turn(0, 0, 'hit', { cupIndex: 4 }),
            turn(1, 0, 'airball'), turn(1, 1, 'owncup', { cups: [5] }),
        ]);
        const [alice, bob, chris, dana] = getTurnStats(game, game.turns!, [[3, 1], [0, 0]]);
        expect(alice).toMatchObject({ throws: 3, hits: 3, bouncers: 1, trickshotCatches: 1, trickshotHits: 1, bestStreak: 2, points: 3 });
        expect(bob).toMatchObject({ throws: 2, hits: 1, misses: 1, ballsBacks: 1 });
        expect(chris).toMatchObject({ throws: 1, airballs: 1 });
        expect(dana).toMatchObject({ throws: 0, ownCups: 1 });
    });

    it('fasst alle Knecht-Spiele eines Spielers zusammen und ignoriert Spiele ohne Verlauf', () => {
        const games = [
            match([['Alice'], ['Chris']], [[10], [4]], [turn(0, 0, 'hit', { cupIndex: 0 }), turn(0, 0, 'bomb', { cupIndex1: 0, cupIndex2: 1 }), turn(1, 0, 'miss')]),
            match([['Chris'], ['alice']], [[10], [6]], [turn(1, 0, 'miss'), turn(1, 0, 'hit', { cupIndex: 3 }), turn(0, 0, 'deathcup', { cups: [1, 2] })]),
            match([['Alice'], ['Chris']], [[10], [0]], []),
        ];
        const stats = getKnechtCareerStats(games, 'Alice')!;
        expect(stats).toMatchObject({ games: 2, wins: 1, points: 16, throws: 4, hits: 3, bombs: 1, bestStreak: 2 });
        expect(getKnechtCareerStats(games, 'Niemand')).toBeNull();
    });

    it('verkraftet alte Knecht-Spiele, deren Nullwurf, Airball und Trickshot keine data haben', () => {
        const legacy = (teamIndex: number, playerIndex: number, type: Turn['type']): Turn => ({ teamIndex, playerIndex, type, time: 0 } as unknown as Turn);
        const game = match([['Alice'], ['Chris']], [[10], [3]], [
            legacy(0, 0, 'miss'), legacy(0, 0, 'airball'), legacy(1, 0, 'trickshot'), turn(1, 0, 'hit', { cupIndex: 2 }), legacy(0, 0, 'lastCup'),
        ]);
        const stats = getKnechtCareerStats([game], 'Alice')!;
        expect(stats).toMatchObject({ games: 1, wins: 1, throws: 3, hits: 1, misses: 1, airballs: 1, lastCups: 1 });
        expect(game.turns!.map(getTurnCups)).toEqual([0, 0, 0, 1, 1]);
    });
});
