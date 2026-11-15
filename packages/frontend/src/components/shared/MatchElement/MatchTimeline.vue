<template>
    <div class="MatchTimeline">
        <div class="mtl-header">
            <span class="mtl-title">Spielverlauf</span>
            <span v-if="duration || match.referee" class="mtl-duration">
                <template v-if="match.referee"><i class="pi pi-flag" aria-hidden="true"></i> Schiri: {{ match.referee }}</template>
                <template v-if="match.referee && duration"> · </template>{{ duration }}
            </span>
            <button v-if="showShare" type="button" class="mtl-share" @click="shareOpen = true">
                <i class="pi pi-share-alt"></i> Story-Overlay
            </button>
        </div>
        <BottomSheet v-if="showShare" v-model:visible="shareOpen">
            <template #header><span class="mtl-share-title">Story-Overlay</span></template>
            <ShareStickerPanel v-if="shareOpen" :match="match" :eloDeltas="eloDeltas" />
        </BottomSheet>

        <!-- Spieler: Trefferquote und Elo-Gewinn/-Verlust je Person -->
        <div v-if="playerRows.length" class="mtl-elo">
            <span class="mtl-title">Spieler</span>
            <div class="mtl-elo-teams">
                <div v-for="team in playerRows" :key="team.teamIndex" class="mtl-elo-team" :style="{ '--mtl-team-color': getTeamColor(match, team.teamIndex) }">
                    <div v-for="row in team.players" :key="row.name" class="mtl-player-row">
                        <div class="mtl-elo-row">
                            <span class="mtl-elo-name">{{ row.name }}</span>
                            <template v-if="row.elo">
                                <span class="mtl-elo-delta" :class="row.elo.delta >= 0 ? 'mtl-elo-delta--up' : 'mtl-elo-delta--down'">{{ row.elo.delta >= 0 ? '+' : '−' }}{{ Math.abs(row.elo.delta) }}</span>
                                <span class="mtl-elo-rating" title="Elo nach dem Spiel">→ {{ row.elo.rating.toLocaleString('de-DE') }} Elo</span>
                            </template>
                        </div>
                        <div class="mtl-accuracy">
                            <span class="mtl-accuracy-bar"><span :style="{ width: `${row.accuracy}%` }"></span></span>
                            <span class="mtl-accuracy-label">{{ row.hits }}/{{ row.throws }} Treffer · {{ row.accuracy }} %</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Knecht Pro: Wurfzeiten (nur wenn "Zug starten" genutzt wurde) -->
        <div v-if="throwTimeRows.length" class="mtl-elo">
            <span class="mtl-title">Wurfzeit <small class="mtl-subtitle">netto {{ formatSeconds(throwTimes!.netSeconds) }} ohne Bälleholen</small></span>
            <div class="mtl-elo-teams">
                <div v-for="team in throwTimeRows" :key="team.teamIndex" class="mtl-elo-team" :style="{ '--mtl-team-color': getTeamColor(match, team.teamIndex) }">
                    <div v-for="row in team.players" :key="row.name" class="mtl-elo-row">
                        <span class="mtl-elo-name">{{ row.name }}</span>
                        <span class="mtl-elo-rating">Ø {{ formatSeconds(row.average) }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Highlights wie beim Fussball: besondere Wuerfe und Wendepunkte, antippen springt zur Stelle -->
        <div v-if="highlights.length" class="mtl-highlights">
            <span class="mtl-title">Highlights</span>
            <div class="mtl-highlight-list">
                <button v-for="highlight in highlights" :key="highlight.key" type="button" class="mtl-highlight"
                    :style="{ '--mtl-team-color': getTeamColor(match, highlight.teamIndex) }" @click="scrollToRow(highlight.rowKey)">
                    <span class="mtl-highlight-minute">{{ highlight.minute !== null ? `${highlight.minute}'` : '' }}</span>
                    <span class="mtl-highlight-icon"><KnechtIcon :name="highlight.icon" /></span>
                    <span class="mtl-text">
                        <span class="mtl-label"><GlossaryText :text="highlight.title" /></span>
                        <span class="mtl-player">{{ highlight.detail }}</span>
                    </span>
                </button>
            </div>
        </div>

        <!-- Auszeichnungen wie am Spielende im Knecht -->
        <div v-if="awards.length && !live" class="mtl-awards">
            <span class="mtl-title">Auszeichnungen</span>
            <div class="mtl-award-list">
                <div v-for="award in awards" :key="award.key" class="mtl-award" :style="{ '--mtl-team-color': getTeamColor(match, award.teamIndex) }">
                    <span class="mtl-award-icon" aria-hidden="true">{{ award.icon }}</span>
                    <span class="mtl-text">
                        <span class="mtl-label">{{ award.title }} · {{ award.player }}</span>
                        <span class="mtl-player">{{ award.detail }}</span>
                    </span>
                </div>
            </div>
        </div>

        <!-- Becherverlauf: wer lag wann vorne? -->
        <svg v-if="chartLines.length" class="mtl-chart" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
            <line v-for="y in [2, 21, 40]" :key="y" x1="0" x2="100" :y1="y" :y2="y" class="mtl-chart-grid" vector-effect="non-scaling-stroke" />
            <polyline v-for="line in chartLines" :key="line.teamIndex" :points="line.points" :stroke="getTeamColor(match, line.teamIndex)" class="mtl-chart-line" vector-effect="non-scaling-stroke" />
        </svg>
        <div v-if="chartLines.length" class="mtl-chart-legend">
            <span v-for="line in chartLines" :key="line.teamIndex" class="mtl-chart-key" :style="{ '--mtl-team-color': getTeamColor(match, line.teamIndex) }">{{ getSideName(line.teamIndex) }}</span>
            <span class="mtl-chart-caption">getroffene Becher im Spielverlauf</span>
        </div>

        <!-- Siegchance: aus Elo vor dem Spiel und Trefferquote im Spiel. Nur waehrend des Spiels,
             im fertigen Verlauf steht am Ende ohnehin 100 % : 0 % -->
        <div v-if="live && winLine" class="mtl-win">
            <div class="mtl-win-head">
                <span class="mtl-win-title">Siegchance</span>
                <span class="mtl-win-now">
                    <b :style="{ color: getTeamColor(match, 0) }">{{ Math.round(winLine.current * 100) }} %</b>
                    <span> : </span>
                    <b :style="{ color: getTeamColor(match, 1) }">{{ 100 - Math.round(winLine.current * 100) }} %</b>
                </span>
            </div>
            <svg class="mtl-win-chart" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <clipPath :id="`mtl-win-top-${uid}`"><rect x="0" y="0" width="100" height="20" /></clipPath>
                    <clipPath :id="`mtl-win-bottom-${uid}`"><rect x="0" y="20" width="100" height="20" /></clipPath>
                </defs>
                <polygon :points="winLine.area" :fill="getTeamColor(match, 0)" fill-opacity=".22" :clip-path="`url(#mtl-win-top-${uid})`" />
                <polygon :points="winLine.area" :fill="getTeamColor(match, 1)" fill-opacity=".22" :clip-path="`url(#mtl-win-bottom-${uid})`" />
                <line x1="0" x2="100" y1="20" y2="20" class="mtl-chart-grid" vector-effect="non-scaling-stroke" />
                <polyline :points="winLine.points" class="mtl-win-line" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="mtl-chart-legend">
                <span class="mtl-chart-key" :style="{ '--mtl-team-color': getTeamColor(match, 0) }">{{ getSideName(0) }} oben</span>
                <span class="mtl-chart-key" :style="{ '--mtl-team-color': getTeamColor(match, 1) }">{{ getSideName(1) }} unten</span>
                <span class="mtl-chart-caption">aus Elo vor dem Spiel und Trefferquote im Spiel</span>
            </div>
        </div>

        <!-- Becher-Dreieck: welcher Becher wann und von wem (aufklappbar) -->
        <button v-if="hasCupFalls" type="button" class="mtl-expand" :aria-expanded="showTriangle" @click="showTriangle = !showTriangle">
            <span>Becher-Dreieck · was fiel wann</span>
            <i class="pi" :class="showTriangle ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
        </button>
        <MatchCupTriangle v-if="hasCupFalls && showTriangle" :match="match" />

        <!-- Alle Wuerfe: Team 1 links, Team 2 rechts, in der Mitte Zwischenstand. Fehlwuerfe kleiner und grau,
             Re-Rack/Nachwurf/Verlaengerung in der Mitte. Jede Spielminute als graue Zahl, auch ohne Wurf. -->
        <!-- Lange Spiele: Fehlwuerfe ausblendbar -->
        <div v-if="quietCount" class="mtl-filter" role="radiogroup" aria-label="Würfe filtern">
            <button type="button" role="radio" :aria-checked="!onlyHits" :class="{ 'is-active': !onlyHits }" @click="setOnlyHits(false)">Alle Würfe <small>{{ rows.length }}</small></button>
            <button type="button" role="radio" :aria-checked="onlyHits" :class="{ 'is-active': onlyHits }" @click="setOnlyHits(true)">Nur Treffer <small>{{ rows.length - quietCount }}</small></button>
        </div>

        <div class="mtl-list">
            <!-- Wer steht auf welcher Seite: bleibt beim Scrollen oben sichtbar -->
            <div class="mtl-list-head">
                <span v-for="teamIndex in [0, 1]" :key="teamIndex" class="mtl-list-team" :class="`mtl-list-team--${teamIndex}`" :style="{ '--mtl-team-color': getTeamColor(match, teamIndex) }">{{ getSideName(teamIndex) }}</span>
            </div>
            <template v-for="item in items" :key="item.key">
            <div v-if="item.kind === 'minute'" class="mtl-minute-row">
                <span class="mtl-minute-mark">{{ item.minute }}'</span>
            </div>
            <div v-else-if="item.kind === 'event'" class="mtl-event-row" :style="{ '--mtl-team-color': getTeamColor(match, item.teamIndex) }">
                <span class="mtl-event"><KnechtIcon :name="item.icon" /> <GlossaryText :text="item.label" /></span>
            </div>
            <div v-else class="mtl-row" :ref="el => setRowElement(item.row.key, el)"
                :class="{ 'mtl-row--quiet': item.row.quiet, 'mtl-row--highlight': highlightKeys.has(item.row.key), 'mtl-row--flash': flashKey === item.row.key }"
                :style="{ '--mtl-team-color': getTeamColor(match, item.row.teamIndex) }">
                <template v-for="row in [item.row]" :key="row.key">
                <div class="mtl-side mtl-side--left">
                    <template v-if="row.teamIndex === 0">
                        <span class="mtl-text">
                            <span class="mtl-label"><GlossaryText :text="row.label" /></span>
                            <span v-if="row.player" class="mtl-player">{{ row.player }}</span>
                        </span>
                        <span class="mtl-icon"><KnechtIcon :name="getRowIcon(row)" /></span>
                    </template>
                </div>

                <div class="mtl-center">
                    <span v-if="row.quiet" class="mtl-dot"></span>
                    <span v-else class="mtl-score">
                        <span :class="{ 'mtl-score--changed': row.scoringTeam === 0 }">{{ row.score[0] }}</span>:<span :class="{ 'mtl-score--changed': row.scoringTeam === 1 }">{{ row.score[1] }}</span>
                    </span>
                    <span v-if="row.minute !== null && !hasMinuteGrid" class="mtl-minute">{{ row.minute }}'</span>
                </div>

                <div class="mtl-side mtl-side--right">
                    <template v-if="row.teamIndex === 1">
                        <span class="mtl-icon"><KnechtIcon :name="getRowIcon(row)" /></span>
                        <span class="mtl-text">
                            <span class="mtl-label"><GlossaryText :text="row.label" /></span>
                            <span v-if="row.player" class="mtl-player">{{ row.player }}</span>
                        </span>
                    </template>
                </div>
                </template>
            </div>
            </template>

            <div class="mtl-final">
                {{ live ? 'Stand' : 'Endstand' }} <strong>{{ finalScore[0] }} : {{ finalScore[1] }}</strong>
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, PropType, ref } from 'vue';
import GlossaryWord from '@/components/shared/GlossaryWord.vue';
import GlossaryText from '@/components/shared/GlossaryText.vue';
import KnechtIcon from '@/components/frontend/biPoKnecht/KnechtIcon.vue';
import { TURN_ICONS, type KnechtIconName } from '@/components/frontend/biPoKnecht/knechtIcons';
import { isHitTurnType } from '@/components/frontend/biPoKnecht/knechtEngine';
import { getAccuracy, getScoringTeam, getTurnCups, getTurnStats } from '@/components/frontend/biPoKnecht/knechtStats';
import { getEloPlayerKey } from '@/components/frontend/worldRanking/eloRating';
import { formatEdge } from '@/components/frontend/biPoKnecht/knechtEdges';
import { formatSeconds, getThrowTimes } from '@/components/frontend/biPoKnecht/knechtThrowTimes';
import { useEloRatings } from '@/components/shared/useEloRatings';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import MatchCupTriangle from './MatchCupTriangle.vue';
import { buildCupHistory, getTurnCupPositions } from './cupHistory';
import { getEloExpectation, getWinProbabilities } from './winProbability';
import ShareStickerPanel from '@/components/shared/ShareSticker/ShareStickerPanel.vue';
import { isFeatureOn } from '@/util/featureFlags';
import { getTeamColor, formatDuration, formatPoints, getAwards, getPlayerName, getTeam, getTeamName } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';

