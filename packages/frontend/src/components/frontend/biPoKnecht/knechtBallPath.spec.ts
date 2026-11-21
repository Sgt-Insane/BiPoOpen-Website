import { describe, it, expect } from 'vitest';
import { classifyPoint, describePath, getPathProblems, getPathResult, type BallZone, type PathBall } from './knechtBallPath';
import type { RackGeometry } from './knechtEdges';

// Becher wie auf dem Bildschirm: Spitze (Becher 1) unten, Radius 20 px, Abstand 44 px
const STEP = 44;
const rows = [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]];
const centers: { x: number; y: number }[] = [];
rows.forEach((row, rowIndex) => row.forEach((cup, position) => {
    centers[cup] = { x: 200 + (position - (row.length - 1) / 2) * STEP, y: 100 + rowIndex * STEP * .87 };
}));
const geometry: RackGeometry = { centers, radius: 20, standing: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
const all = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

const ball = (zone: BallZone): PathBall => ({ x: 0, y: 0, zone });
const cup = (index: number) => ball({ kind: 'cup', cup: index });
const rim = (index: number, angle = 0) => ball({ kind: 'rim', cup: index, angle });
const table = (x = 0, y = -1) => ball({ kind: 'table', spot: { x, y } });
const airball = () => ball({ kind: 'airball' });

describe('Knecht Pro: Ballweg', () => {
    it('erkennt Becher, Kante und Tisch an der Position', () => {
        const tip = centers[0];
        expect(classifyPoint(tip, geometry)).toEqual({ kind: 'cup', cup: 0 });
        expect(classifyPoint({ x: tip.x, y: tip.y + 20 }, geometry)).toEqual({ kind: 'rim', cup: 0, angle: 0 });      // vorne am Rand
        expect(classifyPoint({ x: tip.x + 20, y: tip.y }, geometry)).toMatchObject({ kind: 'rim', cup: 0 });
        expect(classifyPoint({ x: tip.x, y: tip.y + 60 }, geometry)).toMatchObject({ kind: 'table' });
    });

    it('zaehlt den letzten Ball: erst Kante, dann im Becher = Treffer ueber die Kante', () => {
        const result = getPathResult([rim(4, 90), cup(4)], all);
        expect(result).toMatchObject({ outcome: 'hit', cup: 4, edge: { cup: 4, side: 'rechts', count: 1 } });
        expect(describePath([rim(4, 90), cup(4)], result)).toBe('Kante 5 → Becher 5: Treffer (über die Kante)');
    });

    it('Doppelkante und dann auf den Tisch = Nullwurf an der Doppelkante mit Landestelle', () => {
        const result = getPathResult([rim(2), rim(5, 180), table(1.5, 3)], all);
        expect(result).toMatchObject({ outcome: 'miss', spot: { x: 1.5, y: 3 }, edge: { cup: 2, count: 2 } });
    });

    it('erst auf den Tisch, dann in den Becher = Bouncer', () => {
        expect(getPathResult([table(0, -1), cup(1)], all)).toEqual({ outcome: 'hit', cup: 1, bounceSpot: { x: 0, y: -1 } });
    });

    it('markiert unmoegliche Folgen und traegt sie nicht ein', () => {
        // 1 im Becher, 2 im Becher
        expect(getPathProblems([cup(1), cup(2)], all)).toEqual([null, 'Der Ball war schon im Becher']);
        // Kante, dann Airball
        expect(getPathProblems([rim(1), airball()], all)).toEqual([null, 'Airball heißt: weder Becher noch Tisch berührt']);
        expect(getPathResult([rim(1), airball()], all)).toBeNull();
        // Becher, der schon weg ist
        expect(getPathProblems([cup(3)], new Set([0, 1]))[0]).toMatch(/nicht getroffen/);
    });

    it('ein einzelner Airball bleibt ein Airball', () => {
        expect(getPathResult([airball()], all)).toEqual({ outcome: 'airball' });
    });
});
