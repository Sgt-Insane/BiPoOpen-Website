import { describe, expect, it } from 'vitest';
import { playSeededRps } from './knechtRps';

describe('Schnick-Schnack-Schnuck im Lobby-Spiel', () => {
    it('gleicher Startwert: gleiche Runden und gleicher Gewinner auf jedem Handy', () => {
        expect(playSeededRps('66f0c1a2b3')).toEqual(playSeededRps('66f0c1a2b3'));
    });

    it('endet immer mit einem Gewinner, Unentschieden nur davor', () => {
        for (let index = 0; index < 300; index++) {
            const rounds = playSeededRps(`spiel-${index}`);
            const last = rounds[rounds.length - 1];
            expect(last.winner === 0 || last.winner === 1).toBe(true);
            expect(last.hands[0]).not.toBe(last.hands[1]);
            rounds.slice(0, -1).forEach(round => {
                expect(round.winner).toBeNull();
                expect(round.hands[0]).toBe(round.hands[1]);
            });
            // Stein (0) > Schere (2) > Papier (1) > Stein
            const [a, b] = last.hands;
            expect(last.winner).toBe((a - b + 3) % 3 === 1 ? 0 : 1);
        }
    });

    it('beide Teams gewinnen mal', () => {
        const winners = new Set(Array.from({ length: 50 }, (_, index) => playSeededRps(`x${index}`).at(-1)!.winner));
        expect(winners).toEqual(new Set([0, 1]));
    });
});