// Spaltenkopf der Wurfliste: im 1 gegen 1 der Spieler, sonst die Spieler des Teams
const getSideName = (teamIndex: number) => getTeam(props.match, teamIndex).players.map(player => player.name).join(' & ');

const props = defineProps({
    match: { type: Object as PropType<Match>, required: true },
    // Laufendes Spiel (Live-Ticker): noch keine Auszeichnungen, "Stand" statt "Endstand"
    live: { type: Boolean, default: false },
});

const SHORT_LABELS: Partial<Record<Turn['type'], string>> = {
    bomb: 'Bombe',
    bouncer: 'Bouncer',
    onfire: 'On Fire',
    ballsback: 'Balls Back',
    lastCup: 'Letzter Becher',
    deathcup: 'Deathcup',
    owncup: 'Eigener Becher',
    penalty: 'Strafbecher',
};

type Row = {
    key: number;
    teamIndex: number;          // wer geworfen hat
    scoringTeam: number;        // wer die Becher bekommt, -1 wenn kein Becher faellt
    icon: KnechtIconName;
    label: string;
    player: string;
    minute: number | null;
    time: number;
    score: [number, number];
    quiet: boolean;             // Fehlwurf, Airball, gefangener Trickshot: kein Becher
};

const turns = computed(() => props.match.turns ?? []);
const duration = computed(() => formatDuration(props.match.time, props.match.endTime));

