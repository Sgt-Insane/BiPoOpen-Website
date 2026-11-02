<template>
    <div class="absolute w-[100dvw] h-[100dvh] top-0 left-0 z-[1000] bg-[#f8fafc] overflow-hidden select-none">
        <ModalGameOver v-if="game.status === 'over'" :match="match" :isLeagueGame="props.isLeagueGame" :onRematch="props.onRematch" />
        <ModalStartingPlayer v-if="game.status === 'starting'" :match="match" :startGame="game.startGame"/>

        <div class="w-full h-full flex flex-col justify-between" v-if="game.status !== 'starting'">
            <Rack v-for="i in 2" :key="i" :game="game" :teamIndex="i - 1" />
        </div>

        <!-- Dart-Automat Action Banner: Erscheint mitten auf dem Tisch bei Spezialevents -->
        <transition name="pop-banner">
            <div
                v-if="game.bannerEvent"
                class="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[99999] px-6 py-3 rounded-2xl shadow-2xl flex items-center justify-center text-center font-black text-xl sm:text-2xl uppercase tracking-wider backdrop-blur-md border-2 border-white/60"
                :class="getBannerClass(game.bannerEvent)"
            >
                {{ getBannerText(game.bannerEvent) }}
            </div>
        </transition>

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
            <button
                @click="game.sound.toggleMute()"
                class="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm shadow-md border border-gray-200 flex items-center justify-center active:scale-95 transition-all"
                :class="game.sound.isMuted ? 'text-gray-400' : 'text-emerald-600'"
                :title="game.sound.isMuted ? 'Sound einschalten' : 'Sound stummschalten'"
            >
                <i :class="game.sound.isMuted ? 'pi pi-volume-off' : 'pi pi-volume-up'" class="text-lg" />
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
import { useBiPoKnecht, type BannerEvent } from './useBiPoKnecht';
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

const getBannerText = (event: BannerEvent) => {
    switch (event) {
        case 'bomb': return '💣 BOMBE! Balls Back!';
        case 'ballsback': return '🎯 BALLS BACK!';
        case 'on-fire': return '🔥🔥🔥 ON FIRE!';
        case 'heating-up': return '🔥 HEATING UP!';
        case 'overtime': return '⚔️ VERLÄNGERUNG (2x3)!';
        case 'deathcup': return '💀 DEATHCUP! SOFORTSIEG!';
        default: return '';
    }
};

const getBannerClass = (event: BannerEvent) => {
    switch (event) {
        case 'bomb': return 'bg-red-600 text-white shadow-red-500/50';
        case 'ballsback': return 'bg-cyan-600 text-white shadow-cyan-500/50';
        case 'on-fire': return 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white shadow-orange-500/60';
        case 'heating-up': return 'bg-orange-500 text-white shadow-orange-500/40';
        case 'overtime': return 'bg-gradient-to-r from-amber-600 to-yellow-500 text-black shadow-yellow-500/50';
        case 'deathcup': return 'bg-black text-red-500 border-red-500 shadow-red-900/60';
        default: return 'bg-gray-800 text-white';
    }
};

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

<style scoped>
.pop-banner-enter-active,
.pop-banner-leave-active {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pop-banner-enter-from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.6) rotate(-5deg);
}

.pop-banner-leave-to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.15);
}
</style>
