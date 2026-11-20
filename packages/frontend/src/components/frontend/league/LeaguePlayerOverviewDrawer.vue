<template>
    <BottomSheet v-model:visible="drawerVisible">
        <template #header>
            <div v-if="selectedPlayer" class="lpo-head">
                <!-- Antippen des Logos: gross aufploppen lassen. pointerdown.stop, damit der Kopf nicht das Ziehen des Sheets startet -->
                <button v-if="selectedPlayer.logo" type="button" class="lpo-head-logo" :aria-label="`Logo von ${selectedPlayer.name} groß anzeigen`"
                    @pointerdown.stop @click="logoOpen = true">
                    <Avatar :name="selectedPlayer.name" :avatarImage="selectedPlayer.logo" shape="square" class="lpo-head-avatar" />
                </button>
                <Avatar v-else :name="selectedPlayer.name" shape="square" class="lpo-head-avatar" />
                <div class="lpo-head-text">
                    <!-- Sehr lange Namen (mit shortName fuer die Tabelle) hier voll ausgeschrieben: lieber umbrechen als verkleinern -->
                    <div v-if="selectedPlayer.shortName" class="lpo-title lpo-title-full">{{ selectedPlayer.name }}</div>
                    <div v-else class="lpo-title" v-fit-text>{{ selectedPlayer.name }}</div>
                    <div v-if="subtitle" class="lpo-subtitle">{{ subtitle }}</div>
                </div>
            </div>
        </template>

        <div v-if="selectedPlayer" class="lpo">
            <!-- Fortschritt: ein Balken je Runde -->
            <div class="lpo-progress">
                <div class="lpo-progress-text">
                    <span><b>{{ playedCount }} von {{ opponents.length * 2 }}</b> Spielen gespielt</span>
                    <span>Hin {{ playedPerRound[0] }}/{{ opponents.length }} · Rück {{ playedPerRound[1] }}/{{ opponents.length }}</span>
                </div>
                <div class="lpo-progress-bars">
                    <div v-for="(played, roundIndex) in playedPerRound" :key="roundIndex" class="lpo-progress-bar">
                        <div class="lpo-progress-fill" :style="{ width: `${opponents.length ? played / opponents.length * 100 : 0}%` }"></div>
                    </div>
                </div>
            </div>

            <!-- Gegner in Tabellenreihenfolge, Antippen klappt die Details auf -->
            <div class="lpo-table">
                <div class="lpo-row lpo-row--head">
                    <span class="lpo-col-opponent">Gegner</span>
                    <span class="lpo-col-result">Hinrunde</span>
                    <span class="lpo-col-result">Rückrunde</span>
                </div>

                <template v-for="opponent in opponents" :key="opponent.name">
                    <button
                        type="button"
                        class="lpo-row"
                        :aria-expanded="expandedOpponent === opponent.name"
                        @click="toggleOpponent(opponent.name)"
                    >
                        <span class="lpo-col-opponent">
                            <span class="lpo-rank">{{ opponent.placement }}</span>
                            <Avatar :name="opponent.name" :avatarImage="opponent.logo" shape="square" class="lpo-avatar" />
                            <span class="lpo-name" v-fit-text>{{ opponent.name }}</span>
                        </span>
                        <span v-for="(leg, roundIndex) in opponent.legs" :key="roundIndex" class="lpo-col-result">
                            <span class="lpo-result" :class="leg ? (leg.won ? 'lpo-result--win' : 'lpo-result--loss') : 'lpo-result--open'">
                                {{ leg ? `${leg.ownScore}:${leg.enemyScore}` : 'offen' }}
                            </span>
                        </span>
                    </button>

                    <div v-if="expandedOpponent === opponent.name" class="lpo-detail">
                        <div v-for="(leg, roundIndex) in opponent.legs" :key="roundIndex" class="lpo-detail-row">
                            <span class="lpo-detail-label">{{ ROUND_LABELS[roundIndex] }}</span>
                            <span v-if="leg" class="lpo-detail-value">
                                <b>{{ leg.won ? 'Sieg' : 'Niederlage' }} {{ leg.ownScore }} : {{ leg.enemyScore }}</b>
                                <template v-if="leg.time"> · {{ formatGameTime(leg.time) }}</template>
                            </span>
                            <span v-else class="lpo-detail-value lpo-detail-open">
                                noch offen
                                <!-- Eingetragen wird immer das naechste Spiel der Paarung -->
                                <button
                                    v-if="canAddGames && opponent.legs.indexOf(null) === roundIndex"
                                    type="button"
                                    class="lpo-add"
                                    @click="addGame(opponent.name)"
                                >+ Eintragen</button>
                            </span>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </BottomSheet>

    <!-- Logo gross: ueber dem Sheet, Antippen irgendwo schliesst -->
    <Teleport to="body">
        <Transition name="lpo-logo">
            <div v-if="logoOpen && selectedPlayer?.logo" class="lpo-logo-overlay" role="dialog" aria-modal="true"
                :aria-label="`Logo von ${selectedPlayer.name}`" @click="logoOpen = false">
                <img :src="selectedPlayer.logo" :alt="`Logo von ${selectedPlayer.name}`" class="lpo-logo-image" />
                <div class="lpo-logo-name">{{ selectedPlayer.name }}</div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import Avatar from '@/components/shared/Avatar.vue';