const getData = (turn: Turn) => (turn.data ?? {}) as Record<string, unknown>;

const isTrickshotHit = (turn: Turn, previous?: Turn) =>
    previous?.type === 'trickshot' && previous.teamIndex === turn.teamIndex && getData(previous).catcherIndex === turn.playerIndex;

const QUIET_LABELS: Partial<Record<Turn['type'], string>> = {
    miss: 'Nullwurf',
    airball: 'Airball',
    trickshot: 'Trickshot-Fang',
    penalty: 'Gelbe Karte',
};

const HIT_FOLLOW_UPS = new Set<Turn['type']>(['hit', 'ballsback', 'onfire', 'bouncer']);

const getLabel = (turn: Turn, previous: Turn | undefined, cups: number) => {
    const data = getData(turn);
    if (turn.type === 'miss' && data.edge) return formatEdge(data.edge as EdgeHit);
    if (!cups && !isHitTurnType(turn.type)) return QUIET_LABELS[turn.type] ?? 'Verfehlt';
    const kinds = [
        SHORT_LABELS[turn.type],
        turn.type !== 'bouncer' && data.bouncer && 'Bouncer',
        (turn.type === 'trickshot' || isTrickshotHit(turn, previous)) && 'Trickshot',
    ].filter(Boolean);
    // Balls Back, On Fire, Bouncer und Trickshot sind Folgen eines Treffers: "Treffer · Balls Back"
    const label = !kinds.length ? 'Treffer' : HIT_FOLLOW_UPS.has(turn.type) ? `Treffer · ${kinds.join(' · ')}` : kinds.join(' · ');
    return cups > 1 && turn.type !== 'owncup' && turn.type !== 'penalty' ? `${label} +${cups}` : label;
};

