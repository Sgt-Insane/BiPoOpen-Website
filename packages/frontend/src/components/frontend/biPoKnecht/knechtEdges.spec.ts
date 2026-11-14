import { describe, it, expect } from 'vitest';
import { classifyMiss, type RackGeometry } from './knechtEdges';

// Spieleransicht: Werfer unten, Spitze (Becher 1) unten, Reihen nach oben. Becher 40 px, Abstand 46 px.
const rows = [[0], [1, 2], [3, 4, 5], [6, 7, 8, 9]];
const centers: { x: number; y: number }[] = [];
rows.forEach((row, rowIndex) => row.forEach((cup, position) => {
    centers[cup] = { x: 200 + (position - (row.length - 1) / 2) * 46, y: 400 - rowIndex * 40 };
}));
const geometry: RackGeometry = { centers, radius: 20, standing: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };

// Gleiche Anordnung um 180 Grad gedreht (Team am anderen Tischende)
const rotated: RackGeometry = { ...geometry, centers: centers.map(c => ({ x: 400 - c.x, y: 800 - c.y })) };

describe('Kanten-Erkennung', () => {
    it('erkennt die Kante knapp neben einem Becher, aus Sicht des Werfers', () => {
        // 25 px unter Becher 1 = vorne (zum Werfer)
        expect(classifyMiss({ x: 200, y: 425 }, geometry).edge).toEqual({ cup: 0, side: 'vorne' });
        // rechts neben Becher 10 (Index 9)
        expect(classifyMiss({ x: centers[9].x + 26, y: centers[9].y }, geometry).edge).toEqual({ cup: 9, side: 'rechts' });
    });

    it('wertet einen Tipp weit weg als Tisch', () => {
        expect(classifyMiss({ x: 200, y: 520 }, geometry).edge).toBeUndefined();
    });

    it('gibt in der gedrehten Ansicht dieselbe Seite', () => {
        expect(classifyMiss({ x: 200, y: 800 - 425 }, rotated).edge).toEqual({ cup: 0, side: 'vorne' });
        const right = classifyMiss({ x: 400 - (centers[9].x + 26), y: 800 - centers[9].y }, rotated);
        expect(right.edge).toEqual({ cup: 9, side: 'rechts' });
    });

    it('ignoriert abgeraeumte Becher', () => {
        const without = { ...geometry, standing: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
        expect(classifyMiss({ x: 200, y: 425 }, without).edge).toBeUndefined();
    });

    it('speichert die Landestelle in Becherdurchmessern ab Becher 1', () => {
        expect(classifyMiss({ x: 240, y: 400 }, geometry).spot).toEqual({ x: 1, y: 0 });
        expect(classifyMiss({ x: 200, y: 360 }, geometry).spot).toEqual({ x: 0, y: 1 });
    });
});
