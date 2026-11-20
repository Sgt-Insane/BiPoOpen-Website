import { describe, it, expect } from 'vitest';
import { getMatchdayHighlights, getMatchdayTable, getMatchdayTimeline, getRegularSeasonGames, type Matchday } from './LeagueMatchdays';
import type { GameSinglesDay } from '@/components/shared/GameTimeline/gameTimeline';

const at = (date: string) => new Date(date).getTime();

let gameId = 0;
const game = (time: string, team1: string, score1: number, team2: string, score2: number): Match => ({
    _id: String(++gameId),
    time: at(time),
    team1: { _id: '', players: [{ _id: '', name: team1, score: score1 }] },
    team2: { _id: '', players: [{ _id: '', name: team2, score: score2 }] },
});

// Liste wie in _League.vue: neueste zuerst
const newestFirst = (games: Match[]) => games.toReversed();

describe('getMatchdayTimeline', () => {
    it('trennt Spieltage von Einzelspielen und fasst Einzelspiele je Tag zusammen', () => {
        const games = [
            // Spieltag 1, geht ueber Mitternacht
            game('2026-10-03T20:00', 'A', 10, 'B', 5),
            game('2026-10-03T21:00', 'C', 10, 'D', 5),
            game('2026-10-03T23:00', 'A', 10, 'C', 5),
            game('2026-10-04T01:30', 'B', 10, 'D', 5),
            game('2026-10-04T02:00', 'C', 10, 'B', 5),
            // zwei Tage mit wenigen Spielen -> je ein Block Einzelspiele
            game('2026-10-05T19:00', 'A', 10, 'D', 5),
            game('2026-10-05T20:00', 'B', 10, 'C', 5),
            game('2026-10-07T20:00', 'C', 10, 'B', 5),
            // Spieltag 2
            ...['A', 'B', 'C', 'D', 'F'].map((team, index) => game(`2026-10-17T1${index}:00`, team, 10, 'E', 3)),
        ];

        const timeline = getMatchdayTimeline(newestFirst(games), 0);

        expect(timeline.map(entry => entry.kind)).toEqual(['session', 'singles', 'singles', 'session']);
        const [matchday2, singles2, singles1, matchday1] = timeline as [Matchday, GameSinglesDay, GameSinglesDay, Matchday];
        expect(matchday1.number).toBe(1);
        expect(matchday1.games).toHaveLength(5);
        expect(matchday1.day.getDate()).toBe(3);
        expect(singles1.games).toHaveLength(2);
        expect(singles1.day?.getDate()).toBe(5);
        expect(singles2.games).toHaveLength(1);
        expect(singles2.day?.getDate()).toBe(7);
        expect(matchday2.number).toBe(2);
        expect(matchday2.records[0]).toMatchObject({ name: 'A', wins: 1, losses: 0 });
        expect(matchday2.records.at(-1)).toMatchObject({ name: 'E', wins: 0, losses: 5, results: ['L', 'L', 'L', 'L', 'L'] });
    });

    it('ordnet Einzelspiele nach Mitternacht dem Kalendertag zu', () => {
        // 31.10.2026: zwei Spiele kurz nach Mitternacht stehen unter dem 31.10., nicht dem Vorabend
        const games = [game('2026-10-31T00:24', 'A', 10, 'B', 5), game('2026-10-31T00:53', 'C', 10, 'D', 5)];

        const [singles] = getMatchdayTimeline(newestFirst(games), 0) as GameSinglesDay[];
        expect(singles.games).toHaveLength(2);
        expect(singles.day?.getDate()).toBe(31);
    });

    it('wertet 4 Spiele an einem Abend als Spiele zwischendurch', () => {
        // 14.11.2026: 4 Spiele mit 6 Teams waren kein Spieltag
        const games = ['A', 'B', 'C', 'D'].map((team, index) => game(`2026-11-14T1${index}:00`, team, 10, 'E', 3));

        expect(getMatchdayTimeline(newestFirst(games), 0)).toMatchObject([{ kind: 'singles', games: { length: 4 } }]);
    });

    it('markiert Abende nach der Hauptrunde als Final 4', () => {
        const games = [
            game('2026-10-03T20:00', 'A', 10, 'B', 5),
            game('2026-10-03T21:00', 'B', 10, 'A', 5),
            game('2026-11-03T20:00', 'A', 10, 'B', 5),
        ];

        const timeline = getMatchdayTimeline(newestFirst(games), 2);

        expect(timeline).toHaveLength(2);
        expect(timeline[0]).toMatchObject({ kind: 'session', isFinalFour: true, number: 0 });
        expect(timeline[1]).toMatchObject({ kind: 'singles' });
    });
});

