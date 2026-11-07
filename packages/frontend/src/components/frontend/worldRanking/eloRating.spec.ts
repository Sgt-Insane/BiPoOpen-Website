import { describe, it, expect } from 'vitest';
import {
    ELO_EXAMPLE_HITS, ELO_EXAMPLE_ROWS, ELO_MIN_GAMES, buildEloGames, computeElo, getEloDeltas, getEloMarginFactor, getEloMatchChanges,
} from './eloRating';

const established = (rating = 1000) => ({ rating, games: ELO_MIN_GAMES });

let nextId = 0;
const match = (players: [string[], string[]], hits: [number[], number[]], time: number): Match => ({
    _id: `m${nextId++}`,
    team1: { _id: 'a', players: players[0].map((name, index) => ({ _id: name, name, score: hits[0][index] })) },
    team2: { _id: 'b', players: players[1].map((name, index) => ({ _id: name, name, score: hits[1][index] })) },
    time,
});

const tournament = (name: string, trackPlayerShots: boolean, matches: Match[]) =>
    ({ name, settings: { trackPlayerShots }, groupPhase: { matches: [matches] }, koPhase: { matches: [] } } as unknown as Tournament);

describe('Elo-Formel', () => {
    it('gewichtet die Becher-Differenz, Verlaengerung zaehlt wie ein knapper Sieg', () => {
        expect(getEloMarginFactor(10, 9)).toBeCloseTo(0.8);
        expect(getEloMarginFactor(10, 0)).toBeCloseTo(2);
        expect(getEloMarginFactor(6, 3)).toBeCloseTo(getEloMarginFactor(10, 5));
        expect(getEloMarginFactor(13, 12)).toBeLessThan(getEloMarginFactor(10, 9));
    });

    it('rechnet Beispiele im Erklaer-Sheet mit Favoriten-Korrektur', () => {
        expect(ELO_EXAMPLE_ROWS.map(row => row.points)).toEqual([[2, 4, 5], [4, 6, 9], [6, 9, 14], [8, 13, 20], [11, 18, 27], [13, 22, 33], [16, 26, 39]]);
        expect(ELO_EXAMPLE_HITS.factors.map(factor => factor.toFixed(2))).toEqual(['1.20', '0.80']);
    });

    it('Einzel: Gewinner bekommt, was der Verlierer abgibt, ohne Ergebnis Faktor 1', () => {
        expect(getEloDeltas([[established()], [established()]], { winner: 0, scores: [10, 9] })).toEqual([[8], [-8]]);
        expect(getEloDeltas([[established()], [established()]], { winner: 1, scores: [0, 10] })).toEqual([[-20], [20]]);
        expect(getEloDeltas([[established()], [established()]], { winner: 0 })).toEqual([[10], [-10]]);
    });

    it('Neulinge starten mit doppeltem K, der Gegner bekommt seine normalen Punkte', () => {
        const deltas = (games: number) => getEloDeltas([[{ rating: 1000, games }], [established()]], { winner: 0, scores: [10, 9] });
        expect(deltas(0)).toEqual([[16], [-8]]);
        expect(deltas(ELO_MIN_GAMES / 2)).toEqual([[12], [-8]]);
        expect(deltas(ELO_MIN_GAMES)).toEqual([[8], [-8]]);
    });

    it('Doppel: Punkte nach Treffern verteilt, ohne Treffer gleich', () => {
        const sides = [[established(), established()], [established(), established()]];
        // 10:8 = 9,33 Punkte je Spieler
        expect(getEloDeltas(sides, { winner: 0, scores: [10, 8], hits: [[7, 3], [4, 4]] })).toEqual([[11, 7], [-9, -9]]);
        // Beim Verlierer verliert weniger, wer mehr getroffen hat
        expect(getEloDeltas(sides, { winner: 0, scores: [10, 8], hits: [[5, 5], [8, 0]] })).toEqual([[9, 9], [-5, -14]]);
        expect(getEloDeltas(sides, { winner: 0, scores: [10, 8] })).toEqual([[9, 9], [-9, -9]]);
    });
});

describe('Elo-Spiele', () => {
    it('BiPo Open 2020 ohne Becher-Differenz, Treffer nur wenn erfasst', () => {
        const { games } = buildEloGames({
            openGames: [match([['Alice', 'Bob'], ['Chris', 'Dana']], [[6, 4], [3, 5]], 3)],
            leagueGames: [],
            tournaments: [
                { tournament: tournament('Weck BiPo Open 2020', false, [match([['Alice', 'Bob'], ['Chris', 'Dana']], [[10, 0], [0, 0]], 1)]), time: 1 },
                { tournament: tournament('Weck BiPo Open 2023', true, [match([['Alice', 'Bob'], ['Chris', 'Dana']], [[4, 6], [2, 7]], 2)]), time: 2 },
            ],
        });
        expect(games.map(game => game.scores)).toEqual([undefined, [10, 9], [10, 8]]);
        expect(games.map(game => game.sides[0].hits)).toEqual([undefined, [4, 6], [6, 4]]);
    });

    it('Rangliste und Elo je Spiel rechnen gleich', () => {
        const eloGames = buildEloGames({
            openGames: [
                match([['Alice', 'Bob'], ['Chris', 'Dana']], [[7, 3], [5, 3]], 1),
                match([['Alice'], ['Chris']], [[10], [2]], 2),
                match([['Bob', 'Chris'], ['Alice', 'Dana']], [[6, 7], [10, 0]], 3),
            ],
            leagueGames: [],
            tournaments: [],
        });
        const ratings = new Map(computeElo(eloGames, 4, 'players').map(record => [record.key, record.rating]));
        const changes = getEloMatchChanges(eloGames);
        const last = eloGames.games[eloGames.games.length - 1];
        const average = (keys: string[]) => Math.round(keys.reduce((acc, key) => acc + ratings.get(key)!, 0) / keys.length);
        expect(changes.get(last.matchId!)!.map(side => side.rating)).toEqual(last.sides.map(side => average(side.players)));
    });
});
