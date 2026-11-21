<template>
    <div class="MatchTimeline">
        <div class="mtl-header">
            <span class="mtl-title">Spielverlauf</span>
            <span v-if="headerInfo" class="mtl-duration">
                <i v-if="match.referee" class="pi pi-flag" aria-hidden="true"></i> {{ headerInfo }}
            </span>
            <button v-if="showShare" type="button" class="mtl-share" @click="shareOpen = true">
                <i class="pi pi-share-alt"></i> Story-Overlay<DevBadge feature="shareOverlay" />
            </button>
        </div>
        <BottomSheet v-if="showShare" v-model:visible="shareOpen">
            <template #header><span class="mtl-share-title">Story-Overlay</span></template>
            <ShareStickerPanel v-if="shareOpen" :match="match" :eloDeltas="eloDeltas" />
        </BottomSheet>

        <!-- Becherverlauf mit Fahnen fuer besondere Momente. Dieselbe Grafik nutzt das Story-Overlay.
             Antippen einer Fahne springt zum Wurf im Reiter "Wuerfe". -->
        <div ref="chartWrap" class="mtl-chart">
            <MatchCupChart :match="match" :width="chartWidth" :fontFamily="chartFont" :live="live" interactive @select="openRow" />
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
                <line x1="0" x2="100" y1="20" y2="20" class="mtl-win-grid" vector-effect="non-scaling-stroke" />
                <polyline :points="winLine.points" class="mtl-win-line" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="mtl-chart-legend mtl-chart-legend--below">
                <span class="mtl-chart-key" :style="{ '--mtl-team-color': getTeamColor(match, 0) }">{{ getSideName(0) }} oben</span>
                <span class="mtl-chart-key" :style="{ '--mtl-team-color': getTeamColor(match, 1) }">{{ getSideName(1) }} unten</span>
                <span class="mtl-chart-caption">aus Elo vor dem Spiel und Trefferquote im Spiel</span>
            </div>
        </div>

        <!-- Reiter: Spieler, Wuerfe. Im 1 gegen 1 (auch Liga) nur die Wuerfe, ohne Reiter:
             die Elo-Aenderung steht dort oben in der Teamzeile -->
        <div v-if="showNames" class="mtl-tabs" role="tablist">
            <button v-for="tabEntry in tabs" :key="tabEntry.key" type="button" role="tab" :aria-selected="tab === tabEntry.key"
                :class="{ 'is-active': tab === tabEntry.key }" @click="tab = tabEntry.key">
                {{ tabEntry.label }} <small>{{ tabEntry.count }}</small>
            </button>
        </div>

        <!-- Spieler: zugeklappt Becher (gross), Elo und Auszeichnung. Antippen klappt Wuerfe, Quote, Wurfzeit
             und den Link zum Profil auf (immer nur ein Spieler offen). -->
        <div v-if="showNames && tab === 'players'" class="mtl-players">
            <div v-for="team in playerRows" :key="team.teamIndex" class="mtl-players-team" :style="{ '--mtl-team-color': getTeamColor(match, team.teamIndex) }">
                <div v-for="row in team.players" :key="row.key" class="mtl-player" :class="{ 'is-open': openPlayer === row.key }">
                    <button type="button" class="mtl-player-summary" :aria-expanded="openPlayer === row.key" @click="togglePlayer(row.key)">
                        <!-- Liga/Cup: das "Spieler" ist ein Team, dann das Logo (eckig, ohne Wintermuetze) -->
                        <Avatar :name="row.name" :avatarImage="row.logo" shape="circle" class="mtl-player-avatar" />
                        <span class="mtl-player-main">
                            <span class="mtl-player-name">{{ row.name }}</span>
                            <span v-if="row.elo" class="mtl-player-elo">
                                <i class="pi pi-chart-line" aria-hidden="true"></i>
                                {{ row.elo.rating.toLocaleString('de-DE') }}
                                <b :class="{ 'is-up': row.elo.delta > 0, 'is-down': row.elo.delta < 0 }">{{ formatEloDelta(row.elo.delta) }}</b>
                            </span>
                            <!-- Auszeichnung: oben der Titel, darunter in einer Zeile, wofuer -->
                            <span v-if="row.award" class="mtl-player-award" :title="row.award.detail">
                                <b><span aria-hidden="true">{{ row.award.icon }}</span> {{ row.award.title }}</b>
                                <span class="mtl-player-award-detail" v-fit-text>{{ row.award.detail }}</span>
                            </span>
                        </span>
                        <span class="mtl-player-cups">
                            <b>{{ formatPoints(row.points) }}</b>
                            <small>Becher</small>
                        </span>
                        <i class="pi mtl-player-chevron" :class="openPlayer === row.key ? 'pi-chevron-up' : 'pi-chevron-down'" aria-hidden="true"></i>
                    </button>
                    <div v-if="openPlayer === row.key" class="mtl-player-details">
                        <div class="mtl-player-stats">
                            <span><b>{{ row.throws }}</b><small>Würfe</small></span>
                            <span><b>{{ row.accuracy }} %</b><small>Quote</small></span>
                            <span v-if="row.throwTime !== null"><b>{{ formatSeconds(row.throwTime) }}</b><small>Ø Wurfzeit</small></span>
                        </div>
                        <button type="button" class="mtl-player-profile" @click="openPlayerProfile(row.name)">
                            Zum Profil von {{ row.shortName }} <i class="pi pi-angle-right" aria-hidden="true"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Alle Wuerfe als Tabelle: Spielzeit | Team 1 | Stand | Team 2. Je Wurf Werfer und Aktion (Nullwurf, Balls Back, ...),
             Treffer farbig hinterlegt. Re-Rack, Nachwurf und Verlaengerung als eigene Zeile ueber die ganze Breite. -->
        <div v-else class="mtl-throws">
            <div v-if="quietCount" class="mtl-filter" role="radiogroup" aria-label="Würfe filtern">
                <button type="button" role="radio" :aria-checked="!onlyHits" :class="{ 'is-active': !onlyHits }" @click="setOnlyHits(false)">Alle Würfe <small>{{ rows.length }}</small></button>
                <button type="button" role="radio" :aria-checked="onlyHits" :class="{ 'is-active': onlyHits }" @click="setOnlyHits(true)">Nur Treffer <small>{{ rows.length - quietCount }}</small></button>
            </div>

            <div class="mtl-list" :class="{ 'mtl-list--singles': !showNames }">
                <!-- Wer steht auf welcher Seite: bleibt beim Scrollen oben sichtbar (erste Spalte ohne Titel) -->
                <div class="mtl-list-head">
                    <span v-for="teamIndex in [0, 1]" :key="teamIndex" class="mtl-list-team" :class="`mtl-list-team--${teamIndex}`" :style="{ '--mtl-team-color': getTeamColor(match, teamIndex) }">{{ getSideName(teamIndex) }}</span>
                </div>
                <template v-for="item in items" :key="item.key">
                <div v-if="item.kind === 'event'" class="mtl-event-row" :style="{ '--mtl-team-color': getTeamColor(match, item.teamIndex) }">
                    <span class="mtl-time">{{ item.clock }}</span>
                    <span class="mtl-event"><KnechtIcon :name="item.icon" /> <GlossaryText :text="item.label" /></span>
                </div>
                <div v-else class="mtl-row" :ref="el => setRowElement(item.row.key, el)"
                    :class="{ 'mtl-row--miss': item.row.quiet, 'mtl-row--hit': !item.row.quiet, 'mtl-row--flash': flashKey === item.row.key }"
                    :style="{ '--mtl-team-color': getTeamColor(match, item.row.teamIndex) }">
                    <template v-for="row in [item.row]" :key="row.key">
                    <span class="mtl-time">{{ row.clock }}</span>
                    <div v-for="side in [0, 1]" :key="side" class="mtl-side" :class="side === 0 ? 'mtl-side--left' : 'mtl-side--right'">
                        <template v-if="row.teamIndex === side">
                            <span class="mtl-dot" :class="{ 'mtl-dot--moment': noteRowKeys.has(row.key) }"></span>
                            <span class="mtl-text">
                                <!-- Im 1 gegen 1 ist klar, wer geworfen hat: dann nur die Aktion -->
                                <span v-if="showNames" class="mtl-name" v-fit-text>{{ row.name }}</span>
                                <!-- Aktion in einer Zeile: Knecht-Symbol und kurze Bezeichnung -->
                                <span class="mtl-action" v-hint="row.label">
                                    <KnechtIcon :name="row.icon" class="mtl-action-icon" />
                                    <span class="mtl-action-label" v-fit-text><GlossaryText :text="row.action" /></span>
                                </span>
                            </span>
                        </template>
                    </div>
                    <span class="mtl-score">
                        <span :class="{ 'mtl-score--changed': row.scoringTeam === 0 }">{{ row.score[0] }}</span>:<span :class="{ 'mtl-score--changed': row.scoringTeam === 1 }">{{ row.score[1] }}</span>
                    </span>
                    </template>
                </div>
                </template>

                <div class="mtl-final">
                    {{ live ? 'Stand' : 'Endstand' }} <strong>{{ finalScore[0] }} : {{ finalScore[1] }}</strong>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import DevBadge from '@/components/shared/DevBadge.vue';