import { useAddGame } from '@/components/shared/GameEntry/useAddGame';
import { getLeagueList, getMatchesFromPlayer } from './LeagueUtilFunctions';
import { getMatchScore } from '@/util/tournamentMatchFunctions';
import { formatGameTime } from '@/util/util';

const ROUND_LABELS = ['Hinrunde', 'Rückrunde'];

type Leg = { ownScore: number; enemyScore: number; won: boolean; time?: number };

const drawerVisible = defineModel<boolean>('visible', { default: false });

const props = defineProps<{
    selectedPlayer?: LeaguePlayer;
    leaguePlayers: LeaguePlayer[];
    leagueGames: Match[];
    divisionLabel?: string;
    canAddGames?: boolean;     // nur in der aktuellen Saison
}>();

const { openAddGame } = useAddGame();

const expandedOpponent = ref<string>();
watch(() => props.selectedPlayer, () => expandedOpponent.value = undefined);

// Grosses Logo: schliesst mit dem Sheet und per Escape (ohne dabei das Sheet mitzuschliessen)
const logoOpen = ref(false);
watch(drawerVisible, visible => { if (!visible) logoOpen.value = false; });
const onKeydown = (event: KeyboardEvent) => {
    if (!logoOpen.value || event.key !== 'Escape') return;
    event.stopImmediatePropagation();
    logoOpen.value = false;
};
onMounted(() => document.addEventListener('keydown', onKeydown, true));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown, true));

const toggleOpponent = (name: string) => {
    expandedOpponent.value = expandedOpponent.value === name ? undefined : name;
};

const table = computed(() => getLeagueList(props.leagueGames, props.leaguePlayers));

// "1. Liga · Platz 6 von 12", Platz erst ab dem ersten Spiel
const subtitle = computed(() => {
    const entry = table.value.find(player => player.name === props.selectedPlayer?.name);
    const placement = entry && entry.ammountOfMatches > 0 ? `Platz ${entry.placement! + 1} von ${table.value.length}` : undefined;
    return [props.divisionLabel, placement].filter(part => part).join(' · ');
});

// Spiele gegen einen Gegner nach Zeit: das erste ist die Hinrunde, das zweite die Rueckrunde.
// Spiele ohne Zeit zaehlen als neueste, wie in splitLeagueGamesByRound.
const opponents = computed(() => {
    if (!props.selectedPlayer) return [];

    const ownName = props.selectedPlayer.name.toLowerCase();
    const ownMatches = getMatchesFromPlayer(props.leagueGames, ownName)
        .map((match, index) => ({ match, index }))
        .sort((a, b) => (a.match.time ?? Number.MAX_SAFE_INTEGER) - (b.match.time ?? Number.MAX_SAFE_INTEGER) || a.index - b.index)
        .map(entry => entry.match);

    return table.value
        .filter(player => player.name.toLowerCase() !== ownName)
        .map(player => {
            const opponentName = player.name.toLowerCase();
            const legs: (Leg | null)[] = ownMatches
                .filter(match => [match.team1, match.team2].some(team => team.players[0].name.toLowerCase() === opponentName))
                .slice(0, 2)
                .map(match => {
                    const isTeam1 = match.team1.players[0].name.toLowerCase() === ownName;
                    const ownScore = getMatchScore(match, isTeam1) ?? 0;
                    const enemyScore = getMatchScore(match, !isTeam1) ?? 0;
                    return { ownScore, enemyScore, won: ownScore > enemyScore, time: match.time };
                });

            while (legs.length < 2) legs.push(null);

            return {
                name: player.name,
                logo: props.leaguePlayers.find(leaguePlayer => leaguePlayer.name === player.name)?.logo,
                placement: player.placement! + 1,
                legs,
            };
        });
});

const playedPerRound = computed(() => [0, 1].map(roundIndex => opponents.value.filter(opponent => opponent.legs[roundIndex]).length));
const playedCount = computed(() => playedPerRound.value[0] + playedPerRound.value[1]);

const addGame = (opponentName: string) => {
    openAddGame([props.selectedPlayer!.name, opponentName]);
};
</script>

<style scoped>
/* ─── Kopf ─── */
.lpo-head {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
}
.lpo-head-avatar {
    flex-shrink: 0;
    width: 100px;
    height: 100px;
    border-radius: 18px;
    font-size: 26px;
    font-weight: 700;
    opacity: 1;
    --avatar-background: var(--bp-fill);
    --avatar-color: var(--bp-text-muted);
}
.lpo-head-logo {
    flex-shrink: 0;
    padding: 0;
    border: none;
    border-radius: 18px;
    background: none;
    cursor: zoom-in;
    transition: transform .15s ease;
}
.lpo-head-logo:active {
    transform: scale(.94);
}
.lpo-head-logo:focus-visible {
    outline: 2px solid var(--main-color);
    outline-offset: 2px;
}
.lpo-head-text {
    min-width: 0;
}

