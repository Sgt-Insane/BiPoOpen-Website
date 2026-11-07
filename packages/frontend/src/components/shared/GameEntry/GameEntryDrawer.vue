<template>
    <BottomSheet v-model:visible="visible">
        <template #header>
            <div>
                <div class="ge-title">{{ title }}</div>
                <div v-if="subtitle" class="ge-subtitle">{{ subtitle }}</div>
            </div>
        </template>

        <div class="GameEntryDrawer">
            <!-- Zusatzauswahl ueber den Seiten, z.B. Pokal-Paarung -->
            <slot name="top" :sides="sides" :setTeams="setTeams"></slot>

            <div v-for="(side, sideIndex) in sides" :key="sideIndex"
                class="ge-side"
                :class="{ 'ge-side--winner': winnerIndex === sideIndex }"
            >
                <div class="ge-side-header">
                    <template v-if="lockedNames">
                        <Avatar v-if="getSideName(side)" :name="getSideName(side)" :avatarImage="side.logo" :shape="avatarShape" class="ge-team-avatar" />
                        <span v-else class="ge-team-avatar ge-team-avatar--empty">?</span>
                        <span class="ge-team-name" :class="{ 'ge-team-name--empty': !getSideName(side) }">{{ getSideName(side) || sideLabels[sideIndex] }}</span>
                        <EloChip v-if="side.players.length === 1" :rating="getElo(side.players[0].name)" />
                    </template>
                    <span v-else class="ge-side-label">{{ sideLabels[sideIndex] }}</span>

                    <span v-if="winnerIndex === sideIndex" class="ge-win-badge">Sieg</span>
                    <span v-if="!hideScores" class="ge-side-score" :class="{ 'ge-side-score--empty': totals[sideIndex] === null }">{{ totals[sideIndex] ?? '—' }}</span>
                </div>

                <div v-for="(player, playerIndex) in side.players" :key="playerIndex" class="ge-player">
                    <!-- Feste Namen: bei mehreren Spielern pro Seite steht der Name ueber den Treffern -->
                    <div v-if="lockedNames && side.players.length > 1" class="ge-player-name">
                        <Avatar :name="player.name" shape="circle" class="ge-player-avatar" />
                        <span>{{ player.name }}</span>
                        <EloChip :rating="getElo(player.name)" />
                    </div>

                    <template v-else-if="!lockedNames">
                        <slot name="player"
                            :side="side"
                            :sideIndex="sideIndex"
                            :player="player"
                            :playerIndex="playerIndex"
                            :excludedNames="getExcludedNames(player)"
                            :setName="(name: string) => setPlayerName(side, playerIndex, name)"
                        >
                            <GameEntryPlayerSearch
                                :modelValue="player.name"
                                :excludedNames="getExcludedNames(player)"
                                :removable="playerIndex > 0"
                                @update:modelValue="name => setPlayerName(side, playerIndex, name)"
                                @clear="clearPlayer(side, playerIndex)"
                            />
                        </slot>
                    </template>

                    <GameEntryScorePicker
                        v-if="!hideScores"
                        v-model="player.score"
                        :max="maxScore"
                        :chances="getScoreChances(sides, sideIndex, playerIndex, maxScore)"
                        :disabled="!player.name.trim()"
                        :label="`Treffer ${player.name || sideLabels[sideIndex]}`"
                    />
                </div>

                <button v-if="canAddPlayer(side)" type="button" class="ge-add-player" @click="addPlayer(side)">
                    <i class="pi pi-plus"></i>
                    Mitspieler ({{ side.players.length + 1 }} gegen {{ side.players.length + 1 }})
                </button>
            </div>

            <!-- Elo-Vorschau, sobald das Ergebnis feststeht -->
            <div v-if="eloChanges.length" class="ge-elo">
                <div class="ge-elo-header">
                    <span class="ge-elo-title">Elo nach diesem Spiel</span>
                    <button type="button" class="ge-elo-info" aria-label="Elo erklärt" @click="eloExplainedVisible = true">
                        <i class="pi pi-info"></i>
                    </button>
                </div>
                <div v-for="change in eloChanges" :key="change.name" class="ge-elo-row">
                    <span class="ge-elo-name">{{ change.name }}</span>
                    <span class="ge-elo-rating">{{ formatRating(change.before) }} → <b>{{ formatRating(change.after) }}</b></span>
                    <span class="ge-elo-delta" :class="change.delta > 0 ? 'ge-elo-up' : 'ge-elo-down'">{{ formatDelta(change.delta) }}</span>
                </div>
            </div>
            <EloExplainedSheet v-if="eloPreview" v-model:visible="eloExplainedVisible"/>

            <!-- Spiel live im BiPo Knecht zaehlen statt das Ergebnis einzutragen -->
            <button v-if="launch && !hideScores" type="button" class="ge-launch" :disabled="!canLaunch" @click="onLaunch()">
                <span class="ge-launch-icon">🎯</span>
                <span class="ge-launch-text">
                    <span class="ge-launch-title">Mit BiPo Knecht spielen</span>
                    <span class="ge-launch-subtitle">{{ canLaunch ? 'Jeden Wurf live zählen, Ergebnis wird automatisch eingetragen' : incompleteLabel }}</span>
                </span>
                <i class="pi pi-angle-right"></i>
            </button>

            <div class="ge-footer">
                <button v-if="remove" type="button" class="ge-button ge-button-delete" :disabled="loading" aria-label="Spiel löschen" @click="onDelete()">
                    <i class="pi pi-trash"></i>
                </button>
                <button v-if="launch && hideScores" type="button" class="ge-button ge-button-save" :disabled="!canLaunch" @click="onLaunch()">
                    {{ canLaunch ? 'BiPo Knecht starten' : launchIncompleteLabel }}
                </button>
                <button v-else type="button" class="ge-button ge-button-save" :disabled="!canSave || loading" @click="onSave()">
                    <i v-if="loading" class="pi pi-spin pi-spinner"></i>
                    <span v-else>{{ saveLabel }}</span>
                </button>
            </div>
        </div>
    </BottomSheet>
