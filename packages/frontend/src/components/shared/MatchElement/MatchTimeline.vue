<template>
    <div class="MatchTimeline">
        <div class="mtl-header">
            <span class="mtl-title">Spielverlauf</span>
            <span v-if="duration || match.referee" class="mtl-duration">
                <template v-if="match.referee"><i class="pi pi-flag" aria-hidden="true"></i> Schiri: {{ match.referee }}</template>
                <template v-if="match.referee && duration"> · </template>{{ duration }}
            </span>
        </div>

        <!-- Elo: wer wie viel gewonnen oder verloren hat -->
        <div v-if="eloRows.length" class="mtl-elo">
            <span class="mtl-title">Elo</span>
            <div class="mtl-elo-teams">
                <div v-for="team in eloRows" :key="team.teamIndex" class="mtl-elo-team" :style="{ '--mtl-team-color': TEAM_COLORS[team.teamIndex] }">
                    <div v-for="row in team.players" :key="row.name" class="mtl-elo-row">
                        <span class="mtl-elo-name">{{ row.name }}</span>
                        <span class="mtl-elo-delta" :class="row.delta >= 0 ? 'mtl-elo-delta--up' : 'mtl-elo-delta--down'">{{ row.delta >= 0 ? '+' : '−' }}{{ Math.abs(row.delta) }}</span>
                        <span class="mtl-elo-rating">{{ row.rating.toLocaleString('de-DE') }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Auszeichnungen wie am Spielende im Knecht -->
        <div v-if="awards.length" class="mtl-awards">
            <span class="mtl-title">Auszeichnungen</span>
            <div class="mtl-award-list">
                <div v-for="award in awards" :key="award.key" class="mtl-award" :style="{ '--mtl-team-color': TEAM_COLORS[award.teamIndex] }">
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
            <polyline v-for="line in chartLines" :key="line.teamIndex" :points="line.points" :stroke="TEAM_COLORS[line.teamIndex]" class="mtl-chart-line" vector-effect="non-scaling-stroke" />
        </svg>

        <!-- Alle Wuerfe: Team 1 links, Team 2 rechts, in der Mitte Zwischenstand. Fehlwuerfe kleiner und grau,
             Re-Rack/Nachwurf/Verlaengerung in der Mitte. Jede Spielminute als graue Zahl, auch ohne Wurf. -->
        <div class="mtl-list">
            <template v-for="item in items" :key="item.key">
            <div v-if="item.kind === 'minute'" class="mtl-minute-row">
                <span class="mtl-minute-mark">{{ item.minute }}'</span>
            </div>
            <div v-else-if="item.kind === 'event'" class="mtl-event-row" :style="{ '--mtl-team-color': TEAM_COLORS[item.teamIndex] }">
                <span class="mtl-event"><KnechtIcon :name="item.icon" /> {{ item.label }}</span>
            </div>
            <div v-else class="mtl-row" :class="{ 'mtl-row--quiet': item.row.quiet }" :style="{ '--mtl-team-color': TEAM_COLORS[item.row.teamIndex] }">
                <template v-for="row in [item.row]" :key="row.key">
                <div class="mtl-side mtl-side--left">
                    <template v-if="row.teamIndex === 0">
                        <span class="mtl-text">
                            <span class="mtl-label">{{ row.label }}</span>
                            <span v-if="row.player" class="mtl-player">{{ row.player }}</span>
                        </span>
                        <span class="mtl-icon"><KnechtIcon :name="row.icon" /></span>
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
                        <span class="mtl-icon"><KnechtIcon :name="row.icon" /></span>
                        <span class="mtl-text">
                            <span class="mtl-label">{{ row.label }}</span>
                            <span v-if="row.player" class="mtl-player">{{ row.player }}</span>
                        </span>
                    </template>
                </div>
                </template>
            </div>
            </template>

            <div class="mtl-final">
                Endstand <strong>{{ finalScore[0] }} : {{ finalScore[1] }}</strong>
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import KnechtIcon from '@/components/frontend/biPoKnecht/KnechtIcon.vue';
import { TURN_ICONS, type KnechtIconName } from '@/components/frontend/biPoKnecht/knechtIcons';
import { isHitTurnType } from '@/components/frontend/biPoKnecht/knechtEngine';
import { getScoringTeam, getTurnCups, getTurnStats } from '@/components/frontend/biPoKnecht/knechtStats';
import { getEloPlayerKey } from '@/components/frontend/worldRanking/eloRating';
import { formatEdge } from '@/components/frontend/biPoKnecht/knechtEdges';
import { useEloRatings } from '@/components/shared/useEloRatings';
import { TEAM_COLORS, formatDuration, formatPoints, getAwards, getPlayerName, getTeam, getTeamName } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';

const props = defineProps({
    match: { type: Object as PropType<Match>, required: true },
});

const SHORT_LABELS: Partial<Record<Turn['type'], string>> = {
    bomb: 'Bombe',
    bouncer: 'Bouncer',
    onfire: 'On Fire',
    ballsback: 'Balls Back',
    lastCup: 'Letzter Becher',
    deathcup: 'Deathcup',
    owncup: 'Eigener Becher',
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
};

const getLabel = (turn: Turn, previous: Turn | undefined, cups: number) => {
    const data = getData(turn);
    if (turn.type === 'miss' && data.edge) return formatEdge(data.edge as EdgeHit);
    if (!cups && !isHitTurnType(turn.type)) return QUIET_LABELS[turn.type] ?? 'Verfehlt';
    const kinds = [
        SHORT_LABELS[turn.type],
        turn.type !== 'bouncer' && data.bouncer && 'Bouncer',
        (turn.type === 'trickshot' || isTrickshotHit(turn, previous)) && 'Trickshot',
    ].filter(Boolean);
    const label = kinds.length ? kinds.join(' · ') : 'Treffer';
    return cups > 1 && turn.type !== 'owncup' ? `${label} +${cups}` : label;
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
            player: getRowPlayer(turn, team),
            minute: start && turn.time ? Math.max(0, Math.floor((turn.time - start) / 60000)) : null,
            time: turn.time,
            score: [score[0], score[1]],
            quiet,
        });
    });
    return list;
});

