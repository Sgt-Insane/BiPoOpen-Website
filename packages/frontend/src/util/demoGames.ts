// Demo-Modus (lokaler Entwicklungsserver): Spiele aus dem BiPo Knecht werden nur im Browser gespeichert
// und beim Laden zu den echten Spielen dazugemischt. In die echte Datenbank wandert davon nichts.
export const isDemoMode = import.meta.env.DEV;

const DEMO_KEY = 'bipo_demo_games';

type DemoKind = 'league' | 'open';
type DemoStore = Record<DemoKind, Match[]>;

const loadStore = (): DemoStore => {
    try {
        const stored = JSON.parse(localStorage.getItem(DEMO_KEY) ?? '') as Partial<DemoStore>;
        return { league: stored.league ?? [], open: stored.open ?? [] };
    } catch {
        return { league: [], open: [] };
    }
};

export const getDemoGames = (kind: DemoKind): Match[] =>
    isDemoMode && typeof localStorage !== 'undefined' ? loadStore()[kind] : [];

export const addDemoGame = (kind: DemoKind, match: Match) => {
    const store = loadStore();
    store[kind].push({ ...match, _id: `demo-${Date.now()}` });
    localStorage.setItem(DEMO_KEY, JSON.stringify(store));
};

export const clearDemoGames = () => localStorage.removeItem(DEMO_KEY);
