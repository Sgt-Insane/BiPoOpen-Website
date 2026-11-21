import { addEdgeContact, getEdgeSide, type RackGeometry } from './knechtEdges';

// Knecht Pro: Ballweg. Wer den Finger haelt, bekommt eine Lupe und legt den Ball genau ab (Kante, im Becher,
// Tischplatte). Mehrere Baelle zeigen den Weg: z.B. erst Kante, dann in den Becher. Es zaehlt, wo der letzte liegt.
// Rein geometrisch, ohne Vue: die Oberflaeche (KnechtRack, KnechtBallPath) liefert Bildschirmpunkte und die Lage der Becher.

type Point = { x: number; y: number };

export type BallZone =
    | { kind: 'cup'; cup: number }                  // im Becher
    | { kind: 'rim'; cup: number; angle: number }   // auf der Kante (Winkel aus Sicht des Werfers, 0 = vorne, positiv = rechts)
    | { kind: 'table'; spot: Point }                // auf der Tischplatte (Becherdurchmesser, Ursprung Becher 1)
    | { kind: 'airball' };                          // ueber den Tisch hinaus

export type PathBall = { x: number; y: number; zone: BallZone };

// Kante = Ring um den Becherrand: innen bis hier ist es "im Becher", aussen bis hier noch Kante
export const RIM_INNER = 0.72;
export const RIM_OUTER = 1.2;

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const normalize = (a: Point): Point => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; };
const round = (value: number) => Math.round(value * 100) / 100 || 0;

// Achsen aus Sicht des Werfers (wie in knechtEdges): vorne = Richtung Spitze, rechts = von Becher 2 zu Becher 3
const getAxes = ({ centers }: RackGeometry) => {
    const right = normalize(sub(centers[2], centers[1]));
    const middle = { x: (centers[1].x + centers[2].x) / 2, y: (centers[1].y + centers[2].y) / 2 };
    return { right, front: normalize(sub(centers[0], middle)) };
};

// Wo liegt ein Ball an diesem Bildschirmpunkt? Nur stehende Becher haben Rand und Inneres.
export const classifyPoint = (point: Point, geometry: RackGeometry): Exclude<BallZone, { kind: 'airball' }> => {
    const { right, front } = getAxes(geometry);
    let nearest = -1;
    let distance = Infinity;
    geometry.standing.forEach(cup => {
        const d = Math.hypot(point.x - geometry.centers[cup].x, point.y - geometry.centers[cup].y);
        if (d < distance) { nearest = cup; distance = d; }
    });
    if (nearest >= 0 && distance <= geometry.radius * RIM_INNER) return { kind: 'cup', cup: nearest };
    if (nearest >= 0 && distance <= geometry.radius * RIM_OUTER) {
        const offset = sub(point, geometry.centers[nearest]);
        const angle = Math.round(Math.atan2(dot(offset, right), dot(offset, front)) * 180 / Math.PI);
        return { kind: 'rim', cup: nearest, angle };
    }
    const fromTip = sub(point, geometry.centers[0]);
    const diameter = geometry.radius * 2;
    return { kind: 'table', spot: { x: round(dot(fromTip, right) / diameter), y: round(-dot(fromTip, front) / diameter) } };
};

export const isSameZone = (a: BallZone | null, b: BallZone | null) => {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'cup' && b.kind === 'cup') return a.cup === b.cup;
    if (a.kind === 'rim' && b.kind === 'rim') return a.cup === b.cup;
    return true;
};

// Warum ein Ball an dieser Stelle der Folge nicht sein kann (null = in Ordnung)
// hittable: Becher, in die gerade getroffen werden kann
export const getBallProblem = (path: PathBall[], index: number, hittable: Set<number>): string | null => {
    const ball = path[index];
    const before = path.slice(0, index);
    if (before.some(entry => entry.zone.kind === 'cup')) return 'Der Ball war schon im Becher';
    if (before.some(entry => entry.zone.kind === 'airball')) return 'Nach dem Airball geht es nicht weiter';
    if (ball.zone.kind === 'airball' && before.length) return 'Airball heißt: weder Becher noch Tisch berührt';
    if (ball.zone.kind === 'cup' && !hittable.has(ball.zone.cup)) return 'In diesen Becher kann gerade nicht getroffen werden';
    return null;
};

