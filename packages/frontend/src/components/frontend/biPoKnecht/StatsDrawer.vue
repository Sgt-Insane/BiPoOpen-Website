<template>
    <BottomSheet v-model:visible="drawerVisible" style="color: var(--main-color)">
        <template #header>
            <div class="w-full flex justify-center">
                <div class="font-bold text-[24px] text-[--p-primary-color]">Becher-Statistik</div>
            </div>
        </template>

        <div class="flex flex-col gap-6">
            <div
                v-for="(team, teamIndex) in [match.team1, match.team2]"
                :key="teamIndex"
                class="rounded-xl overflow-hidden"
                :style="{ borderTop: `4px solid ${teamColor(teamIndex)}` }"
            >
                <div
                    class="px-4 py-2 font-bold text-white"
                    :style="{ backgroundColor: teamColor(teamIndex) }"
                >
                    {{ team.name || `Team ${teamIndex + 1}` }}
                </div>

                <div class="flex flex-col divide-y divide-(--bp-border)">
                    <div
                        v-for="(player, playerIndex) in team.players"
                        :key="player._id"
                        class="flex items-center justify-between gap-3 px-4 py-3"
                    >
                        <div class="flex flex-col min-w-0">
                            <span class="font-semibold text-(--bp-text-strong) truncate">{{ player.name }}</span>
                            <span class="text-xs text-(--bp-text-muted) mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                <span>Treffer: {{ statsFor(teamIndex, playerIndex).hits }}</span>
                                <span>Bouncer: {{ statsFor(teamIndex, playerIndex).bouncers }}</span>
                                <span>Bomben: {{ statsFor(teamIndex, playerIndex).bombs }}</span>
                                <span>Balls Back: {{ statsFor(teamIndex, playerIndex).ballsBack }}</span>
                                <span>Last Cup: {{ statsFor(teamIndex, playerIndex).lastCups }}</span>
                            </span>
                        </div>
                        <div class="flex flex-col items-center shrink-0">
                            <span class="text-2xl font-bold leading-none" :style="{ color: teamColor(teamIndex) }">
                                {{ statsFor(teamIndex, playerIndex).total }}
                            </span>
                            <span class="text-[10px] text-(--bp-text-faint) uppercase tracking-wide">Becher</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </BottomSheet>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const drawerVisible = defineModel<boolean>('visible', { default: false });

const props = defineProps({
    game: { type: Object as PropType<BiPoKnechtGame>, required: true },
    match: { type: Object as PropType<Match>, required: true },
});

const teamColor = (teamIndex: number) =>
    teamIndex === 0 ? 'var(--main-color)' : 'var(--secondary-color)';

// Number of cups a single turn knocks down for the player who threw it.
// A bomb's first cup is the cup the first player already hit (see
// ruleBombOrBallsBack), so the bomber is only credited the 2 additional cups.
const cupsPerType: Partial<Record<Turn['type'], number>> = {
    hit: 1,
    bouncer: 2,
    bomb: 2,
    ballsback: 1,
    lastCup: 1,
};

const statsFor = (teamIndex: number, playerIndex: number) => {
    const turns = props.game.turns.filter(
        t => t.teamIndex === teamIndex && t.playerIndex === playerIndex
    );
    const count = (type: Turn['type']) => turns.filter(t => t.type === type).length;

    const hits = count('hit');
    const bouncers = count('bouncer');
    const bombs = count('bomb');
    const ballsBack = count('ballsback');
    const lastCups = count('lastCup');

    const total = turns.reduce((sum, t) => sum + (cupsPerType[t.type] ?? 0), 0);

    return { total, hits, bouncers, bombs, ballsBack, lastCups };
};
</script>
