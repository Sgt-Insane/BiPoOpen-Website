<template>
    <BottomSheet v-model:visible="drawerVisible" style="color: var(--main-color)">
        <template #header>
            <div class="w-full flex justify-center">
                <div class="font-bold text-[24px] text-[--p-primary-color]">Spielverlauf</div>
            </div>
        </template>

        <!-- Leerzustand -->
        <div v-if="history.length === 0" class="flex justify-center items-center h-[200px] text-(--bp-text-faint)">
            Noch keine Spielzüge.
        </div>

        <!-- Spielzüge, neuester zuerst -->
        <div v-else class="flex flex-col gap-2">
            <template v-for="entry in history" :key="entry.key">
                <!-- Re-Rack: dezenter Trenner -->
                <div v-if="entry.kind === 'rerack'" class="flex items-center gap-3 py-1 px-1">
                    <div class="flex-1 h-px bg-(--bp-border)" />
                    <span class="text-xs font-medium uppercase tracking-wide" :style="{ color: teamColor(entry.teamIndex) }">
                        Neu zusammengestellt
                    </span>
                    <div class="flex-1 h-px bg-(--bp-border)" />
                </div>

                <!-- Spielzug -->
                <div
                    v-else
                    class="flex items-center justify-between rounded-xl px-4 py-3 border-l-4"
                    :style="{
                        borderColor: teamColor(entry.turn.teamIndex),
                        backgroundColor: teamBgColor(entry.turn.teamIndex),
                    }"
                >
                    <div class="flex flex-col">
                        <span class="font-semibold" :style="{ color: teamColor(entry.turn.teamIndex) }">{{ playerName(entry.turn) }}</span>
                        <span class="text-sm text-(--bp-text-muted)">{{ TURN_LABELS[entry.turn.type] }}</span>
                    </div>
                    <span
                        v-if="points(entry.turn, entry.index) > 0"
                        class="font-bold"
                        :style="{ color: teamColor(entry.turn.teamIndex) }"
                    >+{{ points(entry.turn, entry.index) }}</span>
                </div>
            </template>
        </div>
    </BottomSheet>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const drawerVisible = defineModel<boolean>('visible', { default: false });

const props = defineProps({
    game: { type: Object as PropType<BiPoKnechtGame>, required: true },
    match: { type: Object as PropType<Match>, required: true },
});

const TURN_LABELS: Record<Turn['type'], string> = {
    hit: 'Treffer',
    miss: 'Nullwurf',
    airball: 'Airball',
    bomb: 'Bombe',
    bouncer: 'Bouncer',
    trickshot: 'Trickshot',
    ballsback: 'Balls Back',
    lastCup: 'Letzter Becher',
    onfire: 'On Fire',
};

// Züge und Re-Rack-Marker chronologisch mischen, dann umkehren (neuester zuerst).
// Der Original-Index wird für scoreTurn gebraucht (z.B. hit+bomb-Logik). Ein
// Re-Rack mit afterTurnIndex === i sitzt vor dem Zug mit Index i.
type HistoryEntry =
    | { kind: 'turn'; turn: Turn; index: number; key: string }
    | { kind: 'rerack'; teamIndex: number; key: string };

const history = computed<HistoryEntry[]>(() => {
    const items: HistoryEntry[] = [];
    const turns = props.game.turns;
    for (let i = 0; i <= turns.length; i++) {
        props.game.reRacks
            .filter(r => r.afterTurnIndex === i)
            .forEach(r => items.push({ kind: 'rerack', teamIndex: r.teamIndex, key: `rr-${r.time}` }));
        if (i < turns.length) items.push({ kind: 'turn', turn: turns[i], index: i, key: `t-${i}` });
    }
    return items.reverse();
});

const teamFor = (teamIndex: number) => (teamIndex === 0 ? props.match.team1 : props.match.team2);

const playerName = (turn: Turn) => teamFor(turn.teamIndex).players[turn.playerIndex]?.name ?? '';

// Team 1 (index 0) nutzt --main-color, Team 2 (index 1) --secondary-color (wie im Rack).
const teamColor = (teamIndex: number) => (teamIndex === 0 ? 'var(--main-color)' : 'var(--secondary-color)');
const teamBgColor = (teamIndex: number) =>
    `color-mix(in srgb, ${teamColor(teamIndex)} 10%, var(--bp-surface))`;

const points = (turn: Turn, index: number) => props.game.scoreTurn(turn, index, props.game.turns);
</script>