const rows = computed<Row[]>(() => {
    const score: [number, number] = [0, 0];
    const start = props.match.time;
    const list: Row[] = [];

    turns.value.forEach((turn, index) => {
        const cups = getTurnCups(turn);
        const quiet = !cups && !isHitTurnType(turn.type);
        const scoringTeam = getScoringTeam(turn);
        score[scoringTeam] += cups;
        const team = getTeam(props.match, turn.teamIndex);
        list.push({
            key: index,
            teamIndex: turn.teamIndex,
            scoringTeam: cups ? scoringTeam : -1,
            icon: turn.type === 'hit' && isTrickshotHit(turn, turns.value[index - 1]) ? 'trickshot' : TURN_ICONS[turn.type],
            label: getLabel(turn, turns.value[index - 1], cups),
            player: getRowPlayer(turn, team, index),
            minute: start && turn.time ? Math.max(0, Math.floor((turn.time - start) / 60000)) : null,
            time: turn.time,
            score: [score[0], score[1]],
            quiet,
        });
    });
    return list;
});

// Getroffene Becher je Wurf, nummeriert wie beim Bowling (1 = Spitze, 7-10 = hinten, aus Sicht des Werfers).
// Aus dem Becher-Dreieck, damit der letzte Becher (vom Knecht an die Spitze gestellt) seine echte Nummer hat.
const cupNumbersByTurn = computed(() => {
    const map = new Map<number, number[]>();
    buildCupHistory(props.match)?.forEach(rack => rack.phases.forEach(phase =>
        Object.entries(phase.falls).forEach(([position, fall]) => map.set(fall.turnIndex, [...(map.get(fall.turnIndex) ?? []), Number(position) + 1]))));
    map.forEach(numbers => numbers.sort((first, second) => first - second));
    return map;
});

// Beim Trickshot-Fang: wer verfehlt hat und wer gefangen hat. Dahinter die getroffenen Becher.
const getRowPlayer = (turn: Turn, team: Team, turnIndex: number) => {
    const cups = cupNumbersByTurn.value.get(turnIndex);
    const cupText = cups?.length ? `Becher ${cups.join(', ')}` : '';
    if (team.players.length <= 1) return cupText;
    let name = getPlayerName(props.match, turn.teamIndex, turn.playerIndex);
    const catcher = getData(turn).catcherIndex;
    if (turn.type === 'trickshot' && typeof catcher === 'number') name = `${name} → ${getPlayerName(props.match, turn.teamIndex, catcher)}`;
    return [name, cupText].filter(Boolean).join(' · ');
};

// Re-Rack, Nachwurf, Verlaengerung (gespeichert seit dem neuen Knecht, aeltere Spiele haben keine)
const EVENT_LOOKS: Partial<Record<MatchEvent['kind'], { icon: KnechtIconName; label: (team: string) => string }>> = {
    reRack: { icon: 'reRack', label: team => `Re-Rack · ${team}` },
    nachwurf: { icon: 'nachwurf', label: team => `Nachwurf · ${team}` },
    overtime: { icon: 'overtime', label: () => 'Verlängerung' },
};

// ─── Highlights ───
type Highlight = { key: string; rowKey: number; teamIndex: number; minute: number | null; icon: KnechtIconName; title: string; detail: string };

