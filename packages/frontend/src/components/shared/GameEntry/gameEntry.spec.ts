import { describe, it, expect } from 'vitest';
import { applySidesToMatch, isImpossibleScore, sidesToNewMatch, type GameEntrySide } from './gameEntry';

const sides = (name1?: string): GameEntrySide[] => [
    { name: name1, players: [{ name: 'Matthias', score: 6 }, { name: 'Simon', score: 4 }] },
    { players: [{ name: 'Lena', score: 3 }, { name: 'Jonas', score: 2 }] },
];

describe('gameEntry Teamname', () => {
    it('uebernimmt einen optionalen Teamnamen ins Spiel', () => {
        const match = sidesToNewMatch(sides('  Die Knechte  '));
        expect(match.team1.name).toBe('Die Knechte');
        expect(match.team2.name).toBeUndefined();
    });

    it('entfernt den Teamnamen, wenn er beim Bearbeiten geleert wird', () => {
        const match = sidesToNewMatch(sides('Die Knechte'));
        expect(applySidesToMatch(match, sides('')).team1.name).toBeUndefined();
        expect(applySidesToMatch(match, sides('Becherbande')).team1.name).toBe('Becherbande');
    });
});

describe('gameEntry unmoeglicher Spielstand', () => {
    it('laesst normale Spiele und Sonderfaelle unter 10 durch', () => {
        expect(isImpossibleScore(10, 7)).toBe(false);
        expect(isImpossibleScore(0, 10)).toBe(false);
        expect(isImpossibleScore(6, 4)).toBe(false);
    });
    it('laesst Verlaengerungen durch', () => {
        expect(isImpossibleScore(13, 10)).toBe(false);
        expect(isImpossibleScore(12, 13)).toBe(false);
        expect(isImpossibleScore(16, 14)).toBe(false);
    });
    it('blockiert Staende, die es nicht geben kann', () => {
        expect(isImpossibleScore(20, 16)).toBe(true);   // 2 gegen 2 mit je 10 Treffern
        expect(isImpossibleScore(12, 5)).toBe(true);    // ueber 10 ohne Verlaengerung
        expect(isImpossibleScore(11, 9)).toBe(true);
        expect(isImpossibleScore(13, 13)).toBe(true);
    });
});
