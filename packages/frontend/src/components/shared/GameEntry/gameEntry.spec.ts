import { describe, it, expect } from 'vitest';
import { applySidesToMatch, sidesToNewMatch, type GameEntrySide } from './gameEntry';

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
