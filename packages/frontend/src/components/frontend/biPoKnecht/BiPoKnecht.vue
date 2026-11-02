<template>
    <div class="absolute w-[100dvw] h-[100dvh] top-0 left-0 z-[1000] bg-[#f8fafc] overflow-hidden">
        <ModalGameOver v-if="game.status === 'over'" :match="match" :isLeagueGame="props.isLeagueGame" :onRematch="props.onRematch" />
        <ModalStartingPlayer v-if="game.status === 'starting'" :match="match" :startGame="game.startGame"/>

        <div class="w-full h-full flex flex-col justify-between" v-if="game.status !== 'starting'">
            <Rack v-for="i in 2" :key="i" :game="game" :teamIndex="i - 1" />
        </div>

        <!-- Schwebende Quick-Actions an der rechten Tisch-Seitenkante: Verdeckt keine Becher oder Wurfbuttons -->
        <div
            v-if="game.status !== 'starting'"
            class="fixed right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 z-[9999]"
        >
            <button
                @click="game.undoLastTurn()"
                :disabled="game.turns.length === 0 && game.reRacks.length === 0"
                class="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm shadow-md border border-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center active:scale-95 transition-all"
                title="Letzten Wurf rückgängig machen"
            >
                <i class="pi pi-undo text-lg" />
            </button>
            <button
                @click="showHistory = true"
                class="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm shadow-md border border-gray-200 text-gray-700 flex items-center justify-center active:scale-95 transition-all"
                title="Spielverlauf"
            >
                <i class="pi pi-clock text-lg" />
            </button>
            <button
                @click="showStats = true"
                class="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm shadow-md border border-gray-200 text-gray-700 flex items-center justify-center active:scale-95 transition-all"
                title="Statistiken"
            >
                <i class="pi pi-trophy text-lg" />
            </button>
        </div>

        <GameHistoryDrawer v-model:visible="showHistory" :game="game" :match="match" />
        <StatsDrawer v-model:visible="showStats" :game="game" :match="match" />
    </div>
</template>

<script setup lang="ts">
import { onUnmounted, PropType, ref, watch } from 'vue';
import Rack from '@/components/frontend/biPoKnecht/Rack.vue';
import ModalGameOver from './ModalGameOver.vue';
import ModalStartingPlayer from './ModalStartingPlayer.vue';
import GameHistoryDrawer from './GameHistoryDrawer.vue';
import StatsDrawer from './StatsDrawer.vue';
import { useBiPoKnecht } from './useBiPoKnecht';
import { createEffects } from './biPoKnechtDom';

const props = defineProps({
    match: {type: Object as PropType<Match>, required: true },
    isLeagueGame: {type: Boolean, required: false, default: false },
    onRematch: {type: Function as PropType<() => void>, required: false }
});

const match = ref(props.match);
const showHistory = ref(false);
const showStats = ref(false);

const effects = createEffects();
const game = useBiPoKnecht(match, effects);

// Leaving the page mid-game must not keep the screen awake.
onUnmounted(() => effects.releaseWakeLock());

// When the game ends, write the final scores into the match and leave fullscreen.
watch(() => game.status, (status) => {
    if (status === 'over') {
        game.finalizeScores();
        effects.exitFullscreen();
        effects.releaseWakeLock();
    }
});
</script>