import { computed, inject, nextTick, onBeforeUnmount, PropType, ref, watch } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import GlossaryText from '@/components/shared/GlossaryText.vue';
import KnechtIcon from '@/components/frontend/biPoKnecht/KnechtIcon.vue';
import { getTurnIcon, type KnechtIconName } from '@/components/frontend/biPoKnecht/knechtIcons';
import { isHitTurnType } from '@/components/frontend/biPoKnecht/knechtEngine';
import { getAccuracy, getScoringTeam, getTurnCups, getTurnStats } from '@/components/frontend/biPoKnecht/knechtStats';
import { getEloPlayerKey } from '@/components/frontend/worldRanking/eloRating';
import { formatEdgeKind, formatHitEdge } from '@/components/frontend/biPoKnecht/knechtEdges';
import { formatSeconds, getThrowTimes } from '@/components/frontend/biPoKnecht/knechtThrowTimes';
import { useEloRatings } from '@/components/shared/useEloRatings';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import { getEloExpectation, getWinProbabilities } from './winProbability';
import ShareStickerPanel from '@/components/shared/ShareSticker/ShareStickerPanel.vue';
import { isFeatureOn } from '@/util/featureFlags';
import { getTeamColor, formatDuration, formatPoints, getAwards, getShortPlayerName, getTeam } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';
import MatchCupChart from './MatchCupChart.vue';
import { getCupChartMoments } from './cupChart';