</template>

<script setup lang="ts">
/**
 * Gemeinsamer Drawer zum Eintragen/Bearbeiten eines Spiels (offene Spiele, Liga, Pokal, Turnier).
 * Standard: Spielersuche pro Platz. Abweichende Auswahl kommt von aussen:
 * - #player: ersetzt die Spielersuche (z.B. Liga-Team-Dropdown)
 * - #top: Inhalt ueber den Seiten (z.B. Pokal-Paarung), setzt die Seiten per setTeams
 * - lockedNames: Namen stehen fest (Turnier, Pokal), nur Treffer werden gewaehlt
 * - launch: Spiel stattdessen live im BiPo Knecht zaehlen (hideScores: nur Teams waehlen, ohne Treffer)
 * - eloPreview: Elo-Wechsel unter den Seiten, nur fuer neue Spiele (bearbeitete sind schon eingerechnet)
 */
import { computed, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import Avatar from '@/components/shared/Avatar.vue';
import EloChip from '@/components/shared/EloChip.vue';
import EloExplainedSheet from '@/components/frontend/worldRanking/EloExplainedSheet.vue';
import { useEloRatings } from '@/components/shared/useEloRatings';
import { ELO_START, getEloSideDeltas } from '@/components/frontend/worldRanking/eloRating';
import { getPlayerForLeagueTeam } from '@/components/frontend/league/LeaguePlayersData';
import GameEntryPlayerSearch from './GameEntryPlayerSearch.vue';
import GameEntryScorePicker from './GameEntryScorePicker.vue';
import { createEmptySides, getScoreChances, getSideName, getSideScore, type GameEntrySide } from './gameEntry';
import { PUSH_SETTINGS_PATH, usePushNotifications } from '@/components/shared/usePushNotifications';

const MAX_PLAYERS_PER_SIDE = 4;

const visible = defineModel<boolean>('visible', { default: false });

const props = withDefaults(defineProps<{
    title?: string;
    subtitle?: string;
    initialSides?: GameEntrySide[];     // Vorbelegung (Bearbeiten), sonst leer
    sideLabels?: [string, string];
    lockedNames?: boolean;
    allowExtraPlayers?: boolean;        // "+ Mitspieler" (2 gegen 2 ...)
    allowDraw?: boolean;
    maxScore?: number;
    incompleteLabel?: string;           // Button-Text, solange Namen fehlen
    avatarShape?: 'circle' | 'square';
    eloPreview?: boolean;
    save: (sides: GameEntrySide[]) => Promise<boolean | void>;
    remove?: () => Promise<boolean | void>;
    launch?: (sides: GameEntrySide[]) => void;
    hideScores?: boolean;
}>(), {
    title: 'Spiel eintragen',
    sideLabels: () => ['Seite 1', 'Seite 2'],
    allowDraw: true,
    maxScore: 21,
    incompleteLabel: 'Spieler wählen',
    avatarShape: 'circle',
});

const toast = useToast();
const sides = ref<GameEntrySide[]>(createEmptySides());
const loading = ref(false);
const { loadEloRatings, isEloLoaded, getElo } = useEloRatings();
const { status: pushStatus } = usePushNotifications();

// Bei jedem Oeffnen und jeder neuen Vorbelegung (z.B. anderer Spieltyp) frisch aus der Vorbelegung,
// die Eingaben eines abgebrochenen Versuchs verfallen.
watch([visible, () => props.initialSides], ([isVisible]) => {
    if (!isVisible) return;
    sides.value = props.initialSides ? JSON.parse(JSON.stringify(props.initialSides)) : createEmptySides();
    loadEloRatings();
}, { immediate: true });

// ─── Spieler ───
const allNames = computed(() => sides.value.flatMap(side => side.players.map(player => player.name.trim())).filter(name => name));

const getExcludedNames = (player: { name: string }) => allNames.value.filter(name => name !== player.name.trim());

const setPlayerName = (side: GameEntrySide, playerIndex: number, name: string) => {
    side.players[playerIndex].name = name;
}

// Zusaetzliche Mitspieler verschwinden ganz, der erste Platz wird nur geleert.
const clearPlayer = (side: GameEntrySide, playerIndex: number) => {
    if (playerIndex > 0)
        side.players.splice(playerIndex, 1);
    else
        side.players[0] = { name: '', score: null };
}

const canAddPlayer = (side: GameEntrySide) =>
    props.allowExtraPlayers && !props.lockedNames && side.players.length < MAX_PLAYERS_PER_SIDE;

const addPlayer = (side: GameEntrySide) => {
    side.players.push({ name: '', score: null });
}

// Fuer #top: setzt beide Seiten auf je ein Team (Treffer zurueckgesetzt).
const setTeams = (teams: { name: string; logo?: string }[]) => {
    sides.value = teams.map(team => ({ logo: team.logo, players: [{ name: team.name, score: null }] }));
}

// ─── Ergebnis ───
const totals = computed(() => sides.value.map(getSideScore));

const winnerIndex = computed(() => {
    const [score1, score2] = totals.value;
    if (score1 === null || score2 === null || score1 === score2) return -1;
    return score1 > score2 ? 0 : 1;
});

const hasAllNames = computed(() => sides.value.every(side => side.players.every(player => player.name.trim())));
const hasDuplicateNames = computed(() =>
    new Set(allNames.value.map(name => name.toLowerCase())).size !== allNames.value.length
);
const hasAllScores = computed(() => totals.value.every(total => total !== null));
const isDraw = computed(() => hasAllScores.value && totals.value[0] === totals.value[1]);

const canSave = computed(() =>
    hasAllNames.value && !hasDuplicateNames.value && hasAllScores.value && (props.allowDraw || !isDraw.value)
);

const saveLabel = computed(() => {
    if (!hasAllNames.value) return props.incompleteLabel;
    if (hasDuplicateNames.value) return 'Doppelt gewählt';
    if (!hasAllScores.value) return 'Treffer wählen';
    if (isDraw.value && !props.allowDraw) return 'Kein Unentschieden möglich';
    return `Ergebnis speichern · ${totals.value[0]} : ${totals.value[1]}`;
});

// ─── Elo ───
// Gleiche Rechnung wie die Weltrangliste, wer noch kein Spiel hat, startet bei ELO_START.
// Liga/Pokal: gewertet wird der Spieler hinter dem Team.
const eloExplainedVisible = ref(false);

const eloChanges = computed(() => {
    if (!props.eloPreview || !isEloLoaded.value || winnerIndex.value === -1 || !hasAllNames.value || hasDuplicateNames.value) return [];

    const ratings = sides.value.map(side => side.players.map(player => getElo(player.name) ?? ELO_START));
    const deltas = getEloSideDeltas(ratings, winnerIndex.value as 0 | 1);
    return sides.value.flatMap((side, sideIndex) => side.players.map((player, playerIndex) => {
        const before = ratings[sideIndex][playerIndex];
        const name = player.name.trim();
        return { name: getPlayerForLeagueTeam(name) ?? name, before, after: before + deltas[sideIndex], delta: deltas[sideIndex] };
    }));
});

const formatRating = (rating: number) => rating.toLocaleString('de-DE');
const formatDelta = (delta: number) => delta > 0 ? `+${delta}` : `−${-delta}`;

// ─── Aktionen ───
// Toasts nennen nur die Paarung (ggf. mit Ergebnis), ohne Beschreibung darunter.
// successExtra: wird erst nach Erfolg ausgewertet (z.B. einmaliger Push-Hinweis)
const runAction = async (action: () => Promise<boolean | void>, successSummary: string, errorSummary: string, successExtra: () => object = () => ({})) => {
    if (loading.value) return;
    loading.value = true;
    try {
        const success = await action();
        if (success === false) throw new Error(errorSummary);
        visible.value = false;
        const extra = successExtra();
        setTimeout(() => toast.add({ severity: 'success', summary: successSummary, life: 3000, ...extra }), 400);
    } catch {
        toast.add({ severity: 'error', summary: errorSummary, life: 3000 });
    } finally {
        loading.value = false;
    }
}

const onSave = () => {
    if (!canSave.value) return;
    const result: GameEntrySide[] = JSON.parse(JSON.stringify(sides.value));
    const [name1, name2] = result.map(getSideName);
    const playerNames = allNames.value.map(name => getPlayerForLeagueTeam(name) ?? name);
    runAction(() => props.save(result), `${name1} ${totals.value[0]} : ${totals.value[1]} ${name2}`, 'Spiel nicht gespeichert', () => takePushHint(playerNames));
}

// Einmalig nach dem ersten selbst eingetragenen Spiel (nur neue Spiele, wie eloPreview): Push anbieten.
// Die Seite folgt nach dem Aktivieren den Spielern dieses Spiels.
const PUSH_HINT_KEY = 'bp-push-hint-after-game';
const takePushHint = (playerNames: string[]) => {
    if (!props.eloPreview || pushStatus.value !== 'inactive') return {};
    try {
        if (localStorage.getItem(PUSH_HINT_KEY)) return {};
        localStorage.setItem(PUSH_HINT_KEY, '1');
    } catch {
        return {};
    }
    return {
        detail: 'Benachrichtigen, wenn deine Gegner spielen?',
        action: { label: 'Aktivieren ›', to: { path: PUSH_SETTINGS_PATH, query: { folgen: playerNames.join(',') } } },
        life: 8000,
    };
}

const onDelete = () => {
    if (!props.remove || !confirm('Spiel wirklich löschen?')) return;
    const [name1, name2] = sides.value.map(getSideName);
    runAction(props.remove, `Gelöscht · ${name1} gegen ${name2}`, 'Spiel nicht gelöscht');
}

// ─── BiPo Knecht ───
const canLaunch = computed(() => hasAllNames.value && !hasDuplicateNames.value);
const launchIncompleteLabel = computed(() => hasDuplicateNames.value ? 'Doppelt gewählt' : props.incompleteLabel);

const onLaunch = () => {
    if (!canLaunch.value || !props.launch) return;
    const result: GameEntrySide[] = JSON.parse(JSON.stringify(sides.value));
    visible.value = false;
    props.launch(result);
}
</script>

<style scoped>
.ge-title{
    font-size: 20px;
    font-weight: 700;
    color: var(--bp-text-strong);
    line-height: 1.2;
}
.ge-subtitle{
    font-size: 13px;
    color: var(--bp-text-muted);
}

.GameEntryDrawer{
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 100%;
}

/* ─── Seite ─── */
.ge-side{
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--bp-border);
    border-radius: 16px;
    background: var(--bp-surface);
    transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
}
.ge-side--winner{
    border-color: var(--main-color);
    background: var(--bp-primary-faint);
    box-shadow: 0 0 0 1px var(--main-color);
}

