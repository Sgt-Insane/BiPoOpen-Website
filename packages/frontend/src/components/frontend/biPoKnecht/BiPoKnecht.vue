<template>
    <div class="absolute w-[100dvw] h-[100dvh] top-0 left-0 z-[1000] bg-(--bp-bg)">
        <ModalGameOver v-if="game.status === 'over'" :match="match" :isLeagueGame="props.isLeagueGame" />
        <ModalStartingPlayer v-if="game.status === 'starting'" :match="match" :startGame="game.startGame"/>

        <div class="w-full h-full flex flex-col justify-between" v-if="game.status !== 'starting'">
            <Rack v-for="i in 2" :key="i" :game="game" :teamIndex="i - 1" />
        </div>

        <!-- Fixed bottom nav -->
        <div v-if="game.status !== 'starting'"
            class="fixed bottom-[5px] left-1/2 -translate-x-1/2 w-auto bg-(--bp-surface) rounded-t-2xl px-4 pt-4 pb-3 shadow-sm flex flex-row gap-2 items-center justify-center z-[99999]"
        >
            <Button @click="game.undoLastTurn()" :disabled="game.turns.length === 0 && game.reRacks.length === 0" text rounded>
                <i class="pi pi-undo text-2xl text-(--bp-text-secondary)" />
            </Button>
            <Button @click="showHistory = true" text rounded>
                <i class="pi pi-clock text-2xl text-(--bp-text-secondary)" />
            </Button>
            <Button @click="showStats = true" text rounded>
                <i class="pi pi-trophy text-2xl text-(--bp-text-secondary)" />
            </Button>
        </div>

        <GameHistoryDrawer v-model:visible="showHistory" :game="game" :match="match" />
        <StatsDrawer v-model:visible="showStats" :game="game" :match="match" />
    </div>
</template>

<script setup lang="ts">
import { PropType, ref, watch } from 'vue';
import Button from 'primevue/button';
import Rack from '@/components/frontend/biPoKnecht/Rack.vue';
import ModalGameOver from './ModalGameOver.vue';
import ModalStartingPlayer from './ModalStartingPlayer.vue';
import GameHistoryDrawer from './GameHistoryDrawer.vue';
import StatsDrawer from './StatsDrawer.vue';
import { useBiPoKnecht } from './useBiPoKnecht';
import { createEffects } from './biPoKnechtDom';

const props = defineProps({
    match: {type: Object as PropType<Match>, required: true },
    isLeagueGame: {type: Boolean, required: false, default: false }
});

const match = ref(props.match);
const showHistory = ref(false);
const showStats = ref(false);

const effects = createEffects();
const game = useBiPoKnecht(match, effects);

// When the game ends, write the final scores into the match and leave fullscreen.
watch(() => game.status, (status) => {
    if (status === 'over') {
        game.finalizeScores();
        effects.exitFullscreen();
    }
});
</script>