const props = defineProps({
    match: { type: Object as PropType<Match>, required: true },
    // Laufendes Spiel (Live-Ticker): noch keine Auszeichnungen, "Stand" statt "Endstand"
    live: { type: Boolean, default: false },
});

const openPlayerProfile = inject<(name: string) => void>('openPlayerProfile', () => {});

// ─── Namen ───
const allNames = computed(() => [props.match.team1, props.match.team2].flatMap(team => team.players.map(player => player.name.trim())));
const getShortName = (teamIndex: number, playerIndex: number) => getShortPlayerName(props.match, teamIndex, playerIndex);
// Spaltenkopf der Wurfliste: Teamname (Liga), sonst die Kurznamen der Spieler
const getSideName = (teamIndex: number) => {
    const team = getTeam(props.match, teamIndex);
    return team.name || team.players.map((_, playerIndex) => getShortName(teamIndex, playerIndex)).join(' & ');
};

const formatEloDelta = (delta: number) => delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '±0';

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
    key: number;                // Index des Turns
    teamIndex: number;          // wer geworfen hat
    scoringTeam: number;        // wer die Becher bekommt, -1 wenn kein Becher faellt
    icon: KnechtIconName;
    label: string;              // Aktion: Treffer, Nullwurf, Balls Back, Kante · Becher 4, ...
    name: string;               // Werfer (Kurzname), beim Trickshot-Fang mit Faenger
    action: string;             // kurz fuer die eine Zeile: "Balls Back" statt "Treffer · Balls Back"
    clock: string;              // Spielzeit "1:35"
    time: number;
    score: [number, number];
    quiet: boolean;             // Fehlwurf, Airball, gefangener Trickshot: kein Becher
};