/* ─── Logo gross ─── */
.lpo-logo-overlay {
    position: fixed;
    inset: 0;
    z-index: 3000;              /* ueber dem Sheet (PrimeVue-Overlays ab 1100) */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 24px 16px;
    background: rgba(0, 0, 0, .8);
    cursor: zoom-out;
}
.lpo-logo-image {
    width: min(80vw, 60vh, 420px);
    height: min(80vw, 60vh, 420px);
    object-fit: contain;
    filter: drop-shadow(0 10px 30px rgba(0, 0, 0, .45));
}
.lpo-logo-name {
    max-width: 100%;
    font-size: 20px;
    font-weight: 800;
    color: white;
    text-align: center;
    overflow-wrap: anywhere;
}
/* Aufploppen: Logo waechst mit leichtem Ueberschwingen, Hintergrund blendet ein */
.lpo-logo-enter-active {
    transition: opacity .2s ease;
}
.lpo-logo-enter-active .lpo-logo-image {
    animation: lpo-logo-pop .38s cubic-bezier(.34, 1.56, .64, 1);
}
.lpo-logo-leave-active {
    transition: opacity .16s ease;
}
.lpo-logo-leave-active .lpo-logo-image {
    transition: transform .16s ease;
}
.lpo-logo-enter-from,
.lpo-logo-leave-to {
    opacity: 0;
}
.lpo-logo-leave-to .lpo-logo-image {
    transform: scale(.6);
}
@keyframes lpo-logo-pop {
    from { transform: scale(.25); }
    to { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
    .lpo-logo-enter-active .lpo-logo-image {
        animation: none;
    }
}
.lpo-title {
    overflow: hidden;
    font-size: 22px;
    font-weight: 800;
    color: var(--bp-text-strong);
    line-height: 1.2;
    white-space: nowrap;
}
.lpo-title-full {
    white-space: normal;
    overflow-wrap: break-word;
}
.lpo-subtitle {
    font-size: 13px;
    color: var(--bp-text-muted);
}

/* ─── Fortschritt ─── */
.lpo-progress {
    margin-bottom: 18px;
}
.lpo-progress-text {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--bp-text);
}
.lpo-progress-text b {
    color: var(--bp-text-strong);
}
.lpo-progress-bars {
    display: flex;
    gap: 6px;
}
.lpo-progress-bar {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--bp-fill);
    overflow: hidden;
}
.lpo-progress-fill {
    height: 100%;
    border-radius: 3px;
    background: #2AA3B8;
    transition: width .3s ease;
}

/* ─── Gegner-Tabelle ─── */
.lpo-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 46px;
    padding: 6px 0;
    border: none;
    border-bottom: 1px solid var(--bp-border);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.lpo-row:focus-visible {
    outline: 2px solid var(--main-color);
    outline-offset: -2px;
    border-radius: 8px;
}
.lpo-row--head {
    min-height: 0;
    padding: 0 0 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: var(--bp-text-muted);
    cursor: default;
}

.lpo-col-opponent {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}
.lpo-col-result {
    flex: 0 0 76px;
    display: flex;
    justify-content: center;
}

.lpo-rank {
    flex: 0 0 18px;
    font-size: 12px;
    color: var(--bp-text-faint);
    text-align: right;
}
.lpo-avatar {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 700;
    opacity: 1;
    --avatar-background: var(--bp-fill);
    --avatar-color: var(--bp-text-muted);
}
.lpo-name {
    overflow: hidden;
    font-size: 14px;
    font-weight: 700;
    color: var(--bp-text-strong);
    white-space: nowrap;
}

.lpo-result {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 32px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
}
.lpo-result--win {
    background: var(--bp-success-weak);
    color: var(--bp-success-strong);
}
.lpo-result--loss {
    background: var(--bp-danger-weak);
    color: var(--bp-danger-strong);
}
.lpo-result--open {
    border: 1px dashed var(--bp-border-strong);
    color: var(--bp-text-faint);
    font-weight: 600;
}

/* ─── Details einer Paarung ─── */
.lpo-detail {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 8px 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--bp-fill-soft);
    font-size: 13px;
}
.lpo-detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 28px;
}
.lpo-detail-label {
    color: var(--bp-text);
}
.lpo-detail-value {
    color: var(--bp-text-strong);
    text-align: right;
}
.lpo-detail-open {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--bp-text-muted);
}
.lpo-add {
    padding: 6px 12px;
    border: none;
    border-radius: 999px;
    background: var(--main-color);
    color: white;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
}
.lpo-add:focus-visible {
    outline: 2px solid var(--main-color);
    outline-offset: 2px;
}
</style>
