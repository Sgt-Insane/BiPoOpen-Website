// Eigene Piktogramme fuer alle Wurfarten (24x24): minimalistische Linien in currentColor, Flaechen mit
// dezenter Fuellung in derselben Farbe (soft, angelehnt an das Icon-Set der Webseite), der Ball immer weiss. Becher, Ball und Tisch sehen ueberall gleich aus, damit man die Symbole auf einen Blick unterscheidet.

// part: Name des Teils fuer die grosse animierte Version (KnechtCelebrationIcon), z.B. 'ball' oder 'flag'
export type KnechtIconShape =
    | { d: string; fill?: boolean; soft?: boolean; dashed?: boolean; part?: string }
    | { cx: number; cy: number; r: number; fill?: boolean; soft?: boolean; ball?: boolean; part?: string };

// Becher: ueberall dieselbe Form, nur skaliert (und beim umgestossenen Becher gedreht).
// Grundform 13 breit, 11,7 hoch, unten 9,8 breit, mit abgerundeten unteren Ecken.
const CUP_POINTS: [number, number][] = [[0, 0], [13, 0], [11.4, 10.6], [10.1, 11.7], [2.9, 11.7], [1.6, 10.6]];
const CUP_RATIO = 11.7 / 13;
const round = (value: number) => Math.round(value * 100) / 100;
// cx: Mitte, top: Oberkante, width: Breite oben, angle: Drehung in Grad um die Bechermitte
const cupPath = (cx: number, top: number, width: number, angle = 0) => {
    const scale = width / 13;
    const centerY = top + width * CUP_RATIO / 2;
    const rad = angle * Math.PI / 180;
    const [p0, p1, p2, p3, p4, p5] = CUP_POINTS.map(([x, y]) => {
        const dx = cx - width / 2 + x * scale - cx, dy = top + y * scale - centerY;
        return `${round(cx + dx * Math.cos(rad) - dy * Math.sin(rad))} ${round(centerY + dx * Math.sin(rad) + dy * Math.cos(rad))}`;
    });
    const r = round(1.3 * scale);
    return `M${p0}L${p1} ${p2}A${r} ${r} 0 0 1 ${p3}L${p4}A${r} ${r} 0 0 1 ${p5}z`;
};
const CUP_BODY = cupPath(12, 9.5, 13);
const CUP: KnechtIconShape[] = [{ d: CUP_BODY, soft: true }];
// Kleiner Becher rechts unten auf dem Tisch (Bouncer, Airball)
const SMALL_CUP: KnechtIconShape[] = [{ d: cupPath(18.2, 21.3 - 6.6 * CUP_RATIO, 6.6), soft: true, part: 'cup' }];
const TABLE = 'M2 21.5h20';
const ball = (cx: number, cy: number, r = 2.5): KnechtIconShape => ({ cx, cy, r, ball: true, part: 'ball' });

