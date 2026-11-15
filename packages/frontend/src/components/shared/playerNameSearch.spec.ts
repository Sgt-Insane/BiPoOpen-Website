import { describe, it, expect } from 'vitest';
import { rankPlayerNames } from './playerNameSearch';

const names = ['Thomas Mann', 'Matthias Weck', 'Weck', 'Simon Weck', 'David Jones', 'Jonas Weck'];
const counts = { 'Matthias Weck': 200, 'Simon Weck': 345, 'Jonas Weck': 343, 'Weck': 1, 'Thomas Mann': 50, 'David Jones': 3 };

describe('Spielersuche', () => {
    it('stellt Wortanfaenge vor Treffer mitten im Wort', () => {
        expect(rankPlayerNames(names, 'ma', counts)).toEqual(['Matthias Weck', 'Thomas Mann']);
    });

    it('sortiert Vor- und Nachnamen-Treffer nach Spielen', () => {
        expect(rankPlayerNames(names, 'Weck', counts)).toEqual(['Simon Weck', 'Jonas Weck', 'Matthias Weck', 'Weck']);
    });

    it('findet Nachnamen hinter den aktiven Vornamen-Treffern', () => {
        expect(rankPlayerNames(names, 'jo', counts)).toEqual(['Jonas Weck', 'David Jones']);
    });
});