describe('getMatchdayTable', () => {
    it('zeigt die Platzveraenderung gegenueber vor dem Spieltag', () => {
        const players = ['A', 'B', 'C'].map(name => ({ name, logo: '' }));
        const games = [
            game('2026-10-03T20:00', 'A', 10, 'B', 5),
            game('2026-10-03T21:00', 'A', 10, 'C', 5),
            game('2026-10-03T22:00', 'B', 10, 'C', 5),
            game('2026-10-03T23:00', 'C', 10, 'B', 2),
            game('2026-10-03T23:30', 'D', 10, 'E', 5),
            // Spieltag 2: C zieht an B vorbei
            game('2026-10-17T20:00', 'C', 10, 'A', 5),
            game('2026-10-17T21:00', 'C', 10, 'B', 5),
            game('2026-10-17T22:00', 'A', 10, 'B', 5),
            game('2026-10-17T23:00', 'C', 10, 'A', 5),
            game('2026-10-17T23:30', 'D', 10, 'E', 5),
        ];
        const leagueGames = newestFirst(games);
        const timeline = getMatchdayTimeline(leagueGames, 0) as Matchday[];
        const regularGames = getRegularSeasonGames(leagueGames, 0);

        const firstTable = getMatchdayTable(regularGames, timeline[1], players);
        expect(firstTable.map(row => [row.name, row.change])).toEqual([['A', null], ['C', null], ['B', null]]);

        const secondTable = getMatchdayTable(regularGames, timeline[0], players);
        expect(secondTable.map(row => [row.name, row.position, row.change])).toEqual([['C', 1, 1], ['A', 2, -1], ['B', 3, 0]]);
    });
});

describe('getMatchdayHighlights', () => {
    const matchdayOf = (games: Match[]) => getMatchdayTimeline(newestFirst(games), 0)[0] as Matchday;

    it('nennt bis zu drei Geschichten in Prioritaet', () => {
        const matchday = matchdayOf([
            game('2026-10-03T20:00', 'A', 10, 'B', 8),
            game('2026-10-03T21:00', 'A', 16, 'C', 15),
            game('2026-10-03T22:00', 'B', 10, 'C', 2),
            game('2026-10-03T23:00', 'A', 10, 'D', 9),
            game('2026-10-03T23:30', 'E', 10, 'F', 9),
        ]);

        expect(getMatchdayHighlights(matchday, null).map(highlight => highlight.text)).toEqual([
            'A bleibt ungeschlagen (3\u2060–\u20600)',
            'Krimi: A schlägt C 16:15 n. V.',
            'Deklassierung: B schlägt C 10:2',
        ]);
    });

    it('nimmt ohne Verlaengerung die naechsten Geschichten', () => {
        const matchday = matchdayOf([
            game('2026-10-03T20:00', 'A', 10, 'B', 2),
            game('2026-10-03T21:00', 'A', 10, 'C', 9),
            game('2026-10-03T22:00', 'B', 10, 'C', 9),
            game('2026-10-03T23:00', 'D', 10, 'C', 9),
            game('2026-10-03T23:30', 'E', 10, 'F', 9),
        ]);
        expect(getMatchdayHighlights(matchday, null).map(highlight => highlight.kind)).toEqual(['unbeaten', 'blowout', 'winless']);
        expect(getMatchdayHighlights(matchday, null)[2].text).toBe('C geht leer aus (0\u2060–\u20603)');
    });

    it('zieht neuen Tabellenfuehrer und ungeschlagen zu einer Zeile zusammen', () => {
        const matchday = matchdayOf([
            game('2026-10-03T20:00', 'A', 10, 'B', 8),
            game('2026-10-03T21:00', 'A', 10, 'C', 9),
            game('2026-10-03T22:00', 'A', 10, 'D', 9),
            game('2026-10-03T23:00', 'B', 10, 'C', 9),
            game('2026-10-03T23:30', 'D', 10, 'C', 9),
        ]);
        const row = (name: string, position: number, change: number) => ({ name, position, change, wins: 0, losses: 0, withdrawn: false });
        const table = [row('A', 1, 2), row('B', 2, 5), row('C', 3, -1)];

        expect(getMatchdayHighlights(matchday, table).map(highlight => highlight.text)).toEqual([
            'A übernimmt ungeschlagen die Tabellenführung (3\u2060–\u20600)',
            'B springt 5 Plätze nach oben',
            'C geht leer aus (0\u2060–\u20603)',
        ]);
    });

    it('nennt keine Geschichte, wenn nichts Besonderes passiert ist', () => {
        const matchday = matchdayOf(['A', 'B', 'C', 'D', 'E'].map((team, index) => game(`2026-10-03T1${index}:00`, team, 10, `${team}2`, 8)));
        expect(getMatchdayHighlights(matchday, null)).toEqual([]);
    });
});