const turns = computed(() => props.match.turns ?? []);

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
    // Kante ohne Becher-Nummer: welcher Becher, ist fuer die Wurfliste egal
    if (turn.type === 'miss' && data.edge) return formatEdgeKind(data.edge as EdgeHit);
    if (!cups && !isHitTurnType(turn.type)) return QUIET_LABELS[turn.type] ?? 'Verfehlt';
    const kinds = [
        SHORT_LABELS[turn.type],
        turn.type !== 'bouncer' && data.bouncer && 'Bouncer',
        (turn.type === 'trickshot' || isTrickshotHit(turn, previous)) && 'Trickshot',
        !!data.edge && isHitTurnType(turn.type) && formatHitEdge(data.edge as EdgeHit),
    ].filter(Boolean);
    // Balls Back, On Fire, Bouncer und Trickshot sind Folgen eines Treffers: "Treffer · Balls Back"
    const label = !kinds.length ? 'Treffer' : HIT_FOLLOW_UPS.has(turn.type) ? `Treffer · ${kinds.join(' · ')}` : kinds.join(' · ');
    return cups > 1 && turn.type !== 'owncup' && turn.type !== 'penalty' ? `${label} +${cups}` : label;
};

// Werfer (Kurzname), beim Trickshot-Fang dazu der Faenger
const getRowName = (turn: Turn) => {
    const name = getShortName(turn.teamIndex, turn.playerIndex);
    const catcher = getData(turn).catcherIndex;
    return turn.type === 'trickshot' && typeof catcher === 'number' ? `${name} → ${getShortName(turn.teamIndex, catcher)}` : name;
};
// Kurzform fuer die Zeile unter dem Namen: das Symbol zeigt schon den Treffer
const getAction = (label: string) => label.replace(/^Treffer · /, '');

// 1 gegen 1 (auch Liga-Teams): kein Name unter der Spalte noetig
const showNames = computed(() => props.match.team1.players.length > 1 || props.match.team2.players.length > 1);

