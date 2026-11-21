import { describe, it, expect } from 'vitest';
import { getAwards, type KnechtPlayerStats } from './KnechtUtilFunctions';

const player = (name: string, values: Partial<KnechtPlayerStats>): KnechtPlayerStats => ({
    teamIndex: 0, playerIndex: 0, name, points: 0, throws: 0, hits: 0, misses: 0, airballs: 0, bouncers: 0, bombs: 0,
    ballsBacks: 0, onFires: 0, trickshotCatches: 0, trickshotHits: 0, lastCups: 0, deathcups: 0, ownCups: 0, bestStreak: 0, longestDrought: 0, edges: 0, penalties: 0,
    ...values,
});

describe('Auszeichnungen', () => {
    it('gibt einen Titel dem Spieler, auf den er am besten passt, nicht dem zuerst geprueften', () => {
        const awards = getAwards([
            player('A', { throws: 10, hits: 6, points: 6, bestStreak: 4 }),
            player('B', { throws: 10, hits: 6, points: 6, bestStreak: 6 }),
        ]);
        expect(awards[1]?.title).toBe('Scharfschütze');
        expect(awards[0]?.title).not.toBe('Scharfschütze');
    });

    it('vergibt "Zielwasser vergessen" nicht, wenn alle schwach getroffen haben', () => {
        const awards = getAwards([
            player('A', { throws: 12, hits: 2, points: 2 }),
            player('B', { throws: 12, hits: 3, points: 3 }),
            player('C', { throws: 12, hits: 2, points: 2 }),
            player('D', { throws: 12, hits: 3, points: 3 }),
        ]);
        expect(awards.map(award => award?.title)).not.toContain('Zielwasser vergessen');
    });

    it('gibt ohne besonderes Ereignis jedem seinen auffaelligsten Wert', () => {
        const awards = getAwards([
            player('A', { throws: 10, hits: 2, points: 2, bestStreak: 2, longestDrought: 5 }),
            player('B', { teamIndex: 1, throws: 10, hits: 2, points: 2, bestStreak: 1, longestDrought: 12 }),
        ]);
        expect(awards[0]).toMatchObject({ title: 'Lieferdienst', detail: '2 Becher an den Gegner geliefert · 2 in Folge' });
        expect(awards[1]).toMatchObject({ title: 'Langer Atem', detail: '12 Würfe am Stück ohne Treffer – drangeblieben' });
    });

    it('gibt jedem Spieler eine Auszeichnung, auch mit und ohne eigenes Handy in einem Team', () => {
        const awards = getAwards([
            player('Mit Handy', { throws: 30, hits: 8, points: 8, bestStreak: 2, longestDrought: 9 }),
            player('Ohne Handy', { playerIndex: 1, throws: 25, hits: 2, points: 2, bestStreak: 1, longestDrought: 8 }),
            player('Gegner 1', { teamIndex: 1, throws: 28, hits: 5, points: 5, bestStreak: 2, longestDrought: 11 }),
            player('Gegner 2', { teamIndex: 1, playerIndex: 1, throws: 27, hits: 4, points: 4, bestStreak: 2, longestDrought: 7 }),
        ]);
        expect(awards.every(award => award !== null)).toBe(true);
        expect(awards[0]?.title).toBe('Alleinunterhalter');        // seltener Titel vor Topscorer
    });

    it('nennt die laengste Durststrecke und die schlechteste Quote im Spiel', () => {
        const awards = getAwards([
            player('A', { throws: 40, hits: 4, points: 4, bestStreak: 1, longestDrought: 20 }),
            player('B', { teamIndex: 1, throws: 30, hits: 9, points: 9, bestStreak: 2, longestDrought: 6 }),
            player('C', { teamIndex: 1, playerIndex: 1, throws: 30, hits: 6, points: 6, bestStreak: 2, longestDrought: 8 }),
        ]);
        expect(awards[0]?.title).toMatch(/Durststrecke|Kalte Hand|Zielwasser vergessen/);
    });

    it('lobt im Team, wer fast alle Becher allein abraeumt', () => {
        const awards = getAwards([
            player('A', { teamIndex: 0, throws: 12, hits: 8, points: 8 }),
            player('B', { teamIndex: 0, playerIndex: 1, throws: 12, hits: 2, points: 2 }),
            player('C', { teamIndex: 1, throws: 12, hits: 3, points: 3 }),
        ]);
        expect(awards[0]).toMatchObject({ title: 'Alleinunterhalter', detail: '8 von 10 Bechern fürs Team' });
    });

    it('nennt den letzten Becher nur eiskalt, wenn es knapp war', () => {
        const close = getAwards([
            player('A', { teamIndex: 0, throws: 12, hits: 5, points: 10, lastCups: 1 }),
            player('B', { teamIndex: 1, throws: 12, hits: 4, points: 9 }),
        ]);
        expect(close[0]).toMatchObject({ title: 'Eiskalt', detail: 'Letzten Becher zum 10 : 9 versenkt' });
        const clear = getAwards([
            player('A', { teamIndex: 0, throws: 12, hits: 5, points: 10, lastCups: 1 }),
            player('B', { teamIndex: 1, throws: 12, hits: 4, points: 4 }),
        ]);
        expect(clear[0]?.title).not.toBe('Eiskalt');
    });

    it('zeichnet schon einen einzelnen Bouncer aus', () => {
        const awards = getAwards([player('A', { throws: 10, hits: 4, points: 4, bouncers: 1 }), player('B', { teamIndex: 1, throws: 10, hits: 4, points: 4 })]);
        expect(awards[0]?.title).toBe('Bouncer-König');
    });

    it('gibt allen ohne Becher "Nackt"', () => {
        const titles = getAwards([
            player('A', { throws: 8, hits: 0, points: 0 }),
            player('B', { throws: 8, hits: 0, points: 0 }),
            player('C', { throws: 8, hits: 6, points: 6 }),
        ]).map(award => award?.title);
        expect(titles.slice(0, 2)).toEqual(['Nackt', 'Nackt']);
    });

    it('zeichnet aus, wer alle 10 Becher allein abraeumt (nicht im 1 gegen 1)', () => {
        const duo = getAwards([
            player('A', { teamIndex: 0, throws: 14, hits: 10, points: 10 }),
            player('B', { teamIndex: 0, playerIndex: 1, throws: 12, hits: 0, points: 0 }),
            player('C', { teamIndex: 1, throws: 12, hits: 4, points: 4 }),
        ]);
        expect(duo[0]?.title).toBe('10/10');
        const solo = getAwards([player('A', { teamIndex: 0, throws: 14, hits: 10, points: 10 }), player('C', { teamIndex: 1, throws: 12, hits: 4, points: 4 })]);
        expect(solo[0]?.title).not.toBe('10/10');
    });

    it('gibt bei einem Deathcup-Sieg kein 10/10, auch wenn die Punkte reichen', () => {
        const awards = getAwards([
            player('A', { teamIndex: 0, throws: 6, hits: 0, points: 10, deathcups: 1 }),
            player('B', { teamIndex: 0, playerIndex: 1, throws: 6, hits: 0, points: 0 }),
            player('C', { teamIndex: 1, throws: 6, hits: 3, points: 3 }),
        ]);
        expect(awards.map(award => award?.title)).not.toContain('10/10');
    });

    it('lobt die laengste Serie des Spiels ab 4 Treffern in Folge', () => {
        const awards = getAwards([
            player('A', { throws: 10, hits: 6, points: 6, bestStreak: 4 }),
            player('B', { teamIndex: 1, throws: 10, hits: 5, points: 5, bestStreak: 3 }),
        ]);
        expect(awards[0]).toMatchObject({ title: 'Scharfschütze', detail: 'Längste Serie im Spiel: 4 Treffer in Folge' });
        expect(awards[1]?.title).not.toBe('Scharfschütze');
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
        expect(awards[1]?.title).toBe('Bombenleger');
        expect(awards[0]?.title).not.toBe('Bombenleger');
    });
});
