import { computed, shallowRef } from 'vue';
import { getCachedGameData, getGameData, type GameData } from '@/util/gameDataCache';
import { getMatchEloChanges, getPlayerEloRating, getPlayerEloState } from '@/components/frontend/playerProfile/PlayerProfileUtilFunctions';
import { onGameSaved } from '@/components/shared/GameEntry/useAddGame';

// Aktuelles Elo fuer Chips, Vorschau und Elo-Zeilen (Spielersuche, Spiel eintragen, MatchElement), geteilt ueber alle Komponenten.
// Geladen wird erst beim ersten Bedarf, nach einem gespeicherten Spiel frisch (sofern schon einmal geladen).
const gameData = shallowRef<GameData | null>(getCachedGameData());

const loadEloRatings = () => getGameData().then(data => { gameData.value = data; }).catch(() => {});

onGameSaved(() => { if (gameData.value) loadEloRatings(); });

export const useEloRatings = () => {
    const isEloLoaded = computed(() => !!gameData.value);

    // null = noch nicht geladen oder noch kein gewertetes Spiel
    const getElo = (name: string) => gameData.value && name.trim() ? getPlayerEloRating(gameData.value, name) : null;

    // Rating und Spielzahl fuer die Vorschau beim Eintragen, null wie bei getElo
    const getEloState = (name: string) => gameData.value && name.trim() ? getPlayerEloState(gameData.value, name) : null;

    // Elo beider Seiten nach diesem Spiel, null = nicht geladen oder nicht gewertet
    const getMatchElo = (match: Match) => gameData.value ? getMatchEloChanges(gameData.value).get(match._id) ?? null : null;

    return { loadEloRatings, isEloLoaded, getElo, getEloState, getMatchElo };
};
