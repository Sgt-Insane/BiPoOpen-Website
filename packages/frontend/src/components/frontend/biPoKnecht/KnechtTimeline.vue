<template>
    <div class="KnechtTimeline">
        <div v-if="entries.length === 0" class="kn-tl-empty">Noch keine Würfe</div>

        <template v-for="entry in entries" :key="entry.key">
            <div v-if="entry.kind === 'marker'" class="kn-tl-marker">{{ entry.label }}</div>

            <button
                v-else
                type="button"
                class="kn-tl-turn"
                :class="{ 'kn-tl-turn--editable': editable, 'kn-tl-turn--zero': entry.points === 0 }"
                :style="{ '--kn-team-color': TEAM_COLORS[entry.teamIndex] }"
                :disabled="!editable"
                @click="$emit('edit', entry.turnIndex)"
            >
                <span class="kn-tl-icon">{{ entry.icon }}</span>
                <span class="kn-tl-text">
                    <span class="kn-tl-player">{{ entry.player }}</span>
                    <span class="kn-tl-label">{{ entry.label }}</span>
                </span>
                <span class="kn-tl-meta">
                    <span v-if="entry.points" class="kn-tl-points">{{ entry.pointsLabel }}</span>
                    <span class="kn-tl-minute">{{ entry.minute }}</span>
                </span>
                <i v-if="editable" class="pi pi-pencil kn-tl-edit"></i>
            </button>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getTurnPoints, type KnechtState } from './knechtEngine';
import { TEAM_COLORS, TURN_ICONS, formatPoints, getPlayerName, getTeamName, getTurnLabel } from './KnechtUtilFunctions';

const props = defineProps<{
    match: Match;
    state: KnechtState;
    editable?: boolean;
    newestFirst?: boolean;
}>();
defineEmits<{ edit: [turnIndex: number] }>();

type Entry =
    | { kind: 'marker'; key: string; label: string }
    | { kind: 'turn'; key: string; turnIndex: number; teamIndex: number; icon: string; player: string; label: string; points: number; pointsLabel: string; minute: string };

const MARKER_LABELS = {
    reRack: (team: string) => `🔄 Re-Rack für ${team}`,
    nachwurf: (team: string) => `⚖️ Gentleman's Rule – Nachwurf ${team}`,
    overtime: (team: string) => `⚔️ Verlängerung (2×3) – ${team} beginnt`,
};

const getMinute = (time: number) => {
    if (!props.match.time) return '';
    return `${Math.max(0, Math.floor((time - props.match.time) / 60000))}'`;
};

const entries = computed<Entry[]>(() => {
    const list: Entry[] = [];
    const markers = props.state.markers;
    const addMarkers = (afterTurnIndex: number) => markers
        .filter(marker => marker.afterTurnIndex === afterTurnIndex)
        .forEach((marker, index) => list.push({ kind: 'marker', key: `m-${afterTurnIndex}-${index}`, label: MARKER_LABELS[marker.kind](getTeamName(props.match, marker.teamIndex)) }));

    props.state.turns.forEach((turn, turnIndex) => {
        addMarkers(turnIndex);
        const points = getTurnPoints(props.state, turnIndex);
        const forOpponent = turn.type === 'owncup';
        list.push({
            kind: 'turn',
            key: `t-${turnIndex}`,
            turnIndex,
            teamIndex: turn.teamIndex,
            icon: TURN_ICONS[turn.type],
            player: getPlayerName(props.match, turn.teamIndex, turn.playerIndex),
            label: getTurnLabel(turn, props.match),
            points,
            pointsLabel: forOpponent ? `+${formatPoints(points)} Gegner` : `+${formatPoints(points)}`,
            minute: getMinute(turn.time),
        });
    });
    addMarkers(props.state.turns.length);

    return props.newestFirst ? list.reverse() : list;
});
</script>

<style scoped>
.KnechtTimeline{
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.kn-tl-empty{
    padding: 24px 0;
    color: #8A9099;
    font-size: 14px;
    text-align: center;
}
.kn-tl-marker{
    align-self: center;
    margin: 4px 0;
    padding: 4px 12px;
    border-radius: 999px;
    background: #F1F2F4;
    color: #3A3F46;
    font-size: 12px;
    font-weight: 700;
}
.kn-tl-turn{
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 12px;
    border: 1px solid #E6E8EB;
    border-left: 4px solid var(--kn-team-color);
    border-radius: 12px;
    background: white;
    font: inherit;
    text-align: left;
}
.kn-tl-turn:disabled{
    cursor: default;
    color: inherit;
}
.kn-tl-turn--editable{
    cursor: pointer;
}
.kn-tl-turn--editable:active{
    background: #F6F7F9;
}
.kn-tl-turn--zero{
    background: #FAFBFC;
}
.kn-tl-icon{
    width: 22px;
    font-size: 16px;
    text-align: center;
}
.kn-tl-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}
.kn-tl-player{
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 700;
    color: #1F2328;
}
.kn-tl-label{
    font-size: 12px;
    color: #6B7079;
}
.kn-tl-meta{
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}
.kn-tl-points{
    font-size: 14px;
    font-weight: 800;
    color: var(--kn-team-color);
    white-space: nowrap;
}
.kn-tl-minute{
    font-size: 11px;
    color: #8A9099;
}
.kn-tl-edit{
    font-size: 12px;
    color: #B5B9C0;
}
</style>
