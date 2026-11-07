<template>
    <div class="KnechtPage">
        <BiPoKnecht
            v-if="game"
            :key="game.key"
            :match="game.match"
            :startTeamIndex="game.startTeamIndex"
            :actions="game.actions"
            :refereeUsed="game.refereeUsed"
            @change="onChange"
            @exit="abort"
            @leave="leave"
            @saved="onSaved"
        />
    </div>
</template>

<script setup lang="ts">
// Nur Spielflaeche: gestartet wird ueber "Spiel eintragen" (Teams waehlen, "Mit BiPo Knecht spielen"),
// ein laufendes Spiel wird beim Oeffnen fortgesetzt. Ohne Spiel geht es zur Startseite.
import { onMounted, onUnmounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import router from '@/router.js';
import BiPoKnecht from './BiPoKnecht.vue';
import type { KnechtAction } from './knechtEngine';
import { formatPoints, getResultPath, getTeamName, normalizeTeams } from './KnechtUtilFunctions';
import { clearStoredGame, loadStoredGame, storeGame } from './knechtStorage';
import { useKnechtLaunch } from './useKnechtLaunch';
import { isDemoMode } from '@/util/demoGames';

type ActiveGame = {
    key: number;
    match: Match;
    startTeamIndex: number | null;
    actions: KnechtAction[];
    refereeUsed: boolean;
};

const toast = useToast();
const { consumeLaunch, hasLaunch, onLaunch } = useKnechtLaunch();

const game = ref<ActiveGame | null>(null);
let gameKey = 0;

// ─── Spiel starten / fortsetzen ───
const persist = () => {
    if (!game.value) return;
    storeGame({
        match: game.value.match,
        startTeamIndex: game.value.startTeamIndex,
        actions: game.value.actions,
        refereeUsed: game.value.refereeUsed,
        savedAt: new Date().getTime(),
    });
};

const newGame = (match: Match) => {
    if ((game.value || loadStoredGame()) && !confirm('Das laufende Spiel wird verworfen. Neues Spiel starten?')) return false;
    game.value = { key: ++gameKey, match: normalizeTeams(match), startTeamIndex: null, actions: [], refereeUsed: false };
    persist();
    return true;
};

const resume = () => {
    const stored = loadStoredGame();
    if (!stored) return false;
    const { match, startTeamIndex, actions, refereeUsed } = stored;
    game.value = { key: ++gameKey, match, startTeamIndex, actions, refereeUsed };
    return true;
};

const onChange = (progress: { startTeamIndex: number | null; actions: KnechtAction[]; refereeUsed: boolean }) => {
    if (!game.value) return;
    Object.assign(game.value, progress);
    persist();
};

// ─── Spiel verlassen ───
const abort = () => {
    clearStoredGame();
    game.value = null;
    router.push('/');
};

const leave = () => {
    persist();
    router.push('/');
};

// Revanche: gleiche Teams und gleicher Wettbewerb, neues Spiel
const toRematch = (match: Match): Match => ({
    _id: 'placeholder',
    team1: { ...match.team1, players: match.team1.players.map(player => ({ ...player, score: 0 })) },
    team2: { ...match.team2, players: match.team2.players.map(player => ({ ...player, score: 0 })) },
    ...(match.season !== undefined && { season: match.season }),
    ...(match.league !== undefined && { league: match.league }),
    ...(match.cupId !== undefined && { cupId: match.cupId, cupRound: match.cupRound }),
});

const onSaved = (result: Match, rematch: boolean) => {
    clearStoredGame();
    const score = [result.team1, result.team2].map(team => formatPoints(team.players.reduce((sum, player) => sum + player.score, 0)));
    const suffix = isDemoMode ? ' (Demo, nur lokal gespeichert)' : ' eingetragen';
    toast.add({ severity: 'success', summary: `${getTeamName(result, 0)} ${score[0]} : ${score[1]} ${getTeamName(result, 1)}${suffix}`, life: 3500 });

    if (rematch) {
        game.value = { key: ++gameKey, match: toRematch(result), startTeamIndex: null, actions: [], refereeUsed: false };
        persist();
        return;
    }
    game.value = null;
    router.push(getResultPath(result));
};

// ─── Uebergabe aus dem "Spiel eintragen"-Drawer ───
const takeLaunch = () => {
    const match = consumeLaunch();
    return !!match && newGame(match);
};

const stopListening = onLaunch(takeLaunch);
onUnmounted(stopListening);

onMounted(() => {
    // Neues Spiel abgelehnt: das laufende geht weiter
    const started = hasLaunch() ? takeLaunch() || resume() : resume();
    if (!started) router.replace('/');
});
</script>

<style scoped>
.KnechtPage{
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(560px, 100%);
    margin: 0 auto;
    padding: 0 16px 32px;
}
</style>