const highlights = computed<Highlight[]>(() => {
    const list: Highlight[] = [];
    let leader = 0;     // -1 / 0 / 1: wer fuehrt
    rows.value.forEach(row => {
        const turn = turns.value[row.key];
        if (!turn) return;
        const name = getPlayerName(props.match, turn.teamIndex, turn.playerIndex);
        const add = (icon: KnechtIconName, title: string, detail = name, teamIndex = row.teamIndex) =>
            list.push({ key: `${row.key}-${title}`, rowKey: row.key, teamIndex, minute: row.minute, icon, title, detail });

        // Besondere Wuerfe
        if (turn.type === 'bomb') add('bomb', 'Bombe');
        if (turn.type === 'deathcup') add('deathcup', 'Deathcup');
        if (turn.type === 'lastCup') add('lastCup', 'Letzter Becher');
        if (turn.type === 'hit' && isTrickshotHit(turn, turns.value[row.key - 1])) add('trickshot', 'Trickshot');
        if (turn.type === 'penalty' && getData(turn).card === 'red') add('penalty', 'Rote Karte', name);
        const previousTurn = turns.value[row.key - 1];
        if (turn.type === 'onfire' && !(previousTurn?.type === 'onfire' && previousTurn.playerIndex === turn.playerIndex && previousTurn.teamIndex === turn.teamIndex))
            add('onfire', 'On Fire');

        // Wendepunkte im Spielstand (nur Becher-Eintraege)
        if (!row.quiet) {
            const lead = Math.sign(row.score[0] - row.score[1]);
            const scoreText = `${row.score[0]} : ${row.score[1]}`;
            if (lead === 0 && leader !== 0 && row.score[0] > 0) add('equalizer', 'Ausgleich', scoreText, row.scoringTeam >= 0 ? row.scoringTeam : row.teamIndex);
            else if (lead !== 0 && leader !== 0 && lead !== leader) add('leadChange', 'Führungswechsel', scoreText, lead > 0 ? 0 : 1);
            if (lead !== 0) leader = lead;
            else if (row.score[0] > 0) leader = 0;
        }
    });
    return list;
});
const highlightKeys = computed(() => new Set(highlights.value.map(highlight => highlight.rowKey)));
// Ausgleich und Fuehrungswechsel: in der Wurfliste mit eigenem Symbol statt des normalen Treffers
// (vorher nur ein farbiger Ring ums Treffer-Symbol, der nicht erklaert war)
const rowIcons = computed(() => new Map(highlights.value
    .filter(highlight => highlight.icon === 'equalizer' || highlight.icon === 'leadChange')
    .map(highlight => [highlight.rowKey, highlight.icon])));
const getRowIcon = (row: Row) => row.icon === 'hit' ? rowIcons.value.get(row.key) ?? row.icon : row.icon;

// Antippen eines Highlights: zur Zeile scrollen und sie kurz aufleuchten lassen
const rowElements = new Map<number, Element>();
const setRowElement = (key: number, element: unknown) => {
    if (element instanceof Element) rowElements.set(key, element);
    else rowElements.delete(key);
};
const flashKey = ref<number | null>(null);
const scrollToRow = async (key: number) => {
    // Ausgeblendeten Wurf (z.B. gefangener Trickshot) erst wieder einblenden
    if (onlyHits.value && rows.value.find(row => row.key === key)?.quiet) {
        onlyHits.value = false;
        await nextTick();
    }
    rowElements.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashKey.value = key;
    setTimeout(() => { if (flashKey.value === key) flashKey.value = null; }, 1600);
};

// Zeitachse: vor den Treffern jeder Minute eine Minutenmarke, auch fuer Minuten ohne Treffer
type EventItem = { kind: 'event'; key: string; icon: KnechtIconName; label: string; teamIndex: number };
type TimelineItem = { kind: 'minute'; key: string; minute: number } | { kind: 'row'; key: string; row: Row } | EventItem;
const hasMinuteGrid = computed(() => rows.value.length > 0 && rows.value.every(row => row.minute !== null));

// Wuerfe und Ereignisse in Spielreihenfolge: ein Ereignis steht vor dem Turn afterTurnIndex
const entries = computed(() => {
    const start = props.match.time ?? 0;
    const list: { position: number; minute: number | null; item: TimelineItem }[] = rows.value.map(row => ({
        position: row.key, minute: row.minute, item: { kind: 'row', key: `r${row.key}`, row },
    }));
    (props.match.events ?? []).forEach((event, index) => {
        const look = EVENT_LOOKS[event.kind];
        if (!look) return;
        const previous = rows.value.filter(row => row.key < event.afterTurnIndex).at(-1);
        const minute = event.time && start ? Math.max(0, Math.floor((event.time - start) / 60000)) : previous?.minute ?? 0;
        // Re-Rack steht auf der Seite des Teams, das es verlangt hat (wie ein Wurf), Nachwurf/Verlaengerung in der Mitte
        const item: TimelineItem = event.kind === 'reRack'
            ? { kind: 'row', key: `e${index}`, row: {
                key: -1 - index, teamIndex: event.teamIndex, scoringTeam: -1, icon: look.icon, label: 'Re-Rack', player: '',
                minute, time: event.time ?? 0, score: previous?.score ?? [0, 0], quiet: true,
            } }
            : { kind: 'event', key: `e${index}`, icon: look.icon, label: look.label(getTeamName(props.match, event.teamIndex)), teamIndex: event.teamIndex };
        list.push({ position: event.afterTurnIndex - .5, minute, item });
    });
    return list.sort((a, b) => a.position - b.position);
});

// Filter "Nur Treffer": Fehlwuerfe, Airballs und gefangene Trickshots ausblenden (Re-Rack bleibt). Wahl wird gemerkt.
const ONLY_HITS_KEY = 'bp-timeline-only-hits';
// Standard: nur Treffer (die lange Liste der Fehlwuerfe nur auf Wunsch). Die Wahl bleibt auf dem Geraet gespeichert.
const onlyHits = ref((() => { try { return localStorage.getItem(ONLY_HITS_KEY) !== '0'; } catch { return true; } })());
const setOnlyHits = (value: boolean) => {
    onlyHits.value = value;
    try { localStorage.setItem(ONLY_HITS_KEY, value ? '1' : '0'); } catch { /* egal */ }
};
const quietCount = computed(() => rows.value.filter(row => row.quiet).length);
const isVisible = (item: TimelineItem) => !onlyHits.value || item.kind !== 'row' || !item.row.quiet || item.row.key < 0;

