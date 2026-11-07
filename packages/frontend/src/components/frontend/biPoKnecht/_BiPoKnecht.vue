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

        <template v-else>
            <h1 class="bp-title">BiPo Knecht</h1>
            <p class="kn-page-intro">
                Der digitale Schreiber für euer Spiel: jeden Wurf antippen, der Knecht kennt die Regeln,
                zählt die Becher und trägt das Ergebnis am Ende ein.
            </p>

            <!-- Laufendes Spiel (z.B. nach Neuladen) -->
            <div v-if="stored" class="kn-page-card kn-page-resume">
                <div class="kn-page-card-title">Laufendes Spiel</div>
                <div class="kn-page-resume-teams">{{ getTeamName(stored.match, 0) }} gegen {{ getTeamName(stored.match, 1) }}</div>
                <div class="kn-page-resume-meta">{{ storedSummary }}</div>
                <div class="kn-page-actions">
                    <button type="button" class="kn-page-button kn-page-button-secondary" @click="discardStored">Verwerfen</button>
                    <button type="button" class="kn-page-button" @click="resume">Fortsetzen</button>
                </div>
            </div>

            <button type="button" class="kn-page-button kn-page-button-new" @click="openSetup">
                <i class="pi pi-plus"></i> Neues Spiel einrichten
            </button>

            <!-- Demo (lokaler Entwicklungsserver): Ergebnisse bleiben im Browser -->
            <div v-if="isDemoMode" class="kn-page-card kn-page-demo">
                <div class="kn-page-card-title">Demo-Modus</div>
                <p>Eingetragene Spiele erscheinen in Tabellen und Spielelisten, landen aber nicht in der echten Datenbank.</p>
                <button v-if="demoGameCount" type="button" class="kn-page-button kn-page-button-secondary" @click="resetDemo">
                    {{ demoGameCount }} Demo-Spiel{{ demoGameCount === 1 ? '' : 'e' }} löschen
                </button>
            </div>

            <div class="kn-page-card">
                <div class="kn-page-card-title">So funktioniert's</div>
                <ul class="kn-page-list">
                    <li><strong>Treffer:</strong> getroffenen Becher antippen. Bouncer vorher aktivieren.</li>
                    <li><strong>Nullwurf:</strong> irgendwo neben oder vor die Becher tippen.</li>
                    <li><strong>Airball:</strong> hinter die Becher tippen – der Ball flog über den Tisch.</li>
                    <li><strong>Werfer:</strong> Spielerkarte antippen – die Reihenfolge ist frei.</li>
                    <li><strong>Schiedsrichter-Modus</strong> im Menü: Tisch quer von der Seite.</li>
                </ul>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import router from '@/router.js';
import BiPoKnecht from './BiPoKnecht.vue';
import type { KnechtAction } from './knechtEngine';
import { formatPoints, getResultPath, getTeamName, normalizeTeams } from './KnechtUtilFunctions';
import { clearStoredGame, loadStoredGame, storeGame, type StoredKnechtGame } from './knechtStorage';
import { useKnechtLaunch } from './useKnechtLaunch';
import { useAddGame } from '@/components/shared/GameEntry/useAddGame';
import { clearDemoGames, getDemoGames, isDemoMode } from '@/util/demoGames';
import { clearGameDataCache } from '@/util/gameDataCache';

type ActiveGame = {
    key: number;
    match: Match;
    startTeamIndex: number | null;
    actions: KnechtAction[];
    refereeUsed: boolean;
};

const toast = useToast();
const { consumeLaunch, hasLaunch, onLaunch } = useKnechtLaunch();
const { openAddGame } = useAddGame();

const game = ref<ActiveGame | null>(null);
const stored = ref<StoredKnechtGame | null>(loadStoredGame());
let gameKey = 0;

const storedSummary = computed(() => {
    if (!stored.value) return '';
    const throws = stored.value.actions.filter(action => action.type !== 'reRack').length;
    const time = new Date(stored.value.savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `${throws} Einträge · zuletzt ${time} Uhr`;
});

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
    if (stored.value && !confirm('Das laufende Spiel wird verworfen. Neues Spiel starten?')) return;
    game.value = { key: ++gameKey, match: normalizeTeams(match), startTeamIndex: null, actions: [], refereeUsed: false };
    stored.value = null;
    persist();
};

const resume = () => {
    if (!stored.value) return;
    const { match, startTeamIndex, actions, refereeUsed } = stored.value;
    game.value = { key: ++gameKey, match, startTeamIndex, actions, refereeUsed };
};

const discardStored = () => {
    if (!confirm('Laufendes Spiel wirklich verwerfen?')) return;
    clearStoredGame();
    stored.value = null;
};

const openSetup = () => openAddGame(undefined, { knecht: true });

const demoGameCount = ref(getDemoGames('league').length + getDemoGames('open').length);
const resetDemo = () => {
    clearDemoGames();
    clearGameDataCache();
    demoGameCount.value = 0;
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
    stored.value = null;
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
    stored.value = null;
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
    if (match) newGame(match);
};

const stopListening = onLaunch(takeLaunch);
onUnmounted(stopListening);

onMounted(() => {
    if (hasLaunch()) takeLaunch();
    // /Knecht?Fortsetzen (z.B. aus dem Eintragen-Drawer): laufendes Spiel direkt oeffnen
    else if (stored.value && 'Fortsetzen' in router.currentRoute.value.query) resume();
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
.kn-page-intro{
    margin: 0;
    color: var(--bp-text-secondary);
    font-size: 15px;
    line-height: 1.5;
}
.kn-page-card{
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--bp-border);
    border-radius: 16px;
    background: var(--bp-surface);
}
.kn-page-resume{
    border-top: 4px solid var(--main-color);
}
.kn-page-demo{
    border-style: dashed;
    background: var(--secondary-color-weak);
}
.kn-page-demo p{
    margin: 0;
    font-size: 13px;
    color: var(--bp-text-secondary);
}
.kn-page-card-title{
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--bp-text-secondary);
}
.kn-page-resume-teams{
    font-size: 17px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.kn-page-resume-meta{
    font-size: 13px;
    color: var(--bp-text-muted);
}
.kn-page-actions{
    display: flex;
    gap: 8px;
    margin-top: 4px;
}
.kn-page-button{
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 52px;
    border: none;
    border-radius: 14px;
    background: var(--main-color);
    color: white;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
}
.kn-page-button-secondary{
    border: 1px solid var(--bp-border);
    background: var(--bp-surface);
    color: var(--bp-text);
}
.kn-page-button-new{
    flex: none;
}
.kn-page-list{
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding-left: 18px;
    color: var(--bp-text);
    font-size: 14px;
    line-height: 1.45;
}
</style>
