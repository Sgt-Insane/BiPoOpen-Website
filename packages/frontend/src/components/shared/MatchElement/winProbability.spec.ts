import { describe, it, expect } from 'vitest';
import { getEloExpectation, getWinProbabilities } from './winProbability';

const team = (name: string, score = 0): Team => ({ _id: name, name, players: [{ _id: name, name, score }] } as unknown as Team);
const turn = (teamIndex: number, type: Turn['type'], data: Record<string, unknown> = {}, time = 0): Turn => ({ teamIndex, playerIndex: 0, type, data, time } as Turn);

const match = (turns: Turn[], scores: [number, number] = [0, 0]): Match => ({ _id: 'm', team1: team('A', scores[0]), team2: team('B', scores[1]), turns } as unknown as Match);

describe('Siegwahrscheinlichkeit', () => {
    it('startet bei gleicher Elo bei etwa 50 %', () => {
        const [start] = getWinProbabilities(match([]), .5, false);
        expect(start.chance).toBeGreaterThan(.45);
        expect(start.chance).toBeLessThan(.55);
    });

    it('startet beim Elo-Favoriten ueber 50 % und trifft die Elo-Erwartung', () => {
        const expected = getEloExpectation(1400, 1200);
        const [start] = getWinProbabilities(match([]), expected, false);
        expect(start.chance).toBeGreaterThan(.6);
        expect(Math.abs(start.chance - expected)).toBeLessThan(.06);
    });

    it('steigt mit jedem Treffer und faellt mit Treffern des Gegners', () => {
        const points = getWinProbabilities(match([
            turn(0, 'hit', { cupIndex: 0 }), turn(0, 'miss'),
            turn(1, 'miss'), turn(1, 'miss'),
            turn(0, 'hit', { cupIndex: 1 }), turn(0, 'hit', { cupIndex: 2 }),
        ]), .5, false);
        expect(points[1].chance).toBeGreaterThan(points[0].chance);
        expect(points.at(-1)!.chance).toBeGreaterThan(.6);
    });

    it('steht am Ende beim Sieger auf 100 %', () => {
        const points = getWinProbabilities(match([turn(1, 'hit', { cupIndex: 0 })], [3, 10]));
        expect(points.at(-1)!.chance).toBe(0);
    });
});
