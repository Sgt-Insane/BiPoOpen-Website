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
                        <span class="ge-team-name" v-fit-text :class="{ 'ge-team-name--empty': !getSideName(side) }">{{ getSideName(side) || sideLabels[sideIndex] }}</span>
                        <EloChip v-if="side.players.length === 1" :rating="getElo(side.players[0].name)" />
                    </template>
                    <span v-else class="ge-side-label">{{ sideLabels[sideIndex] }}</span>

                    <span v-if="winnerIndex === sideIndex" class="ge-win-badge">Sieg</span>
                    <span v-if="entry !== 'track'" class="ge-side-score" :class="{ 'ge-side-score--empty': totals[sideIndex] === null }">{{ totals[sideIndex] ?? '—' }}</span>
                </div>

                <div v-if="side.players.length > 1 && entry !== 'track'" class="ge-side-hint">Treffer je Spieler · das Team-Ergebnis ist die Summe</div>

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
                                :placeholder="playerIndex > 0 ? `Mitspieler für ${sideLabels[sideIndex]} suchen …` : `Spieler für ${sideLabels[sideIndex]} suchen …`"
                                @update:modelValue="name => setPlayerName(side, playerIndex, name)"
                                @clear="clearPlayer(side, playerIndex)"
                            />
                        </slot>
                    </template>

                    <GameEntryScorePicker
                        v-if="entry !== 'track'"
                        v-model="player.score"
                        :max="maxScore"
                        :chances="getScoreChances(sides, sideIndex, playerIndex, maxScore)"
                        :disabled="!player.name.trim()"
                        :label="`Treffer ${player.name || sideLabels[sideIndex]}`"
                    />
                </div>

                <button v-if="canAddPlayer(side)" type="button" class="ge-add-player" :aria-label="`Mitspieler für ${sideLabels[sideIndex]} hinzufügen`" @click="addPlayer(side)">
                    <i class="pi pi-plus"></i>
                    Mitspieler hinzufügen
                </button>
                <!-- Optionaler Teamname, sobald eine Seite mehrere Spieler hat. Unter den Spielern, damit er beim
                     Hinzufuegen eines Mitspielers nicht ueber den Suchfeldern auftaucht (Nutzertest: Name landete als Teamname) -->
                <input
                    v-if="allowTeamName && !lockedNames && side.players.length > 1"
                    v-model="side.name"
                    class="ge-team-name-input"
                    type="text"
                    maxlength="30"
                    placeholder="Teamname (optional)"
                    autocomplete="off"
                    :aria-label="`Teamname ${sideLabels[sideIndex]}`"
                />
            </div>

            <!-- Offene Spiele: gewaehlte Spieler zufaellig auf die Teams verteilen -->
            <button v-if="canShuffle" type="button" class="ge-add-player ge-shuffle" @click="shuffleTeams()">
                <i class="pi pi-sync"></i>
                Teams auslosen
            </button>

            <!-- Unmoeglicher Spielstand (z.B. 2 gegen 2 mit je 10 Treffern): Warnung, Speichern gesperrt -->
            <div v-if="isImpossible" class="ge-warning" role="alert">
                <i class="pi pi-exclamation-triangle"></i>
                <span><b>Unmöglicher Spielstand.</b> Bis 10 gespielt, mehr nur in der Verlängerung (je 3 Becher). Bei mehreren Spielern zählen die Treffer zusammen.</span>
            </div>

            <!-- Elo-Vorschau, sobald das Ergebnis feststeht -->
            <div v-if="eloChanges.length && !isImpossible" class="ge-elo">
                <div class="ge-elo-header">
                    <span class="ge-elo-title">Elo nach diesem Spiel</span>
                    <button type="button" class="ge-elo-info" aria-label="Elo erklärt" @click="eloExplainedVisible = true">
                        <i class="pi pi-info"></i>
                    </button>
                </div>
                <div v-for="change in eloChanges" :key="change.name" class="ge-elo-row">
                    <span class="ge-elo-name" v-fit-text>{{ change.name }}</span>
                    <span class="ge-elo-rating">{{ formatRating(change.before) }} → <b>{{ formatRating(change.after) }}</b></span>
                    <span class="ge-elo-delta" :class="change.delta > 0 ? 'ge-elo-up' : 'ge-elo-down'">{{ formatDelta(change.delta) }}</span>
                </div>
            </div>
            <EloExplainedSheet v-if="eloPreview" v-model:visible="eloExplainedVisible"/>

            <!-- Spiel live mit dem BiPo Knecht tracken statt das Ergebnis einzutragen (nur ohne Auswahl vorher) -->
            <button v-if="launch && entry === 'both'" type="button" class="ge-launch" :disabled="!canLaunch" @click="onLaunch()">
                <span class="ge-launch-icon">🎯</span>
                <span class="ge-launch-text">
                    <span class="ge-launch-title">Mit dem BiPo Knecht tracken</span>
                    <span class="ge-launch-subtitle">{{ canLaunch ? 'Jeden Wurf live zählen, Ergebnis wird automatisch eingetragen' : missingLabel }}</span>
                </span>
                <i class="pi pi-angle-right"></i>
            </button>
            <!-- Mehrere Handys: Lobby per Anstossen, oder einem laufenden Knecht-Spiel mit Code beitreten -->
            <div v-if="launch && entry === 'both' && isFeatureOn('anstossen')" class="ge-more">
                <button type="button" class="ge-join" @click="onBump()">
                    <i class="pi pi-mobile"></i> Jeder mit eigenem Handy? <b>Zum Anstoßen 🍻</b><DevBadge feature="anstossen" />
                </button>
                <button type="button" class="ge-join" @click="onJoin()">
                    <i class="pi pi-sign-in"></i> Spiel läuft schon? <b>Mit PIN beitreten</b><DevBadge feature="anstossen" />
                </button>
            </div>

            <!-- Tracken: gleicher Knopf wie beim Eintragen, startet den BiPo Knecht -->
            <div v-if="entry === 'track'" class="ge-footer">
                <button type="button" class="ge-button ge-button-save" :disabled="!canLaunch" @click="onLaunch()">
                    {{ canLaunch ? 'Spiel starten' : hasDuplicateNames ? 'Doppelt gewählt' : incompleteLabel }}
                </button>
            </div>
            <div v-else class="ge-footer">
                <button v-if="remove" type="button" class="ge-button ge-button-delete" :disabled="loading" aria-label="Spiel löschen" @click="onDelete()">
                    <i class="pi pi-trash"></i>
                </button>
                <button type="button" class="ge-button ge-button-save" :disabled="!canSave || loading" @click="onSave()">
                    <i v-if="loading" class="pi pi-spin pi-spinner"></i>
                    <span v-else>{{ saveLabel }}</span>
                </button>
            </div>
        </div>
    </BottomSheet>