const items = computed<TimelineItem[]>(() => {
    if (!hasMinuteGrid.value) return entries.value.map(entry => entry.item).filter(isVisible);
    const start = props.match.time ?? 0;
    const lastMinute = Math.max(0, ...entries.value.map(entry => entry.minute ?? 0));
    const endMinute = props.match.endTime && start ? Math.floor((props.match.endTime - start) / 60000) : lastMinute;
    const list: TimelineItem[] = [];
    for (let minute = 0; minute <= Math.max(lastMinute, endMinute); minute++) {
        const inMinute = entries.value.filter(entry => (entry.minute ?? 0) === minute && isVisible(entry.item));
        // Nur Treffer: Minuten ohne sichtbaren Eintrag weglassen
        if (onlyHits.value && !inMinute.length) continue;
        list.push({ kind: 'minute', key: `m${minute}`, minute });
        inMinute.forEach(entry => list.push(entry.item));
    }
    return list;
});

// Endstand aus den gespeicherten Punkten (kann z.B. durch den Siegpunkt vom Becherstand abweichen)
const finalScore = computed(() => [props.match.team1, props.match.team2]
    .map(team => formatPoints(team.players.reduce((sum, player) => sum + (player.score ?? 0), 0))));

const playerStats = computed(() => {
    const points = [props.match.team1, props.match.team2].map(team => team.players.map(player => player.score ?? 0));
    return getTurnStats(props.match, turns.value, points);
});

// Elo je Spieler nach diesem Spiel (nicht gewertete Spiele, z.B. Unentschieden, zeigen nichts)
const { loadEloRatings, getMatchElo, getElo } = useEloRatings();
loadEloRatings();
// Je Spieler: Trefferquote aus dem Verlauf, dazu Elo (sobald geladen und das Spiel gewertet ist)
const playerRows = computed(() => {
    const sides = getMatchElo(props.match);
    const stats = playerStats.value;
    return [props.match.team1, props.match.team2].map((team, teamIndex) => ({
        teamIndex,
        players: team.players.map((player, playerIndex) => {
            const entry = stats.find(stat => stat.teamIndex === teamIndex && stat.playerIndex === playerIndex);
            const change = sides?.[teamIndex].playerChanges.find(item => item.key === getEloPlayerKey(player.name));
            return {
                name: player.name,
                hits: entry?.hits ?? 0,
                throws: entry?.throws ?? 0,
                accuracy: entry ? getAccuracy(entry) : 0,
                elo: change ? { delta: change.delta, rating: change.rating } : null,
            };
        }),
    }));
});

// ─── Siegchance ───
// Elo vor dem Spiel: aus der Wertung des Spiels (Wert danach minus Aenderung), live aus der aktuellen Elo
const uid = Math.random().toString(36).slice(2, 8);
const teamElo = (teamIndex: number) => {
    const team = teamIndex === 0 ? props.match.team1 : props.match.team2;
    const side = getMatchElo(props.match)?.[teamIndex];
    const ratings = team.players.map(player => {
        const change = side?.playerChanges.find(item => item.key === getEloPlayerKey(player.name));
        return change ? change.rating - change.delta : getElo(player.name);
    }).filter((rating): rating is number => typeof rating === 'number');
    return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null;
};
const winLine = computed(() => {
    if (!props.live || turns.value.length < 2) return null;
    const ratings = [teamElo(0), teamElo(1)];
    const expected = ratings[0] !== null && ratings[1] !== null ? getEloExpectation(ratings[0], ratings[1]) : .5;
    const points = getWinProbabilities(props.match, expected, !props.live);
    const start = points[0].time ?? props.match.time;
    const end = points[points.length - 1].time;
    const useTime = !!start && !!end && end > start && points.every(point => !!point.time);
    const toX = (index: number) => useTime ? ((points[index].time! - start!) / (end! - start!)) * 100 : index / (points.length - 1) * 100;
    const coords = points.map((point, index) => `${toX(index).toFixed(2)},${(40 - point.chance * 40).toFixed(2)}`);
    return {
        points: coords.join(' '),
        area: ['0,20', ...coords, `${toX(points.length - 1).toFixed(2)},20`].join(' '),
        current: points[points.length - 1].chance,
    };
});

// Becher-Dreieck nur, wenn der Verlauf zusammenpasst (alte Knecht-Spiele zaehlten Becher anders und kennen kein Re-Rack)
const showTriangle = ref(false);
const hasCupFalls = computed(() => turns.value.some(turn => getTurnCupPositions(turn).length) && buildCupHistory(props.match) !== null);

// Story-Overlay (noch im Entwicklermodus): Elo-Aenderung je Spieler fuer die Spieler-Vorlage
const showShare = computed(() => !props.live && isFeatureOn('shareOverlay'));
const shareOpen = ref(false);
const eloDeltas = computed(() => Object.fromEntries(playerRows.value.flatMap(team => team.players)
    .filter(player => player.elo).map(player => [player.name, player.elo!.delta])));

