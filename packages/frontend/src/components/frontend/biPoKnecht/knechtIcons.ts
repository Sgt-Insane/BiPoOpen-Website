// Eigene Piktogramme fuer alle Wurfarten (24x24): minimalistische Linien in currentColor, Flaechen mit
// dezenter Fuellung in derselben Farbe (soft, angelehnt an das Icon-Set der Webseite), der Ball immer weiss. Becher, Ball und Tisch sehen ueberall gleich aus, damit man die Symbole auf einen Blick unterscheidet.

export type KnechtIconShape =
    | { d: string; fill?: boolean; soft?: boolean; dashed?: boolean }
    | { cx: number; cy: number; r: number; fill?: boolean; soft?: boolean; ball?: boolean };

// Becher: schlichte Form wie bisher, nur mit dezenter Fuellung
const CUP_BODY = 'M5.5 9.5h13l-1.6 10.6a1.3 1.3 0 0 1-1.3 1.1H8.4a1.3 1.3 0 0 1-1.3-1.1z';
const CUP: KnechtIconShape[] = [{ d: CUP_BODY, soft: true }];
// Kleiner Becher rechts unten (Bouncer, Airball)
const SMALL_CUP: KnechtIconShape[] = [{ d: 'M15 13.5h6.5l-.9 7a.9.9 0 0 1-.9.8h-2.9a.9.9 0 0 1-.9-.8z', soft: true }];
const TABLE = 'M2 21.5h20';
const ball = (cx: number, cy: number, r = 2.5): KnechtIconShape => ({ cx, cy, r, ball: true });

export const KNECHT_ICONS = {
    // Treffer: Ball fliegt schraeg in den Becher, drei Flugstreifen dahinter
    hit: [...CUP, ball(14, 6.6), { d: 'M10.6 .8l2.1 1.5M8.1 3l2.9 2.1M6.9 6.1l2.1 1.5' }],
    miss: [{ d: TABLE }, ball(7.5, 18.4), { d: 'M14.5 4.5l5.5 5.5M20 4.5l-5.5 5.5' }],
    airball: [...SMALL_CUP, { d: 'M2 20C4 7 12 3 19 7', dashed: true }, ball(20.5, 8.5, 2.2)],
    bouncer: [{ d: TABLE }, { d: 'M2.5 3.5L7 20.5l4.5-9', dashed: true }, ball(12.5, 8.8, 2.3), ...SMALL_CUP],
    trickshot: [{ d: 'M2 19c4 0 8-2 9-6s-3-5-4-2 3 5 7 2 5-6 5-8', dashed: true }, ball(19.5, 3.8, 2.1), { d: 'M18 15v5M15.5 17.5h5' }],
    // Bombe: Explosion platzt aus dem Becher, mit ausgefuelltem Kern
    bomb: [
        { d: 'M6 14.2L3.3 11.4 7.1 10.7 5.2 4.9 10.1 8.5 12 3.3 13.9 8.5 19.1 4.4 16.9 10.7 21 11.3 18 14.2z', soft: true },
        { d: 'M8.6 14.2L6.4 11 10.3 11.3 12 7.7 13.7 11.3 17.6 11 15.4 14.2z', fill: true },
        { d: 'M6 14.2h12l-1.3 7a1.1 1.1 0 0 1-1.1.9H8.4a1.1 1.1 0 0 1-1.1-.9z', soft: true },
    ],
    ballsback: [
        { d: 'M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5' },
        { d: 'M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5' },
        ball(12, 12, 2.7),
    ],
    onfire: [{ d: 'M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2 3.5C11 9 10.5 6 12 2.5z', soft: true }, { d: 'M12 20.5a2.5 2.5 0 0 1-2.5-2.5c0-1.6 1.2-2.4 2.5-3.8 1.3 1.4 2.5 2.2 2.5 3.8a2.5 2.5 0 0 1-2.5 2.5z', fill: true }],
    heating: [{ d: 'M10 4a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z', soft: true }, { d: 'M12 8v8.5' }, { cx: 12, cy: 17, r: 1.8, fill: true }],
    // Letzter Becher: ein Becher mit Zielfahne
    lastCup: [...CUP, { d: 'M12 9.5V1.8' }, { d: 'M12 2.2h6l-1.5 2 1.5 2h-6', soft: true }],
    deathcup: [
        { d: 'M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4.2 3 5.2V19h8v-3.8c1.8-1 3-2.7 3-5.2a7 7 0 0 0-7-7z', soft: true },
        { cx: 9.3, cy: 10.5, r: 1.5, fill: true },
        { cx: 14.7, cy: 10.5, r: 1.5, fill: true },
        { d: 'M10.5 19v2M13.5 19v2' },
    ],
    owncup: [{ d: TABLE }, { d: 'M3 10.5l9.5-3.5 2.3 8.2-9.4 2.6z', soft: true }, { d: 'M17 17h3M17.5 13.5l2.5-1.5' }],
    reRack: [{ cx: 12, cy: 6.5, r: 2.9, soft: true }, { cx: 7.5, cy: 15, r: 2.9, soft: true }, { cx: 16.5, cy: 15, r: 2.9, soft: true }, { d: TABLE }],
    nachwurf: [{ d: 'M12 4v16M7 20h10M5 7h14' }, { d: 'M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z', soft: true }],
    overtime: [{ d: 'M7 3h10M7 21h10' }, { d: 'M8 3c0 5 4 6 4 9s-4 4-4 9h8c0-5-4-6-4-9s4-4 4-9z', soft: true }],
    // Karte (Ellenbogen-Call)
    penalty: [{ d: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', soft: true }, { d: 'M10 7h4' }],
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
