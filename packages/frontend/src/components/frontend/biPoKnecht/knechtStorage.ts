import { ref } from 'vue';
import type { KnechtAction } from './knechtEngine';

// Laufendes Spiel des BiPo Knecht (ueberlebt Neuladen und gesperrten Bildschirm).
// runningGame ist reaktiv, damit z.B. die Navigation ein laufendes Spiel anzeigen kann.

const STORAGE_KEY = 'bipo_knecht_game';

export type StoredKnechtGame = {
    match: Match;
    startTeamIndex: number | null;
    actions: KnechtAction[];
    refereeUsed: boolean;
    savedAt: number;
};

export const loadStoredGame = (): StoredKnechtGame | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) as StoredKnechtGame : null;
    } catch {
        return null;
    }
};

const getTitle = (game: StoredKnechtGame | null) => {
    if (!game) return null;
    const name = (team: Team) => team.name || team.players.map(player => player.name).join(' & ');
    return `${name(game.match.team1)} gegen ${name(game.match.team2)}`;
};

export const runningGameTitle = ref<string | null>(getTitle(loadStoredGame()));

export const storeGame = (game: StoredKnechtGame) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); } catch { /* Speicher voll oder gesperrt */ }
    runningGameTitle.value = getTitle(game);
};

export const clearStoredGame = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignorieren */ }
    runningGameTitle.value = null;
};