.ge-side-header{
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
}
.ge-side-label{
    flex: 1;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--bp-text-secondary);
}
.ge-team-avatar{
    width: 32px !important;
    height: 32px !important;
    min-width: 32px;
    font-size: 12px !important;
}
.ge-team-avatar--empty{
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-subtle);
    font-weight: 700;
}
.ge-team-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.ge-team-name--empty{
    color: var(--bp-text-faint);
    font-weight: 600;
}
.ge-win-badge{
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--main-color);
    color: white;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
}
.ge-side-score{
    min-width: 24px;
    text-align: right;
    font-size: 20px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.ge-side-score--empty{
    color: var(--bp-text-faint);
    font-weight: 600;
}

/* ─── Spieler ─── */
.ge-player{
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ge-player + .ge-player{
    padding-top: 10px;
    border-top: 1px dashed var(--bp-border);
}
.ge-player-name{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--bp-text-strong);
}
.ge-player-avatar{
    width: 24px !important;
    height: 24px !important;
    min-width: 24px;
    font-size: 10px !important;
}

.ge-add-player{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 38px;
    border: 1px dashed var(--bp-border-strong);
    border-radius: 10px;
    background: transparent;
    color: var(--bp-text);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
}
.ge-add-player:hover{
    background: var(--bp-fill-soft);
}
.ge-add-player .pi{
    font-size: 11px;
}

/* ─── Elo-Vorschau ─── */
.ge-elo{
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--bp-fill-soft);
}
.ge-elo-header{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
}
.ge-elo-title{
    font-size: 16px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.ge-elo-info{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    min-width: 22px;
    padding: 0;
    border: 1.5px solid var(--bp-text-subtle);
    border-radius: 50%;
    background: none;
    color: var(--bp-text-muted);
    cursor: pointer;
}
.ge-elo-info:hover{
    background: var(--bp-fill);
}
.ge-elo-info .pi{
    font-size: 9px;
    font-weight: 700;
}
.ge-elo-row{
    display: flex;
    align-items: baseline;
    gap: 12px;
    font-size: 16px;
    color: var(--bp-text-strong);
}
.ge-elo-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ge-elo-rating{
    color: var(--bp-text-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.ge-elo-rating b{
    color: var(--bp-text-strong);
    font-weight: 800;
}
.ge-elo-delta{
    min-width: 40px;
    text-align: right;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
}
.ge-elo-up{ color: var(--bp-success); }
.ge-elo-down{ color: var(--bp-danger); }

/* ─── BiPo Knecht ─── */
.ge-launch{
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--bp-border);
    border-radius: 16px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background .2s ease, opacity .2s ease;
}
.ge-launch:hover:not(:disabled){
    background: var(--bp-fill-soft);
}
.ge-launch:disabled{
    opacity: .55;
    cursor: default;
}
.ge-launch-icon{
    font-size: 22px;
}
.ge-launch-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}
.ge-launch-title{
    font-size: 15px;
    font-weight: 700;
}
.ge-launch-subtitle{
    font-size: 12px;
    color: var(--bp-text-muted);
}
.ge-launch .pi{
    color: var(--bp-text-faint);
}

/* ─── Footer ─── */
.ge-footer{
    position: sticky;
    bottom: 0;
    z-index: 1;
    display: flex;
    gap: 8px;
    margin-top: auto;
    padding-top: 12px;
    background: var(--bp-surface);
}
.ge-button{
    display: flex;
    align-items: center;
    justify-content: center;
    height: 52px;
    border: none;
    border-radius: 14px;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: background .2s ease, opacity .2s ease;
}
.ge-button-save{
    flex: 1;
    background: var(--main-color);
    color: white;
}
.ge-button-save:disabled{
    background: var(--bp-border-strong);
    cursor: default;
}
.ge-button-delete{
    width: 52px;
    min-width: 52px;
    border: 1px solid var(--bp-primary-weak);
    background: var(--bp-primary-faint);
    color: var(--main-color);
}
.ge-button-delete:hover:not(:disabled){
    background: var(--bp-primary-weak);
}
.ge-button:disabled{
    cursor: default;
}
.ge-button:focus-visible{
    outline: 2px solid var(--bp-text-strong);
    outline-offset: 2px;
}
</style>