// Knecht Pro: Wurfzeit je Spieler
const throwTimes = computed(() => getThrowTimes(turns.value, props.match.events));
const throwTimeRows = computed(() => {
    const times = throwTimes.value;
    if (!times) return [];
    return [0, 1].map(teamIndex => ({
        teamIndex,
        players: times.players.filter(entry => entry.teamIndex === teamIndex)
            .map(entry => ({ name: getPlayerName(props.match, teamIndex, entry.playerIndex), average: entry.average })),
    })).filter(team => team.players.length);
});

// Gleiche Regeln wie auf dem Spielende-Bildschirm, damit die Webseite dieselben Titel zeigt
const awards = computed(() => {
    const stats = playerStats.value;
    return getAwards(stats).map((award, index) => ({
        ...award, key: index, teamIndex: stats[index].teamIndex, player: stats[index].name,
    }));
});

// Treppenlinie je Team: x = Spielzeit (oder Reihenfolge ohne Zeiten), y = abgeraeumte Becher
const chartLines = computed(() => {
    const list = rows.value.filter(row => !row.quiet);
    if (list.length < 2) return [];
    const start = props.match.time ?? list[0].time;
    const end = props.match.endTime ?? list[list.length - 1].time;
    const useTime = !!start && !!end && end > start && list.every(row => !!row.time);
    const maxScore = Math.max(1, ...list[list.length - 1].score);
    const toX = (row: Row, index: number) => useTime ? (row.time - start) / (end - start) * 100 : (index + 1) / list.length * 100;
    const toY = (score: number) => 40 - score / maxScore * 38;

    return [0, 1].map(teamIndex => {
        const points = ['0,40'];
        let current = 0;
        list.forEach((row, index) => {
            if (row.score[teamIndex] === current) return;
            const x = Math.min(100, Math.max(0, toX(row, index))).toFixed(2);
            points.push(`${x},${toY(current).toFixed(2)}`, `${x},${toY(row.score[teamIndex]).toFixed(2)}`);
            current = row.score[teamIndex];
        });
        points.push(`100,${toY(current).toFixed(2)}`);
        return { teamIndex, points: points.join(' ') };
    });
});
</script>