</template>

<script setup lang="ts">
import DevBadge from '@/components/shared/DevBadge.vue';
import { requestBumpPermission } from '@/components/frontend/multiplayer/useBump';
/**
 * Gemeinsamer Drawer zum Eintragen/Bearbeiten eines Spiels (offene Spiele, Liga, Pokal, Turnier).
 * Standard: Spielersuche pro Platz. Abweichende Auswahl kommt von aussen:
 * - #player: ersetzt die Spielersuche (z.B. Liga-Team-Dropdown)
 * - #top: Inhalt ueber den Seiten (z.B. Pokal-Paarung), setzt die Seiten per setTeams
 * - lockedNames: Namen stehen fest (Turnier, Pokal), nur Treffer werden gewaehlt
 * - launch: Spiel stattdessen live im BiPo Knecht zaehlen
 * - eloPreview: Elo-Wechsel unter den Seiten, nur fuer neue Spiele (bearbeitete sind schon eingerechnet)
 */
import { computed, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import router from '@/router.js';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import Avatar from '@/components/shared/Avatar.vue';
import EloChip from '@/components/shared/EloChip.vue';
import EloExplainedSheet from '@/components/frontend/worldRanking/EloExplainedSheet.vue';
import { useEloRatings } from '@/components/shared/useEloRatings';
import { ELO_START, getEloDeltas } from '@/components/frontend/worldRanking/eloRating';
import { getPlayerForLeagueTeam } from '@/components/frontend/league/LeaguePlayersData';
import GameEntryPlayerSearch from './GameEntryPlayerSearch.vue';
import GameEntryScorePicker from './GameEntryScorePicker.vue';
import { createEmptySides, getScoreChances, getSideName, getSideScore, isImpossibleScore, type GameEntrySide } from './gameEntry';
import { PUSH_SETTINGS_PATH, usePushNotifications } from '@/components/shared/usePushNotifications';
import { isFeatureOn } from '@/util/featureFlags';

const MAX_PLAYERS_PER_SIDE = 4;

const visible = defineModel<boolean>('visible', { default: false });

const props = withDefaults(defineProps<{
    title?: string;
    subtitle?: string;
    initialSides?: GameEntrySide[];     // Vorbelegung (Bearbeiten), sonst leer
    sideLabels?: [string, string];
    lockedNames?: boolean;
    allowExtraPlayers?: boolean;        // "+ Mitspieler" (2 gegen 2 ...)
    allowTeamName?: boolean;            // optionaler Teamname bei mehreren Spielern pro Seite (offene Spiele)
    allowDraw?: boolean;
    maxScore?: number;
    incompleteLabel?: string;           // Button-Text, solange Namen fehlen
    avatarShape?: 'circle' | 'square';
    eloPreview?: boolean;
    save: (sides: GameEntrySide[]) => Promise<boolean | void>;
    remove?: () => Promise<boolean | void>;
    launch?: (sides: GameEntrySide[]) => void;
    // both: Treffer eintragen oder mit dem Knecht tracken; track: nur Teams waehlen, dann Knecht; result: nur Treffer
    entry?: 'both' | 'track' | 'result';
}>(), {
    entry: 'both',
    title: 'Spiel eintragen',
    sideLabels: () => ['Team 1', 'Team 2'],
    allowDraw: true,
    maxScore: 21,
    incompleteLabel: 'Spieler wählen',
    avatarShape: 'circle',
});

const toast = useToast();
const sides = ref<GameEntrySide[]>(createEmptySides());
const loading = ref(false);
const { loadEloRatings, isEloLoaded, getElo, getEloState } = useEloRatings();
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

// Teams auslosen: ab drei gewaehlten Spielern und solange noch keine Treffer eingetragen sind.
// Die Platzzahl je Team bleibt, nur die Namen werden gemischt.
const canShuffle = computed(() => !props.lockedNames
    && sides.value.flatMap(side => side.players).filter(player => player.name.trim()).length >= 3
    && sides.value.every(side => side.players.every(player => player.score === null)));
const shuffleTeams = () => {
    const names = sides.value.flatMap(side => side.players.map(player => player.name.trim())).filter(Boolean);
    for (let index = names.length - 1; index > 0; index--) {
        const swap = Math.floor(Math.random() * (index + 1));
        [names[index], names[swap]] = [names[swap], names[index]];
    }
    // abwechselnd verteilen, damit beide Teams gleich viele bekommen
    const slots = [0, 1].flatMap(sideIndex => sides.value[sideIndex].players.map((_, playerIndex) => ({ sideIndex, playerIndex })))
        .sort((first, second) => first.playerIndex - second.playerIndex || first.sideIndex - second.sideIndex);
    sides.value.forEach(side => { side.name = ''; side.players.forEach(player => { player.name = ''; }); });
    names.forEach((name, index) => {
        const slot = slots[index];
        if (slot) sides.value[slot.sideIndex].players[slot.playerIndex].name = name;
    });
};

const setPlayerName = (side: GameEntrySide, playerIndex: number, name: string) => {
    side.players[playerIndex].name = name;
}

// Zusaetzliche Mitspieler verschwinden ganz, der erste Platz wird nur geleert.
const clearPlayer = (side: GameEntrySide, playerIndex: number) => {
    if (playerIndex > 0)
        side.players.splice(playerIndex, 1);
    else
        side.players[0] = { name: '', score: null };
    // Teamname gibt es nur bei mehreren Spielern: im 1 gegen 1 heisst die Seite wie der Spieler
    if (props.allowTeamName && side.players.length === 1) side.name = '';
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

// Leere Plaetze (z.B. aus Versehen "Mitspieler hinzufuegen") zaehlen nicht, egal an welcher Stelle:
// weder als fehlender Spieler noch beim Speichern. Nur ein ganz leeres Team behaelt seinen einen Platz.
const filledSides = computed(() => sides.value.map(side => {
    const players = side.players.filter(player => player.name.trim() || player.score !== null);
    return { ...side, players: players.length ? players : side.players.slice(0, 1) };
}));

// ─── Ergebnis ───
const totals = computed(() => filledSides.value.map(getSideScore));

const winnerIndex = computed(() => {
    const [score1, score2] = totals.value;
    if (score1 === null || score2 === null || score1 === score2) return -1;
    return score1 > score2 ? 0 : 1;
});

const hasAllNames = computed(() => filledSides.value.every(side => side.players.every(player => player.name.trim())));
const hasDuplicateNames = computed(() =>
    new Set(allNames.value.map(name => name.toLowerCase())).size !== allNames.value.length
);
const hasAllScores = computed(() => totals.value.every(total => total !== null));
const isDraw = computed(() => hasAllScores.value && totals.value[0] === totals.value[1]);

const isImpossible = computed(() => hasAllScores.value && isImpossibleScore(totals.value[0]!, totals.value[1]!));

const canSave = computed(() =>
    hasAllNames.value && !hasDuplicateNames.value && hasAllScores.value && !isImpossible.value && (props.allowDraw || !isDraw.value)
);

const saveLabel = computed(() => {
    if (!hasAllNames.value) return props.incompleteLabel;
    if (hasDuplicateNames.value) return 'Doppelt gewählt';
    if (!hasAllScores.value) {
        // Bei mehreren Spielern pro Team zaehlt jeder einzeln: sagen, wer noch fehlt
        const missing = filledSides.value.flatMap(side => side.players).find(player => player.score === null);
        return missing?.name.trim() ? `Treffer für ${missing.name.trim()} wählen` : 'Treffer wählen';
    }
    if (isImpossible.value) return `Unmöglicher Spielstand · ${totals.value[0]} : ${totals.value[1]}`;
    if (isDraw.value && !props.allowDraw) return 'Kein Unentschieden möglich';
    return `Ergebnis speichern · ${totals.value[0]} : ${totals.value[1]}`;
});

// ─── Elo ───
// Gleiche Rechnung wie die Weltrangliste (mit Becher-Differenz und Treffern), wer noch kein Spiel hat, startet bei ELO_START.
// Liga/Pokal: gewertet wird der Spieler hinter dem Team.
const eloExplainedVisible = ref(false);

const eloChanges = computed(() => {
    if (!props.eloPreview || !isEloLoaded.value || winnerIndex.value === -1 || !hasAllNames.value || hasDuplicateNames.value) return [];

    const states = filledSides.value.map(side => side.players.map(player => getEloState(player.name) ?? { rating: ELO_START, games: 0 }));
    const deltas = getEloDeltas(states, {
        winner: winnerIndex.value as 0 | 1,
        scores: totals.value as [number, number],
        hits: filledSides.value.map(side => side.players.map(player => player.score ?? 0)),
    });
    return filledSides.value.flatMap((side, sideIndex) => side.players.map((player, playerIndex) => {
        const before = states[sideIndex][playerIndex].rating;
        const delta = deltas[sideIndex][playerIndex];
        const name = player.name.trim();
        return { name: getPlayerForLeagueTeam(name) ?? name, before, after: before + delta, delta };
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
    const result: GameEntrySide[] = JSON.parse(JSON.stringify(filledSides.value));
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

// Was fehlt noch fuer den Knecht? z.B. "Noch 1 Spieler für Team 2"
const missingLabel = computed(() => {
    if (hasDuplicateNames.value) return 'Ein Spieler ist doppelt gewählt';
    const missing = filledSides.value.map(side => side.players.filter(player => !player.name.trim()).length);
    const parts = missing.flatMap((count, index) => count ? [`${count} Spieler für ${props.sideLabels[index]}`] : []);
    return parts.length ? `Noch ${parts.join(' und ')} wählen` : props.incompleteLabel;
});

// Code vom anderen Handy: 4 Ziffern = Anstoss-Lobby, sonst Code eines laufenden Knecht-Spiels
const onJoin = () => {
    const answer = window.prompt('PIN vom anderen Handy (in der Lobby oder im Knecht-Menü unter „Live“):');
    if (answer === null) return;
    const code = answer.trim().replace(/\s/g, '');
    if (!code) {
        toast.add({ severity: 'warn', summary: 'Keine PIN eingegeben', detail: 'Die PIN zeigt das andere Handy in der Lobby oder im Knecht-Menü unter „Live“.', life: 4000 });
        return;
    }
    visible.value = false;
    if (/^\d{4}$/.test(code)) router.push(`/Mitspielen/${code}`);
    else router.push({ path: '/Knecht', query: { join: code.toUpperCase() } });
};

// Antippen = Bestaetigung: Sensor gleich freischalten (iPhone fragt hier), die Anstoss-Seite lauscht sofort
const onBump = () => {
    requestBumpPermission();
    visible.value = false;
    router.push({ path: '/Mitspielen', query: { anstossen: '1' } });
};

const onLaunch = () => {
    if (!canLaunch.value || !props.launch) return;
    const result: GameEntrySide[] = JSON.parse(JSON.stringify(filledSides.value));
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

.ge-team-name-input{
    width: 100%;
    margin-top: 8px;
    height: 38px;
    padding: 0 12px;
    border: 1.5px solid var(--bp-border);
    border-radius: 10px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
}
.ge-team-name-input::placeholder{
    font-weight: 500;
    color: var(--bp-text-subtle);
}
.ge-team-name-input:focus{
    outline: none;
    border-color: var(--main-color);
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
.ge-side-hint{
    font-size: 12px;
    color: var(--bp-text-faint);
    margin: -2px 0 6px;
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
.ge-warning{
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, #E5484D 12%, transparent);
    color: var(--bp-text, inherit);
    font-size: 14px;
    line-height: 1.4;
}
.ge-warning .pi{
    margin-top: 2px;
    color: #E5484D;
}
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
.ge-more{
    display: flex;
    flex-direction: column;
    margin-top: -4px;
}
.ge-join{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: -4px;
    padding: 6px 8px;
    border: none;
    background: none;
    color: var(--bp-text-muted);
    font: inherit;
    font-size: 13px;
    cursor: pointer;

    b { color: var(--main-color); }
}
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