export const KNECHT_ICONS = {
    // Treffer: Ball faellt von schraeg rechts oben in die Becheroeffnung, drei Flugstreifen dahinter
    hit: [...CUP, ball(12.6, 6.8), { d: 'M17.4 3l-.8 1.8M15.1 1.3L14 3.7M12.3.7l-.8 1.8' }],
    miss: [{ d: TABLE }, ball(7.5, 18.4), { d: 'M14.5 4.5l5.5 5.5M20 4.5l-5.5 5.5' }],
    airball: [...SMALL_CUP, { d: 'M2 20C4 7 12 3 19 7', dashed: true }, ball(20.5, 8.5, 2.2)],
    bouncer: [{ d: TABLE }, { d: 'M2.5 3.5L7 20.5l4.5-9', dashed: true, part: 'trail' }, ball(12.5, 8.8, 2.3), ...SMALL_CUP],
    trickshot: [{ d: 'M2 19c4 0 8-2 9-6s-3-5-4-2 3 5 7 2 5-6 5-8', dashed: true, part: 'trail' }, ball(19.5, 3.8, 2.1), { d: 'M18 15v5M15.5 17.5h5', part: 'plus' }],
    // Bombe: Explosion platzt aus dem Becher, mit ausgefuelltem Kern
    bomb: [
        { d: 'M7 13.8L3.8 11.1 8 10.9 5.7 5.1 10.5 9 12 3.5 13.5 9 18.7 4.6 16 10.9 20.4 11.1 17 13.8z', soft: true, part: 'burst' },
        { d: 'M9.1 13.8L6.8 10.8 10.5 11.3 12 7.8 13.4 11.3 17.2 10.8 14.9 13.8z', fill: true, part: 'core' },
        { d: cupPath(12, 13.8, 10), soft: true, part: 'cup' },
    ],
    ballsback: [
        { d: 'M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5', part: 'arrows' },
        { d: 'M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5', part: 'arrows' },
        ball(12, 12, 2.7),
    ],
    onfire: [{ d: 'M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2 3.5C11 9 10.5 6 12 2.5z', soft: true, part: 'flame' }, { d: 'M12 20.5a2.5 2.5 0 0 1-2.5-2.5c0-1.6 1.2-2.4 2.5-3.8 1.3 1.4 2.5 2.2 2.5 3.8a2.5 2.5 0 0 1-2.5 2.5z', fill: true, part: 'core' }],
    heating: [{ d: 'M10 4a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z', soft: true }, { d: 'M12 8v8.5', part: 'mercury' }, { cx: 12, cy: 17, r: 1.8, fill: true, part: 'bulb' }],
    // Letzter Becher: ein Becher mit Zielfahne
    lastCup: [{ d: CUP_BODY, soft: true, part: 'cup' }, { d: 'M12 9.5V1.8', part: 'pole' }, { d: 'M12 2.2h6l-1.5 2 1.5 2h-6', soft: true, part: 'flag' }],
    deathcup: [
        { d: 'M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4.2 3 5.2V19h8v-3.8c1.8-1 3-2.7 3-5.2a7 7 0 0 0-7-7z', soft: true },
        { cx: 9.3, cy: 10.5, r: 1.5, fill: true, part: 'eye' },
        { cx: 14.7, cy: 10.5, r: 1.5, fill: true, part: 'eye' },
        { d: 'M10.5 19v2M13.5 19v2', part: 'jaw' },
    ],
    // Eigener Becher: umgestossen, liegt auf der Seite (Oeffnung rechts), daneben laeuft es aus
    owncup: [{ d: TABLE }, { d: cupPath(10, 11.63, 10, 81.4), soft: true }, { d: 'M18.2 17.6l2.8-1.1M18.4 14.3l2.2-1.7' }],
    reRack: [{ cx: 12, cy: 6.5, r: 2.9, soft: true, part: 'c3' }, { cx: 7.5, cy: 15, r: 2.9, soft: true, part: 'c1' }, { cx: 16.5, cy: 15, r: 2.9, soft: true, part: 'c2' }, { d: TABLE }],
    nachwurf: [{ d: 'M12 4v16M7 20h10' }, { d: 'M5 7h14', part: 'beam' }, { d: 'M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z', soft: true, part: 'beam' }],
    overtime: [{ d: 'M7 3h10M7 21h10', part: 'glass' }, { d: 'M8 3c0 5 4 6 4 9s-4 4-4 9h8c0-5-4-6-4-9s4-4 4-9z', soft: true, part: 'glass' }],
    // Karte (Ellenbogen-Call)
    penalty: [{ d: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', soft: true, part: 'card' }, { d: 'M10 7h4', part: 'card' }],
    win: [{ d: 'M8 4h8v5a4 4 0 0 1-8 0z', soft: true }, { d: 'M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4' }, { d: 'M12 13v4M8 20h8M10 17h4v3h-4z' }],
} satisfies Record<string, KnechtIconShape[]>;

export type KnechtIconName = keyof typeof KNECHT_ICONS;

export const TURN_ICONS: Record<Turn['type'], KnechtIconName> = {
    hit: 'hit',
    miss: 'miss',
    airball: 'airball',
    bomb: 'bomb',
    bouncer: 'bouncer',
    trickshot: 'trickshot',
    onfire: 'onfire',
    ballsback: 'ballsback',
    lastCup: 'lastCup',
    deathcup: 'deathcup',
    owncup: 'owncup',
    penalty: 'penalty',
};
