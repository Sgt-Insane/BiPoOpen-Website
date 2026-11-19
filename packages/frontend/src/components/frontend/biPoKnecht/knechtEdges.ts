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
    const angle = Math.atan2(dot(offset, right), dot(offset, front)) * 180 / Math.PI;   // 0 = vorne, positiv = rechts
    return { spot, edge: { cup: nearestCup, side: getEdgeSide(angle) } };
};

// Winkel in Grad (0 = vorne, positiv = rechts) -> eine von 8 Seiten
export const getEdgeSide = (angle: number): EdgeSide => SIDES[Math.round((((angle % 360) + 360) % 360) / 45) % 8];

// Wie oft der Ball an der Kante war (aeltere Eintraege: Kante oder Doppelkante)
export const getEdgeCount = (edge: EdgeHit) => edge.count ?? edge.contacts?.length ?? (edge.double ? 2 : 1);

// Kontaktstellen der Reihe nach (aeltere Eintraege: angle und second)
export const getEdgeContacts = (edge: EdgeHit) => edge.contacts ?? [
    ...(edge.angle !== undefined ? [{ cup: edge.cup, angle: edge.angle }] : []),
    ...(edge.second ? [edge.second] : []),
];

// Weitere Kontaktstelle (Knecht Pro): die erste legt Becher und Seite fest, ab der zweiten ist es eine Doppel-/Mehrfachkante
export const addEdgeContact = (edge: EdgeHit, contact: { cup: number; angle: number }): EdgeHit => {
    const contacts = [...getEdgeContacts(edge), contact];
    const [first, second] = contacts;
    return {
        ...edge,
        cup: first.cup,
        side: getEdgeSide(first.angle),
        angle: first.angle,
        contacts,
        count: contacts.length,
        double: contacts.length >= 2 || undefined,
        second: second ?? undefined,
    };
};

// Kontakte loeschen: nur noch Becher und grobe Seite aus dem ersten Tipp
export const resetEdge = (edge: EdgeHit): EdgeHit => ({ cup: edge.cup, side: edge.side, ...(edge.spinOut && { spinOut: true }) });

const edgeName = (count: number) => count >= 3 ? `${count}× Kante` : count === 2 ? 'Doppelkante' : 'Kante';

export const formatEdge = (edge: EdgeHit) => edge.spinOut
    ? `Rein und wieder raus · Becher ${edge.cup + 1}`
    : `${edgeName(getEdgeCount(edge))} · Becher ${edge.cup + 1}`;

// Treffer, der vorher an der Kante war
export const formatHitEdge = (edge: EdgeHit) => `über die ${edgeName(getEdgeCount(edge))}`;