// Spielzeit seit Anpfiff, "1:35"
const formatClock = (time: number | undefined) => {
    if (!props.match.time || !time) return '';
    const seconds = Math.max(0, Math.floor((time - props.match.time) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const rows = computed<Row[]>(() => {
    const score: [number, number] = [0, 0];
    const list: Row[] = [];

    turns.value.forEach((turn, index) => {
        const cups = getTurnCups(turn);
        const quiet = !cups && !isHitTurnType(turn.type);
        const scoringTeam = getScoringTeam(turn);
        score[scoringTeam] += cups;
        list.push({
            key: index,
            teamIndex: turn.teamIndex,
            scoringTeam: cups ? scoringTeam : -1,
            icon: getTurnIcon(turn, turns.value[index - 1]),
            label: getLabel(turn, turns.value[index - 1], cups),
            action: getAction(getLabel(turn, turns.value[index - 1], cups)),
            name: getRowName(turn),
            clock: formatClock(turn.time),
            time: turn.time,
            score: [score[0], score[1]],
            quiet,
        });
    });
    return list;
});

// Re-Rack, Nachwurf, Verlaengerung (gespeichert seit dem neuen Knecht, aeltere Spiele haben keine)
const EVENT_LOOKS: Partial<Record<MatchEvent['kind'], { icon: KnechtIconName; label: (team: string) => string }>> = {
    reRack: { icon: 'reRack', label: team => `Re-Rack · ${team}` },
    nachwurf: { icon: 'nachwurf', label: team => `Nachwurf · ${team}` },
    overtime: { icon: 'overtime', label: () => 'Verlängerung' },
};

// ─── Kopfzeile ───
const throwTimes = computed(() => getThrowTimes(turns.value, props.match.events));
// "Schiri: Name · 8:34 min"
const headerInfo = computed(() => [
    props.match.referee ? `Schiri: ${props.match.referee}` : '',
    formatDuration(props.match.time, props.match.endTime),
].filter(Boolean).join(' · '));

// Besondere Momente (wie die Fahnen im Diagramm): in der Wurfliste mit Ring ums Symbol
const noteRowKeys = computed(() => new Set(getCupChartMoments(props.match).map(moment => moment.rowKey)));

// ─── Reiter ───
type TabKey = 'players' | 'throws';
// Live zuerst die Wuerfe (jeder Wurf erscheint sofort), im fertigen Spiel zuerst die Spieler
const tab = ref<TabKey>(props.live ? 'throws' : 'players');
const tabs = computed(() => [
    { key: 'players' as const, label: 'Spieler', count: allNames.value.length },
    { key: 'throws' as const, label: 'Würfe', count: rows.value.length },
]);

// Antippen einer Fahne: in den Reiter "Wuerfe", zur Zeile scrollen und sie kurz aufleuchten lassen
const rowElements = new Map<number, Element>();
const setRowElement = (key: number, element: unknown) => {
    if (element instanceof Element) rowElements.set(key, element);
    else rowElements.delete(key);
};
const flashKey = ref<number | null>(null);
const openRow = async (key: number) => {
    tab.value = 'throws';
    // Ausgeblendeten Wurf (z.B. gefangener Trickshot) erst wieder einblenden
    if (onlyHits.value && rows.value.find(row => row.key === key)?.quiet) onlyHits.value = false;
    await nextTick();
    rowElements.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashKey.value = key;
    setTimeout(() => { if (flashKey.value === key) flashKey.value = null; }, 1600);
};

// ─── Wurfliste ───
type EventItem = { kind: 'event'; key: string; icon: KnechtIconName; label: string; teamIndex: number; clock: string };
type TimelineItem = { kind: 'row'; key: string; row: Row } | EventItem;

// Wuerfe und Ereignisse in Spielreihenfolge: ein Ereignis steht vor dem Turn afterTurnIndex
const entries = computed(() => {
    const list: { position: number; item: TimelineItem }[] = rows.value.map(row => ({ position: row.key, item: { kind: 'row', key: `r${row.key}`, row } }));
    (props.match.events ?? []).forEach((event, index) => {
        const look = EVENT_LOOKS[event.kind];
        if (!look) return;
        const previous = rows.value.filter(row => row.key < event.afterTurnIndex).at(-1);
        list.push({
            position: event.afterTurnIndex - .5,
            item: { kind: 'event', key: `e${index}`, icon: look.icon, label: look.label(getSideName(event.teamIndex)), teamIndex: event.teamIndex, clock: formatClock(event.time ?? previous?.time) },
        });
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
const isVisible = (item: TimelineItem) => !onlyHits.value || item.kind !== 'row' || !item.row.quiet;

const items = computed<TimelineItem[]>(() => entries.value.map(entry => entry.item).filter(isVisible));

// Endstand aus den gespeicherten Punkten (kann z.B. durch den Siegpunkt vom Becherstand abweichen)
const finalScore = computed(() => [props.match.team1, props.match.team2]
    .map(team => formatPoints(team.players.reduce((sum, player) => sum + (player.score ?? 0), 0))));

// ─── Spieler ───
const playerStats = computed(() => {
    const points = [props.match.team1, props.match.team2].map(team => team.players.map(player => player.score ?? 0));
    return getTurnStats(props.match, turns.value, points);
});

// Gleiche Regeln wie auf dem Spielende-Bildschirm, damit die Webseite dieselben Titel zeigt (erst nach dem Spiel)
const awards = computed(() => props.live ? [] : getAwards(playerStats.value));

// Elo je Spieler nach diesem Spiel (nicht gewertete Spiele, z.B. Unentschieden, zeigen nichts)
const { loadEloRatings, getMatchElo, getElo } = useEloRatings();
loadEloRatings();
// Aufgeklappter Spieler (Wuerfe, Quote, Wurfzeit, Profil-Link), immer nur einer
const openPlayer = ref<string | null>(null);
const togglePlayer = (key: string) => { openPlayer.value = openPlayer.value === key ? null : key; };

// Je Spieler: Elo (sobald geladen und das Spiel gewertet ist), Becher, Trefferquote, Auszeichnung und Wurfzeit
const playerRows = computed(() => {
    const sides = getMatchElo(props.match);
    const stats = playerStats.value;
    return [props.match.team1, props.match.team2].map((team, teamIndex) => ({
        teamIndex,
        players: team.players.map((player, playerIndex) => {
            const statIndex = stats.findIndex(stat => stat.teamIndex === teamIndex && stat.playerIndex === playerIndex);
            const entry = stats[statIndex];
            const change = sides?.[teamIndex].playerChanges.find(item => item.key === getEloPlayerKey(player.name));
            const time = throwTimes.value?.players.find(item => item.teamIndex === teamIndex && item.playerIndex === playerIndex);
            return {
                key: `${teamIndex}-${playerIndex}`,
                name: player.name,
                shortName: getShortName(teamIndex, playerIndex),
                // Liga/Cup speichern das Team als einzigen "Spieler": dann das Team-Logo
                logo: team.players.length === 1 ? team.logo : undefined,
                hits: entry?.hits ?? 0,
                throws: entry?.throws ?? 0,
                points: entry?.points ?? 0,
                accuracy: entry ? getAccuracy(entry) : 0,
                elo: change ? { delta: change.delta, rating: change.rating } : null,
                award: awards.value[statIndex] ?? null,
                throwTime: time?.average ?? null,
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

// Story-Overlay (noch im Entwicklermodus): Elo-Aenderung je Spieler fuer die Spieler-Vorlage
const showShare = computed(() => !props.live && isFeatureOn('shareOverlay'));
const shareOpen = ref(false);
const eloDeltas = computed(() => Object.fromEntries(playerRows.value.flatMap(team => team.players)
    .filter(player => player.elo).map(player => [player.name, player.elo!.delta])));

// ─── Becherverlauf ───
// Breite messen (die Grafik ist ein SVG in Pixeln), Schrift der Seite fuer die Textbreiten der Fahnen
const chartWrap = ref<HTMLElement | null>(null);
const chartWidth = ref(0);
const chartFont = ref<string | undefined>(undefined);
let resizeObserver: ResizeObserver | null = null;
watch(chartWrap, element => {
    resizeObserver?.disconnect();
    if (!element) return;
    chartFont.value = getComputedStyle(element).fontFamily || undefined;
    chartWidth.value = element.clientWidth;
    if (typeof ResizeObserver === 'undefined') return;
    resizeObserver = new ResizeObserver(([entry]) => { chartWidth.value = Math.floor(entry.contentRect.width); });
    resizeObserver.observe(element);
});
onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<style scoped>
.MatchTimeline{
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    padding: 10px 0 4px;
}
.mtl-header{
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
}
.mtl-title{
    font-size: 15px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
/* Spielzeit direkt neben "Spielverlauf" */
.mtl-duration{
    font-size: 12px;
    color: var(--bp-text-muted);
    font-variant-numeric: tabular-nums;
}
.mtl-share{
    display: inline-flex;
    align-items: center;
    align-self: center;
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

/* ─── Becherverlauf ─── */
.mtl-chart{
    width: 100%;
    min-height: 1px;
}
.mtl-chart-legend{
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 14px;
    font-size: 12px;
    color: var(--bp-text-muted);
}
.mtl-chart-legend--below{
    font-size: 11px;
}
.mtl-chart-key{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-weight: 700;
    color: var(--bp-text);
}
.mtl-chart-key::before{
    content: '';
    flex: 0 0 auto;
    width: 14px;
    height: 3px;
    border-radius: 2px;
    background: var(--mtl-team-color);
}
.mtl-chart-caption{
    margin-left: auto;
}
/* ─── Siegchance ─── */
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
.mtl-win-grid{
    stroke: var(--bp-border);
    stroke-width: 1;
    stroke-dasharray: 3 4;
}
.mtl-win-line{
    fill: none;
    stroke: var(--bp-text-strong);
    stroke-width: 2;
    stroke-linejoin: round;
}

/* ─── Reiter ─── */
.mtl-tabs{
    display: flex;
    gap: 4px;
    padding: 3px;
    border-radius: 12px;
    background: var(--bp-fill);

    button {
        flex: 1;
        padding: 7px 0;
        border: none;
        border-radius: 9px;
        background: transparent;
        color: var(--bp-text-muted);
        font: inherit;
        font-size: 13px;
        font-weight: 700;
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

/* ─── Spieler ─── */
.mtl-players{
    display: flex;
    flex-direction: column;
    gap: 12px;
}
/* Je Team ein Block mit Strich in der Teamfarbe */
.mtl-players-team{
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 8px;
    border-left: 3px solid var(--mtl-team-color);
}
.mtl-player{
    border-radius: 12px;
    transition: background .15s;
}
.mtl-player.is-open{
    background: color-mix(in srgb, var(--mtl-team-color) 12%, var(--bp-surface));
}
.mtl-player-summary{
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.mtl-player-avatar{
    flex: 0 0 auto;
    align-self: flex-start;
    width: 36px !important;
    height: 36px !important;
    font-size: 13px !important;
}
.mtl-player-main{
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}
.mtl-player-name{
    font-size: 15px;
    font-weight: 800;
    line-height: 1.2;
    color: var(--bp-text-strong);
    overflow-wrap: anywhere;
}
/* Elo klein und grau, die Aenderung farbig */
.mtl-player-elo{
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--bp-text-muted);
    font-variant-numeric: tabular-nums;

    .pi {
        font-size: 11px;
    }
    b {
        font-weight: 800;
    }
    b.is-up { color: var(--bp-success); }
    b.is-down { color: var(--bp-danger); }
}
/* Zwei Zeilen: Titel, darunter die Begruendung ohne Umbruch (zur Not mit …) */
.mtl-player-award{
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.35;
    color: var(--bp-text-muted);

    b {
        font-weight: 700;
        color: var(--bp-text);
    }
}
.mtl-player-award-detail{
    overflow: hidden;
    white-space: nowrap;
}
/* Becher als wichtigste Zahl, gross in der Teamfarbe */
.mtl-player-cups{
    display: flex;
    flex: 0 0 auto;
    align-items: baseline;
    gap: 4px;

    b {
        font-size: 26px;
        font-weight: 900;
        line-height: 1;
        color: var(--mtl-team-color);
        font-variant-numeric: tabular-nums;
    }
    small {
        font-size: 12px;
        font-weight: 700;
        color: var(--bp-text-muted);
    }
}
.mtl-player-chevron{
    flex: 0 0 auto;
    font-size: 10px;
    color: var(--bp-text-subtle);
}
/* Aufgeklappt: Wuerfe, Quote, Wurfzeit und Link zum Profil, buendig mit dem Namen */
.mtl-player-details{
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 8px 10px 54px;
}
.mtl-player-stats{
    display: flex;
    gap: 22px;

    span {
        display: flex;
        flex-direction: column;
    }
    b {
        font-size: 15px;
        font-weight: 800;
        color: var(--bp-text-strong);
        font-variant-numeric: tabular-nums;
    }
    small {
        font-size: 11px;
        color: var(--bp-text-muted);
    }
}
.mtl-player-profile{
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    gap: 2px;
    padding: 0;
    border: none;
    background: none;
    color: var(--main-color);
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
}

/* ─── Wuerfe ─── */
.mtl-throws{
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.mtl-filter{
    display: flex;
    gap: 6px;

    button {
        padding: 6px 12px;
        border: 1.5px solid var(--bp-border);
        border-radius: 999px;
        background: var(--bp-surface);
        color: var(--bp-text);
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
    }
    button.is-active {
        border-color: var(--bp-text-strong);
        background: var(--bp-text-strong);
        color: var(--bp-surface);
    }
    small {
        margin-left: 3px;
        font-weight: 500;
        opacity: .75;
    }
}
.mtl-list{
    /* Spalten: Spielzeit | Team 1 | Stand | Team 2 */
    --mtl-columns: 34px minmax(0, 1fr) 44px minmax(0, 1fr);
    display: flex;
    flex-direction: column;
}
.mtl-list-head{
    position: sticky;
    top: 54px;              /* unter der festen App-Leiste */
    z-index: 1;
    display: grid;
    grid-template-columns: var(--mtl-columns);
    column-gap: 6px;
    padding: 6px 6px;
    border-bottom: 1px solid var(--bp-border);
    background: var(--bp-surface);
}
/* Nie kuerzen (Liga-Teamnamen immer voll): zur Not zweizeilig */
.mtl-list-team{
    align-self: end;
    min-width: 0;
    overflow-wrap: anywhere;
    line-height: 1.25;
    font-size: 12px;
    font-weight: 800;
    color: var(--mtl-team-color);
}
/* Teamnamen wie die Wuerfe darunter: zur Mitte hin */
.mtl-list-team--0{
    grid-column: 2;
    text-align: right;
}
.mtl-list-team--1{
    grid-column: 4;
}

.mtl-row,
.mtl-event-row{
    display: grid;
    grid-template-columns: var(--mtl-columns);
    column-gap: 6px;
    align-items: center;
    min-height: 34px;
    padding: 5px 6px;
    border-bottom: 1px solid var(--bp-border);
}
/* Treffer: ganze Zeile in der Teamfarbe */
.mtl-row--hit{
    min-height: 44px;
    background: color-mix(in srgb, var(--mtl-team-color) 12%, var(--bp-surface));
}
.mtl-time{
    grid-row: 1;
    grid-column: 1;
    font-size: 11px;
    color: var(--bp-text-muted);
    font-variant-numeric: tabular-nums;
}
.mtl-side{
    display: flex;
    grid-row: 1;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.mtl-side--left{
    grid-column: 2;
    justify-content: flex-end;
    text-align: right;
}
.mtl-side--right{
    grid-column: 4;
    justify-content: flex-start;
    text-align: left;
}
/* Punkt zur Mitte hin: links hinter dem Text, rechts davor */
.mtl-side--left .mtl-dot{
    order: 1;
}
.mtl-dot{
    flex: 0 0 auto;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--bp-border-strong, #C9CDD2);
}
.mtl-row--hit .mtl-dot{
    width: 9px;
    height: 9px;
    background: var(--mtl-team-color);
}
/* Besonderer Moment (Fahne im Diagramm): Ring um den Punkt */
.mtl-dot--moment{
    box-shadow: 0 0 0 2px var(--bp-surface), 0 0 0 3.5px var(--mtl-team-color);
}
.mtl-text{
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    line-height: 1.2;
}
.mtl-side--left .mtl-text{
    align-items: flex-end;
}
.mtl-name{
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    color: var(--bp-text-muted);
}
.mtl-row--hit .mtl-name{
    font-weight: 800;
    color: var(--bp-text-strong);
}
/* Aktion immer einzeilig und dezent: kleines Knecht-Symbol, Bezeichnung, Becher. Zur Not mit … gekuerzt. */
.mtl-action{
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    min-width: 0;
    white-space: nowrap;
    font-size: 11px;
    color: var(--bp-text-muted);
}
.mtl-side--left .mtl-action{
    justify-content: flex-end;
}
.mtl-action-icon{
    flex: 0 0 auto;
    width: 13px;
    height: 13px;
    vertical-align: 0;
}
.mtl-row--hit .mtl-action-icon{
    color: var(--mtl-team-color);
}
.mtl-action-label{
    min-width: 0;
    overflow: hidden;
}
.mtl-row--hit .mtl-action-label{
    font-weight: 600;
    color: var(--bp-text);
}
/* 1 gegen 1: ohne Namen etwas groesser */
.mtl-list--singles .mtl-action{
    font-size: 12px;
}
.mtl-list--singles .mtl-action-icon{
    width: 15px;
    height: 15px;
}
.mtl-score{
    grid-row: 1;
    grid-column: 3;
    text-align: center;
    font-size: 14px;
    font-weight: 800;
    color: var(--bp-text-subtle);
    font-variant-numeric: tabular-nums;
}
.mtl-score--changed{
    color: var(--mtl-team-color);
}
.mtl-row--flash{
    animation: mtl-flash 1.6s ease-out;
}
@keyframes mtl-flash{
    0%, 40%{ background: color-mix(in srgb, var(--mtl-team-color) 35%, var(--bp-surface)); }
}
/* Re-Rack, Nachwurf, Verlaengerung: Zeit vorne, Hinweis ueber die restliche Breite */
.mtl-event-row .mtl-event{
    grid-column: 2 / 5;
    justify-self: center;
}
.mtl-event{
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
.mtl-final{
    align-self: center;
    margin-top: 6px;
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
