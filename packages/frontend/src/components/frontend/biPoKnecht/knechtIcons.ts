// Eigene Piktogramme fuer alle Wurfarten (24x24, Linien in currentColor).
// Becher, Ball und Tisch sehen ueberall gleich aus, damit man die Symbole auf einen Blick unterscheidet.

export type KnechtIconShape =
    | { d: string; fill?: boolean; dashed?: boolean }
    | { cx: number; cy: number; r: number; fill?: boolean };

const CUP = 'M6 11h12l-1.6 9.2a1 1 0 0 1-1 .8H8.6a1 1 0 0 1-1-.8z';
const TABLE = 'M2 21h20';

export const KNECHT_ICONS = {
    hit: [{ d: CUP }, { cx: 12, cy: 8.5, r: 2.6, fill: true }, { d: 'M12 2v2' }],
    miss: [{ d: TABLE }, { cx: 7, cy: 16.5, r: 2.6, fill: true }, { d: 'M14 5l6 6M20 5l-6 6' }],
    airball: [{ d: 'M8.5 15h7l-1 6h-5z' }, { d: 'M2 19C4 6 16 2 21 10', dashed: true }, { cx: 21, cy: 13, r: 2.2, fill: true }],
    bouncer: [{ d: TABLE }, { d: 'M2.5 3.5L7 19l5.5-10', dashed: true }, { cx: 14, cy: 6.5, r: 2.4, fill: true }, { d: 'M15.5 13h6l-.9 6h-4.2z' }],
    trickshot: [{ d: 'M2 19c4 0 8-2 9-6s-3-5-4-2 3 5 7 2 5-6 5-8', dashed: true }, { cx: 19.5, cy: 3.8, r: 2, fill: true }, { d: 'M18 14v5M15.5 16.5h5' }],
    bomb: [{ d: CUP }, { cx: 8.5, cy: 6, r: 2.4, fill: true }, { cx: 15.5, cy: 6, r: 2.4, fill: true }, { d: 'M12 2.5v3' }],
    ballsback: [
        { d: 'M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5' },
        { d: 'M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5' },
        { cx: 12, cy: 12, r: 2.6, fill: true },
    ],
    onfire: [{ d: 'M12 2.5c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2 3.5C11 9 10.5 6 12 2.5z' }],
    heating: [{ d: 'M10 4a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z' }, { d: 'M12 9v7' }],
    lastCup: [{ d: 'M5 21V3.5' }, { d: 'M5 4h12l-2.5 4 2.5 4H5' }],
    deathcup: [
        { d: 'M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4.2 3 5.2V19h8v-3.8c1.8-1 3-2.7 3-5.2a7 7 0 0 0-7-7z' },
        { cx: 9.3, cy: 10.5, r: 1.4, fill: true },
        { cx: 14.7, cy: 10.5, r: 1.4, fill: true },
        { d: 'M10.5 19v2M13.5 19v2' },
    ],
    owncup: [{ d: TABLE }, { d: 'M3 10.5l9.5-3.5 2.3 8.2-9.4 2.6z' }, { d: 'M17 17h3M17.5 13.5l2.5-1.5' }],
    reRack: [{ cx: 12, cy: 6.5, r: 2.8 }, { cx: 7.5, cy: 15, r: 2.8 }, { cx: 16.5, cy: 15, r: 2.8 }, { d: TABLE }],
    nachwurf: [{ d: 'M12 4v16M7 20h10M5 7h14' }, { d: 'M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z' }],
    overtime: [{ d: 'M7 3h10M7 21h10' }, { d: 'M8 3c0 5 4 6 4 9s-4 4-4 9M16 3c0 5-4 6-4 9s4 4 4 9' }],
    win: [{ d: 'M8 4h8v5a4 4 0 0 1-8 0z' }, { d: 'M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4' }, { d: 'M12 13v4M8 20h8M10 17h4v3h-4z' }],
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
};
