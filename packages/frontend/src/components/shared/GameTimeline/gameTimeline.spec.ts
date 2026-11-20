import { describe, it, expect } from 'vitest';
import { buildGameTimeline, getBlowoutHighlight, getNakedMileHighlight, getSessionHighlights, getSessionRecords, getUnbeatenHighlight, type GameSession } from './gameTimeline';

// Becher eines Teams auf die Spieler verteilen: 9 im Doppel -> 5 und 4
const splitScore = (score: number, players: number, index: number) =>
    index === 0 ? score - (players - 1) * Math.floor(score / players) : Math.floor(score / players);

let gameId = 0;
const game = (time: string, team1: string[], score1: number, team2: string[], score2: number): Match => ({
    _id: String(++gameId),
    time: new Date(time).getTime(),
    team1: { _id: '', players: team1.map((name, index) => ({ _id: '', name, score: splitScore(score1, team1.length, index) })) },
    team2: { _id: '', players: team2.map((name, index) => ({ _id: '', name, score: splitScore(score2, team2.length, index) })) },
});

describe('buildGameTimeline', () => {
    it('macht aus einem Abend mit vielen Spielen einen Block, neueste zuerst', () => {
        const games = [
            game('2026-11-18T19:00', ['A'], 10, ['B'], 5),
            ...[20, 21, 22, 23].map(hour => game(`2026-11-19T${hour}:00`, ['A', 'B'], 10, ['C', 'D'], 8)),
            game('2026-11-20T00:30', ['C', 'D'], 10, ['A', 'B'], 9),
        ];

        const timeline = buildGameTimeline(games);

        expect(timeline.map(entry => entry.kind)).toEqual(['session', 'singles']);
        expect(timeline[0]).toMatchObject({ kind: 'session', games: { length: 5 } });
        expect((timeline[0] as GameSession).day.getDate()).toBe(19);
    });

    it('wertet im Doppel das Ergebnis fuer beide Spieler', () => {
        const games = [20, 21, 22, 23].map(hour => game(`2026-11-19T${hour}:00`, ['A', 'B'], 10, ['C', 'D'], 8));
        games.push(game('2026-11-19T23:30', ['C', 'D'], 10, ['A', 'B'], 9));

        const [session] = buildGameTimeline(games) as GameSession[];

        expect(session.records.map(record => [record.name, record.wins, record.losses])).toEqual([
            ['A', 4, 1], ['B', 4, 1], ['C', 1, 4], ['D', 1, 4],
        ]);
        // "meiste Siege" ist keine Geschichte, die Serie schon
        expect(getSessionHighlights(session, 'Spieler').map(highlight => highlight.text)).toEqual(['A gewinnt 4 Spiele in Folge']);
    });
});

describe('getSessionRecords mit resolveParticipant', () => {
    it('fuehrt Spieler und sein Liga-Team zu einem Eintrag zusammen, das Team als Unterpunkt', () => {
        const games = [
            game('2026-11-14T18:00', ['Jonas Weck'], 10, ['Simon Weck'], 8),
            game('2026-11-14T19:00', ['Hopfenstreife'], 10, ['Sgt. Insane'], 8),
            game('2026-11-14T20:00', ['Sgt. Insane'], 16, ['Hopfenstreife'], 15),
        ];
        const teams: Record<string, string> = { 'Hopfenstreife': 'Jonas Weck', 'Sgt. Insane': 'Matthias Weck' };
        const resolve = (name: string) => teams[name] ? { person: teams[name], alias: 'Liga' } : { person: name };

        const records = getSessionRecords(games, resolve);

        const jonas = records.find(record => record.name === 'Jonas Weck')!;
        expect(records.map(record => record.name)).not.toContain('Hopfenstreife');
        expect(jonas).toMatchObject({ wins: 2, losses: 1, results: ['W', 'W', 'L'] });
        expect(jonas.aliases).toEqual([{ name: 'Hopfenstreife', label: 'Liga', wins: 1, losses: 1 }]);
        expect(records.find(record => record.name === 'Simon Weck')!.aliases).toEqual([]);
    });
});

describe('Schlagzeilen', () => {
    const record = (name: string, wins: number, losses: number) => ({ name, wins, losses, results: [], hitDifference: 0, aliases: [] });

    it('nennt nur Ungeschlagene ab der Mindestzahl an Siegen', () => {
        expect(getUnbeatenHighlight([record('A', 3, 0), record('B', 1, 2)], 3)?.text).toBe('A bleibt ungeschlagen (3\u2060–\u20600)');
        expect(getUnbeatenHighlight([record('A', 2, 0), record('B', 2, 0)], 2)?.text).toBe('A & B bleiben ungeschlagen');
        expect(getUnbeatenHighlight([record('A', 2, 0), record('B', 2, 0), record('C', 2, 0)], 2, 'Spieler')?.text).toBe('3 Spieler bleiben ungeschlagen');
        expect(getUnbeatenHighlight([record('A', 2, 0)], 3)).toBeNull();
        expect(getUnbeatenHighlight([record('A', 5, 1)], 3)).toBeNull();
    });

    it('nennt nackte Meilen zuerst, auch im Doppel', () => {
        const games = [
            ...[18, 19, 20, 21, 22].map(hour => game(`2026-11-19T${hour}:00`, ['A'], 10, ['B'], 8)),
            { ...game('2026-11-19T23:00', ['C', 'D'], 10, ['E', 'F'], 4), team2: { _id: '', players: [{ _id: '', name: 'E', score: 4 }, { _id: '', name: 'F', score: 0 }] } },
        ];
        const [session] = buildGameTimeline(games) as GameSession[];

        expect(getSessionHighlights(session, 'Spieler')[0].text).toBe('Nackte Meile für F');
        expect(getNakedMileHighlight([game('2026-11-19T20:00', ['A'], 10, ['B'], 0), game('2026-11-19T21:00', ['C'], 10, ['D'], 0)])?.text)
            .toBe('Nackte Meilen für B & D');
    });

    it('nennt ein Spiel zu Null als solches', () => {
        expect(getBlowoutHighlight([game('2026-11-19T20:00', ['A'], 10, ['B'], 0)])?.text).toBe('Zu Null: A schlägt B 10:0');
        expect(getBlowoutHighlight([game('2026-11-19T20:00', ['A'], 10, ['B'], 3)])?.text).toBe('Deklassierung: A schlägt B 10:3');
        expect(getBlowoutHighlight([game('2026-11-19T20:00', ['A'], 10, ['B'], 5)])).toBeNull();
    });
});
