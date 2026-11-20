import { describe, it, expect } from 'vitest';
import { buildCupChart, CUP_CHART, getCupChartMoments } from './cupChart';
import { getShortPlayerName } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';

// Feste Zeichenbreite statt echter Schrift
const measure = (text: string, _weight: number, size: number) => text.length * size * .6;

const START = 1_700_000_000_000;
const turn = (type: Turn['type'], teamIndex: number, playerIndex: number, second: number, data: Record<string, unknown> = { cupIndex1: 0 }): Turn =>
    ({ type, teamIndex, playerIndex, time: START + second * 1000, data } as Turn);

const makeMatch = (turns: Turn[], events: MatchEvent[] = [], names: [string[], string[]] = [['Jonas Weck', 'Leon Rose'], ['Matthias Weck', 'Matthias Gunter']]): Match => ({
    _id: 'm1',
    time: START,
    endTime: START + 600_000,
    team1: { players: names[0].map(name => ({ name, score: 0 })) },
    team2: { players: names[1].map(name => ({ name, score: 0 })) },
    turns,
    events,
} as unknown as Match);

describe('Becherverlauf: besondere Momente', () => {
    it('zeigt nur den entscheidenden letzten Becher, nicht die vor einer Verlaengerung', () => {
        const turns = [
            turn('lastCup', 0, 0, 100),
            turn('lastCup', 1, 0, 120),
            turn('hit', 0, 1, 200),
            turn('lastCup', 1, 1, 300),
        ];
        const match = makeMatch(turns, [{ kind: 'overtime', teamIndex: 0, afterTurnIndex: 2, time: START + 150_000 } as MatchEvent]);
        const lastCups = getCupChartMoments(match).filter(moment => moment.title === 'Letzter Becher');
        expect(lastCups.map(moment => moment.rowKey)).toEqual([3]);
    });

    it('fasst gleiche Momente desselben Spielers kurz hintereinander zusammen', () => {
        const match = makeMatch([turn('ballsback', 1, 0, 140), turn('ballsback', 1, 0, 150), turn('ballsback', 1, 1, 160)]);
        const moments = getCupChartMoments(match).filter(moment => moment.title === 'Balls Back');
        expect(moments.map(moment => [moment.playerIndex, moment.count])).toEqual([[0, 2], [1, 1]]);
    });

    it('zeigt Re-Racks als Moment des Teams, das es verlangt hat', () => {
        const match = makeMatch([turn('hit', 0, 0, 10), turn('hit', 1, 0, 20)], [{ kind: 'reRack', teamIndex: 1, afterTurnIndex: 1, time: START + 15_000 } as MatchEvent]);
        expect(getCupChartMoments(match).map(moment => [moment.title, moment.teamIndex, moment.rowKey])).toEqual([['Re-Rack', 1, 0]]);
    });

    it('nimmt Nachwurf und Ausgleich nicht als Moment', () => {
        const match = makeMatch([turn('hit', 0, 0, 10), turn('hit', 1, 0, 20)], [{ kind: 'nachwurf', teamIndex: 1, afterTurnIndex: 1 } as MatchEvent]);
        expect(getCupChartMoments(match)).toEqual([]);
    });
});

describe('Kurznamen', () => {
    it('kuerzt Spieler auf den Vornamen, bei gleichem Vornamen mit Initiale', () => {
        const match = makeMatch([]);
        expect(getShortPlayerName(match, 0, 0)).toBe('Jonas');
        expect(getShortPlayerName(match, 1, 0)).toBe('Matthias W.');
    });

    it('kuerzt Liga-Teams nie', () => {
        const match = { ...makeMatch([], [], [['JP Burgundy'], ['Litter Leo']]), season: 'saison-1' } as Match;
        expect(getShortPlayerName(match, 0, 0)).toBe('JP Burgundy');
        expect(getShortPlayerName(match, 1, 0)).toBe('Litter Leo');
    });
});

describe('Becherverlauf: Auslegung', () => {
    it('schreibt die Teamnamen in der Legende aus, immer in einer Zeile und bei Platzmangel kleiner', () => {
        const match = makeMatch([turn('hit', 0, 0, 10)], [], [['Jonas Weck', 'Linda Jahberg'], ['Giulia Sanio', 'Leo Straub']]);
        const wide = buildCupChart(match, 600, measure)!;
        expect(wide.legend.map(item => item.name)).toEqual(['Jonas Weck & Linda Jahberg', 'Giulia Sanio & Leo Straub']);
        expect(wide.legend.map(item => item.size)).toEqual([12, 12]);

        const narrow = buildCupChart(match, 300, measure)!;
        expect(narrow.legend.map(item => item.name)).toEqual(['Jonas Weck & Linda Jahberg', 'Giulia Sanio & Leo Straub']);
        expect(new Set(narrow.legend.map(item => item.y)).size).toBe(1);
        expect(narrow.legend[0].size).toBeLessThan(12);
        expect(narrow.legend[0].size).toBe(narrow.legend[1].size);
        // Zweiter Name endet innerhalb der Breite
        const second = narrow.legend[1];
        expect(second.x + 20 + measure(second.name, 700, second.size)).toBeLessThanOrEqual(300);
    });

    it('nennt im Doppel den Spieler in der Fahne', () => {
        const chart = buildCupChart(makeMatch([turn('bomb', 0, 1, 30, { cupIndex1: 0, cupIndex2: 1 })]), 360, measure)!;
        expect(chart.notes[0].label).toBe('Bombe · Leon');
        expect(chart.notes[0].clock).toBe('0:30');
    });

    const busyTurns = () => {
        const turns = Array.from({ length: 30 }, (_, index) => turn(index % 3 ? 'ballsback' : 'bouncer', index % 2, index % 2, index * 20));
        turns.push(turn('deathcup', 0, 0, 590, { cups: [0, 1, 2] }));
        return turns;
    };
    const rowsOf = (chart: NonNullable<ReturnType<typeof buildCupChart>>) => new Set(chart.notes.map(note => note.top)).size;

    it('verkleinert bei vielen Momenten die unwichtigen zuerst, statt beliebig viele Zeilen zu stapeln', () => {
        const chart = buildCupChart(makeMatch(busyTurns()), 320, measure)!;
        expect(rowsOf(chart)).toBeLessThanOrEqual(CUP_CHART.maxNoteRows);
        expect(chart.notes.find(note => note.icon === 'deathcup')!.label).toContain('Deathcup');
        expect(chart.notes.some(note => !note.label)).toBe(true);
    });

    it('blendet bei vielen Momenten auf einer Stelle die unwichtigsten aus, der wichtigste bleibt beschriftet', () => {
        // Alle Wuerfe nach dem gespeicherten Spielende: alles landet am rechten Rand
        const turns = busyTurns().map(entry => ({ ...entry, time: START + 700_000 }));
        const chart = buildCupChart(makeMatch(turns), 320, measure)!;
        expect(rowsOf(chart)).toBeLessThanOrEqual(CUP_CHART.maxNoteRows);
        expect(chart.notes.find(note => note.icon === 'deathcup')!.label).toContain('Deathcup');
    });
});