<style scoped>
.MatchTimeline{
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    padding: 10px 0 4px;
}
.mtl-header{
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 8px;
}
.mtl-title{
    font-size: 14px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.mtl-duration{
    order: 3;
    flex-basis: 100%;
    font-size: 12px;
    color: var(--bp-text-muted);
}
.mtl-share{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    padding: 6px 10px;
    white-space: nowrap;
    border: 1.5px solid var(--bp-border);
    border-radius: 999px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}
.mtl-share-title{
    font-size: 17px;
    font-weight: 800;
    color: var(--bp-text-strong);
}

/* ─── Elo ─── */
.mtl-elo{
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.mtl-elo-teams{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.mtl-elo-team{
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 6px 10px;
    border-left: 3px solid var(--mtl-team-color);
    border-radius: 8px;
    background: var(--bp-fill-soft);
}
.mtl-elo-row{
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
}
.mtl-elo-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 700;
    color: var(--bp-text);
}
.mtl-subtitle{
    margin-left: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--bp-text-muted);
}
.mtl-player-row{
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 3px 0;
}
.mtl-accuracy{
    display: flex;
    align-items: center;
    gap: 6px;
}
.mtl-accuracy-bar{
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--bp-border);
    overflow: hidden;
}
.mtl-accuracy-bar span{
    display: block;
    height: 100%;
    border-radius: 2px;
    background: var(--mtl-team-color);
}
.mtl-accuracy-label{
    font-size: 11px;
    color: var(--bp-text-muted);
    white-space: nowrap;
}
.mtl-elo-delta{
    font-weight: 800;
}
.mtl-elo-delta--up{ color: #1F8A70; }
.mtl-elo-delta--down{ color: #E5484D; }
.mtl-elo-rating{
    font-size: 11px;
    color: var(--bp-text-muted);
}

/* ─── Auszeichnungen ─── */
.mtl-awards{
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.mtl-award-list{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 6px;
}
.mtl-award{
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 6px 10px;
    border-left: 3px solid var(--mtl-team-color);
    border-radius: 8px;
    background: var(--bp-fill-soft);
}
.mtl-award-icon{
    flex: 0 0 auto;
    font-size: 18px;
    line-height: 1;
}

/* ─── Becherverlauf ─── */
.mtl-chart{
    width: 100%;
    height: 56px;
    overflow: visible;
}
.mtl-chart-grid{
    stroke: var(--bp-border);
    stroke-width: 1;
    stroke-dasharray: 3 4;
}
.mtl-chart-line{
    fill: none;
    stroke-width: 2.5;
    stroke-linejoin: round;
}

/* ─── Treffer ─── */
.mtl-list{
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.mtl-win{
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.mtl-win-head{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
}
.mtl-win-title{
    font-size: 14px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.mtl-win-now{
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    color: var(--bp-text-muted);
}
.mtl-win-chart{
    width: 100%;
    height: 90px;
}
.mtl-win-line{
    fill: none;
    stroke: var(--bp-text-strong);
    stroke-width: 2;
    stroke-linejoin: round;
}
.mtl-expand{
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
    padding: 0 12px;
    border: 1.5px solid var(--bp-border);
    border-radius: 12px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
}
.mtl-chart-legend{
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin: -4px 0 12px;
    font-size: 11px;
    color: var(--bp-text-muted);
}
.mtl-chart-key{
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 700;
    color: var(--bp-text);
}
.mtl-chart-key::before{
    content: '';
    width: 12px;
    height: 3px;
    border-radius: 2px;
    background: var(--mtl-team-color);
}
.mtl-chart-caption{
    margin-left: auto;
}
.mtl-filter{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin-bottom: 8px;
    padding: 3px;
    border-radius: 10px;
    background: var(--bp-fill);

    button {
        padding: 6px 0;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--bp-text-muted);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
    }
    button.is-active {
        background: var(--bp-surface);
        color: var(--bp-text-strong);
        box-shadow: 0 1px 3px rgba(0, 0, 0, .08);
    }
    small {
        margin-left: 3px;
        font-weight: 500;
        color: var(--bp-text-muted);
    }
}
.mtl-list-head{
    position: sticky;
    top: 54px;              /* unter der festen App-Leiste */
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr 58px 1fr;
    margin-bottom: 4px;
    padding: 6px 0;
    background: var(--bp-surface);
}
.mtl-list-team{
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 800;
    color: var(--mtl-team-color);
}
.mtl-list-team--0{
    grid-column: 1;
    text-align: right;
}
.mtl-list-team--1{
    grid-column: 3;
}
.mtl-list::before{
    content: '';
    position: absolute;
    top: 0;
    bottom: 22px;
    left: 50%;
    width: 2px;
    margin-left: -1px;
    background: var(--bp-border);
}
.mtl-row{
    display: grid;
    grid-template-columns: 1fr 58px 1fr;
    align-items: center;
    min-height: 30px;
}
.mtl-side{
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.mtl-side--left{
    justify-content: flex-end;
    text-align: right;
}
.mtl-text{
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.15;
}
.mtl-label{
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 700;
    color: var(--bp-text);
}
.mtl-player{
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
    color: var(--bp-text-muted);
}
.mtl-icon{
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--mtl-team-color) 14%, var(--bp-surface));
    color: var(--mtl-team-color);
    font-size: 14px;
}
.mtl-center{
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.mtl-score{
    padding: 1px 7px;
    border: 1px solid var(--bp-border);
    border-radius: 999px;
    background: var(--bp-surface);
    font-size: 11px;
    font-weight: 600;
    color: var(--bp-text-muted);
    font-variant-numeric: tabular-nums;
}
.mtl-score--changed{
    font-weight: 800;
    color: var(--mtl-team-color);
}
.mtl-minute{
    font-size: 9px;
    line-height: 1.1;
    color: var(--bp-text-subtle);
}
.mtl-row--quiet{
    min-height: 22px;
}
.mtl-row--quiet .mtl-label{
    font-size: 11px;
    font-weight: 600;
    color: var(--bp-text-muted);
}
.mtl-row--quiet .mtl-icon{
    width: 18px;
    height: 18px;
    font-size: 11px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-subtle);
}
.mtl-dot{
    position: relative;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--bp-border-strong, #C9CDD2);
}
.mtl-event-row{
    position: relative;
    display: flex;
    justify-content: center;
    padding: 3px 0;
}
.mtl-event{
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 10px;
    border: 1.5px solid var(--mtl-team-color);
    border-radius: 999px;
    background: var(--bp-surface);
    color: var(--bp-text);
    font-size: 11px;
    font-weight: 700;
}
/* ─── Highlights ─── */
.mtl-highlights{
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.mtl-highlight-list{
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
}
.mtl-highlight{
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 6px;
    max-width: 220px;
    padding: 6px 10px 6px 8px;
    border: none;
    border-left: 3px solid var(--mtl-team-color);
    border-radius: 8px;
    background: var(--bp-fill-soft);
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.mtl-highlight-minute{
    font-size: 11px;
    font-weight: 800;
    color: var(--bp-text-muted);
}
.mtl-highlight-icon{
    display: flex;
    font-size: 15px;
    color: var(--mtl-team-color);
}
.mtl-row--highlight .mtl-label{
    font-weight: 800;
    color: var(--bp-text-strong);
}
.mtl-row--highlight .mtl-icon{
    box-shadow: 0 0 0 2px var(--mtl-team-color);
}
.mtl-row--flash{
    animation: mtl-flash 1.6s ease-out;
    border-radius: 10px;
}
@keyframes mtl-flash{
    0%, 40%{ background: color-mix(in srgb, var(--mtl-team-color) 22%, transparent); }
    100%{ background: transparent; }
}
.mtl-minute-row{
    position: relative;
    display: flex;
    justify-content: center;
    height: 16px;
}
.mtl-minute-mark{
    position: relative;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--bp-surface);
    font-size: 10px;
    font-weight: 700;
    line-height: 16px;
    color: var(--bp-text-subtle);
}
.mtl-final{
    position: relative;
    align-self: center;
    margin-top: 4px;
    padding: 3px 12px;
    border-radius: 999px;
    background: var(--bp-fill-soft);
    font-size: 12px;
    color: var(--bp-text-muted);
}
.mtl-final strong{
    color: var(--bp-text-strong);
}
</style>
