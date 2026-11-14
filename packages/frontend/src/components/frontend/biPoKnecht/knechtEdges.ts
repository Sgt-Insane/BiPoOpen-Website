// Kanten-Erkennung ohne Zusatzklick: wer einen Nullwurf eintraegt, tippt dorthin, wo der Ball gelandet ist.
// Liegt der Tipp knapp neben einem stehenden Becher, war es die Kante dieses Bechers.
// Rein geometrisch, damit es in jeder Ansicht (Spieler gedreht, Schiedsrichter quer) gleich funktioniert:
// die Richtungen kommen aus der Lage der Becher selbst, nicht aus der Bildschirmdrehung.

type Point = { x: number; y: number };

// Tipp bis zu diesem Vielfachen des Becherradius vom Mittelpunkt entfernt = Kante
export const EDGE_REACH = 1.5;

const SIDES: EdgeSide[] = ['vorne', 'vorne-rechts', 'rechts', 'hinten-rechts', 'hinten', 'hinten-links', 'links', 'vorne-links'];

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const length = (a: Point) => Math.hypot(a.x, a.y);
const normalize = (a: Point): Point => { const l = length(a) || 1; return { x: a.x / l, y: a.y / l }; };
const round = (value: number) => Math.round(value * 100) / 100 || 0;   // || 0: keine -0

export type RackGeometry = {
    centers: Point[];       // Bildschirm-Mittelpunkt je Becher-Index 0-9
    radius: number;         // Becherradius in Pixeln
    standing: number[];     // Becher, die noch auf dem Tisch stehen (auch in dieser Runde getroffene)
};

// Achsen aus Sicht des Werfers: vorne = Richtung Werfer (Spitze), rechts = von Becher 2 zu Becher 3
const getAxes = ({ centers }: RackGeometry) => {
    const right = normalize(sub(centers[2], centers[1]));
    const middle = { x: (centers[1].x + centers[2].x) / 2, y: (centers[1].y + centers[2].y) / 2 };
    const front = normalize(sub(centers[0], middle));
    return { right, front };
};

export const classifyMiss = (tap: Point, geometry: RackGeometry): { spot: Point; edge?: EdgeHit } => {
    const { right, front } = getAxes(geometry);
    const diameter = geometry.radius * 2;
    const fromTip = sub(tap, geometry.centers[0]);
    const spot = { x: round(dot(fromTip, right) / diameter), y: round(-dot(fromTip, front) / diameter) };

    let nearestCup = -1;
    let nearestDistance = Infinity;
    geometry.standing.forEach(cup => {
        const distance = length(sub(tap, geometry.centers[cup]));
        if (distance < nearestDistance) { nearestCup = cup; nearestDistance = distance; }
    });
    if (nearestCup < 0 || nearestDistance > geometry.radius * EDGE_REACH) return { spot };

    // Seite des Bechers, an der der Ball war (8 Richtungen aus Sicht des Werfers)
    const offset = sub(tap, geometry.centers[nearestCup]);
    const angle = Math.atan2(dot(offset, right), dot(offset, front));   // 0 = vorne, positiv = rechts
    const sector = Math.round(((angle + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 4)) % 8;
    return { spot, edge: { cup: nearestCup, side: SIDES[sector] } };
};

export const formatEdge = (edge: EdgeHit) =>
    `${edge.double ? 'Doppelkante' : 'Kante'} · Becher ${edge.cup + 1}`;
