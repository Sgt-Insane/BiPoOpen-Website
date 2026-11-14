import { describe, it, expect } from 'vitest';
import { getAwards, type KnechtPlayerStats } from './KnechtUtilFunctions';

const player = (name: string, values: Partial<KnechtPlayerStats>): KnechtPlayerStats => ({
    teamIndex: 0, playerIndex: 0, name, points: 0, throws: 0, hits: 0, misses: 0, airballs: 0, bouncers: 0, bombs: 0,
    ballsBacks: 0, onFires: 0, trickshotCatches: 0, trickshotHits: 0, lastCups: 0, deathcups: 0, ownCups: 0, bestStreak: 0,
    ...values,
});

describe('Auszeichnungen', () => {
    it('gibt einen Titel dem Spieler, auf den er am besten passt, nicht dem zuerst geprueften', () => {
        const awards = getAwards([
            player('A', { throws: 10, hits: 6, points: 6, bestStreak: 4 }),
            player('B', { throws: 10, hits: 7, points: 7, bestStreak: 6 }),
        ]);
        expect(awards[1].title).toBe('Scharfschütze');
        expect(awards[0].title).not.toBe('Scharfschütze');
    });

    it('vergibt "Zielwasser vergessen" nicht, wenn alle schwach getroffen haben', () => {
        const awards = getAwards([
            player('A', { throws: 12, hits: 2, points: 2 }),
            player('B', { throws: 12, hits: 3, points: 3 }),
            player('C', { throws: 12, hits: 2, points: 2 }),
            player('D', { throws: 12, hits: 3, points: 3 }),
        ]);
        expect(awards.map(award => award.title)).not.toContain('Zielwasser vergessen');
    });

    it('nennt nur ueberdurchschnittliche Werfer "Solider Werfer"', () => {
        const awards = getAwards([
            player('Gut', { throws: 10, hits: 5, points: 5 }),
            player('Top', { throws: 10, hits: 5, points: 6 }),
            player('Schwach', { throws: 10, hits: 2, points: 2 }),
            player('Mittel', { throws: 10, hits: 3, points: 3 }),
        ]);
        const byName = Object.fromEntries(awards.map((award, index) => [['Gut', 'Top', 'Schwach', 'Mittel'][index], award.title]));
        expect(byName.Top).toBe('Becherräumer');
        expect(byName.Gut).toBe('Solider Werfer');
        expect(byName.Schwach).not.toBe('Solider Werfer');
        expect(byName.Mittel).not.toBe('Solider Werfer');
    });

    it('gibt allen ohne Becher "Nackt"', () => {
        const titles = getAwards([
            player('A', { throws: 8, hits: 0, points: 0 }),
            player('B', { throws: 8, hits: 0, points: 0 }),
            player('C', { throws: 8, hits: 6, points: 6 }),
        ]).map(award => award.title);
        expect(titles.slice(0, 2)).toEqual(['Nackt', 'Nackt']);
    });

    it('zeichnet aus, wer alle 10 Becher allein abraeumt (nicht im 1 gegen 1)', () => {
        const duo = getAwards([
            player('A', { teamIndex: 0, throws: 14, hits: 10, points: 10 }),
            player('B', { teamIndex: 0, playerIndex: 1, throws: 12, hits: 0, points: 0 }),
            player('C', { teamIndex: 1, throws: 12, hits: 4, points: 4 }),
        ]);
        expect(duo[0].title).toBe('10/10');
        const solo = getAwards([player('A', { teamIndex: 0, throws: 14, hits: 10, points: 10 }), player('C', { teamIndex: 1, throws: 12, hits: 4, points: 4 })]);
        expect(solo[0].title).not.toBe('10/10');
    });

    it('lobt immer die laengste Serie des Spiels', () => {
        const awards = getAwards([
            player('A', { throws: 10, hits: 6, points: 6, bestStreak: 3, bombs: 1 }),
            player('B', { throws: 10, hits: 5, points: 5, bestStreak: 2 }),
        ]);
        expect(awards[0]).toMatchObject({ title: 'Scharfschütze', detail: 'Längste Serie im Spiel: 3 Treffer in Folge' });
    });

    it('zeichnet ein Spiel ohne Fehlwurf aus', () => {
        const awards = getAwards([player('A', { throws: 10, hits: 10, points: 10 }), player('B', { teamIndex: 1, throws: 10, hits: 4, points: 4 })]);
        expect(awards[0]).toMatchObject({ title: 'Makellos', detail: '10/10 – jeder Wurf ein Treffer' });
    });

    it('vergibt jeden besonderen Titel hoechstens einmal', () => {
        const awards = getAwards([
            player('A', { throws: 8, hits: 4, points: 4, bombs: 1 }),
            player('B', { throws: 8, hits: 4, points: 4, bombs: 2 }),
        ]);
        expect(awards[1].title).toBe('Bombenleger');
        expect(awards[0].title).not.toBe('Bombenleger');
    });
});