export const getPathProblems = (path: PathBall[], hittable: Set<number>) => path.map((_, index) => getBallProblem(path, index, hittable));

// Was eingetragen wird. Es zaehlt der letzte Ball; davor liegende Kanten und Tischberuehrungen ergaenzen den Wurf.
export type PathResult =
    | { outcome: 'hit'; cup: number; edge?: EdgeHit; bounceSpot?: Point }      // bounceSpot: vorher auf dem Tisch = Bouncer
    | { outcome: 'miss'; spot?: Point; edge?: EdgeHit }
    | { outcome: 'airball' };

const toEdge = (rims: Extract<BallZone, { kind: 'rim' }>[]): EdgeHit | undefined => {
    if (!rims.length) return undefined;
    const [first, ...rest] = rims;
    const start: EdgeHit = { cup: first.cup, side: getEdgeSide(first.angle), angle: first.angle, contacts: [{ cup: first.cup, angle: first.angle }], count: 1 };
    return rest.reduce((edge, rim) => addEdgeContact(edge, { cup: rim.cup, angle: rim.angle }), start);
};

// null: leer oder ungueltig (dann kein Eintragen)
export const getPathResult = (path: PathBall[], hittable: Set<number>): PathResult | null => {
    if (!path.length || getPathProblems(path, hittable).some(Boolean)) return null;
    const last = path[path.length - 1].zone;
    const rims = path.map(ball => ball.zone).filter((zone): zone is Extract<BallZone, { kind: 'rim' }> => zone.kind === 'rim');
    const edge = toEdge(rims);
    if (last.kind === 'airball') return { outcome: 'airball' };
    if (last.kind === 'cup') {
        const bounce = path.find(ball => ball.zone.kind === 'table')?.zone as Extract<BallZone, { kind: 'table' }> | undefined;
        return { outcome: 'hit', cup: last.cup, ...(edge && { edge }), ...(bounce && { bounceSpot: bounce.spot }) };
    }
    // Nullwurf: Landestelle ist der letzte Ball auf dem Tisch (endet er auf der Kante, ohne Landestelle)
    const lastTable = [...path].reverse().find(ball => ball.zone.kind === 'table')?.zone as Extract<BallZone, { kind: 'table' }> | undefined;
    return { outcome: 'miss', ...(lastTable && { spot: lastTable.spot }), ...(edge && { edge }) };
};

const zoneName = (zone: BallZone) => {
    switch (zone.kind) {
        case 'cup': return `Becher ${zone.cup + 1}`;
        case 'rim': return `Kante ${zone.cup + 1}`;
        case 'table': return 'Tisch';
        default: return 'Airball';
    }
};

// Kurze Beschreibung fuer die Bestaetigung, z.B. "Kante 3 → Becher 5: Treffer über die Kante"
export const describePath = (path: PathBall[], result: PathResult | null) => {
    const steps = path.map(ball => zoneName(ball.zone)).join(' → ');
    if (!result) return steps;
    if (result.outcome === 'airball') return `${steps}: Airball`;
    if (result.outcome === 'hit') {
        const kinds = [result.bounceSpot && 'Bouncer', result.edge && (result.edge.count ?? 1) >= 2 ? 'über die Doppelkante' : result.edge && 'über die Kante'].filter(Boolean);
        return `${steps}: Treffer${kinds.length ? ` (${kinds.join(', ')})` : ''}`;
    }
    return `${steps}: Nullwurf${result.edge ? ((result.edge.count ?? 1) >= 2 ? ' an der Doppelkante' : ' an der Kante') : ''}`;
};