// Beim Trickshot-Fang: wer verfehlt hat und wer gefangen hat
const getRowPlayer = (turn: Turn, team: Team) => {
    if (team.players.length <= 1) return '';
    const name = getPlayerName(props.match, turn.teamIndex, turn.playerIndex);
    const catcher = getData(turn).catcherIndex;
    if (turn.type === 'trickshot' && typeof catcher === 'number') return `${name} → ${getPlayerName(props.match, turn.teamIndex, catcher)}`;
    return name;
};

// Re-Rack, Nachwurf, Verlaengerung (gespeichert seit dem neuen Knecht, aeltere Spiele haben keine)
const EVENT_LOOKS: Record<MatchEvent['kind'], { icon: KnechtIconName; label: (team: string) => string }> = {
    reRack: { icon: 'reRack', label: team => `Re-Rack · ${team}` },
    nachwurf: { icon: 'nachwurf', label: team => `Nachwurf · ${team}` },
    overtime: { icon: 'overtime', label: () => 'Verlängerung' },
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

const items = computed<TimelineItem[]>(() => {
    if (!hasMinuteGrid.value) return entries.value.map(entry => entry.item);
    const start = props.match.time ?? 0;
    const lastMinute = Math.max(0, ...entries.value.map(entry => entry.minute ?? 0));
    const endMinute = props.match.endTime && start ? Math.floor((props.match.endTime - start) / 60000) : lastMinute;
    const list: TimelineItem[] = [];
    for (let minute = 0; minute <= Math.max(lastMinute, endMinute); minute++) {
        list.push({ kind: 'minute', key: `m${minute}`, minute });
        entries.value.filter(entry => (entry.minute ?? 0) === minute).forEach(entry => list.push(entry.item));
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
const { loadEloRatings, getMatchElo } = useEloRatings();
loadEloRatings();
const eloRows = computed(() => {
    const sides = getMatchElo(props.match);
    if (!sides) return [];
    return [props.match.team1, props.match.team2].map((team, teamIndex) => ({
        teamIndex,
        players: team.players.flatMap(player => {
            const change = sides[teamIndex].playerChanges.find(entry => entry.key === getEloPlayerKey(player.name));
            return change ? [{ name: player.name, delta: change.delta, rating: change.rating }] : [];
        }),
    }));
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
    align-items: baseline;
    justify-content: space-between;
}
.mtl-title{
    font-size: 14px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.mtl-duration{
    font-size: 12px;
    color: var(--bp-text-muted);
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
