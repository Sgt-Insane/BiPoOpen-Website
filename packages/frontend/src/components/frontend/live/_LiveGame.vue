<template>
    <div class="LiveGame">
        <div class="lg-content">
            <!-- Kopf: Teams, Spielstand, wer gerade wirft -->
            <div class="lg-hero">
                <div class="lg-hero-head">
                    <button type="button" class="lg-back" aria-label="Zurück" @click="goBack()">
                        <i class="pi pi-chevron-left"></i>
                    </button>
                    <span v-if="game && !finished" class="lg-badge"><span class="lg-dot"></span> LIVE</span>
                    <span v-else-if="game" class="lg-badge lg-badge--done">{{ game.status === 'aborted' ? 'Abgebrochen' : 'Beendet' }}</span>
                    <span v-if="view?.minute !== null && view" class="lg-minute">{{ view.minute }}'</span>
                </div>

                <template v-if="view">
                    <div class="lg-score">
                        <div v-for="teamIndex in [0, 1]" :key="teamIndex" class="lg-team" :style="{ '--lg-team-color': getTeamColor(view.match, teamIndex) }">
                            <span class="lg-team-name">{{ view.teamNames[teamIndex] }}</span>
                            <span class="lg-team-score">{{ view.score[teamIndex] }}</span>
                        </div>
                    </div>
                    <div class="lg-phase">{{ view.phase }}</div>
                    <div v-if="view.lastAction" class="lg-last">Zuletzt: {{ view.lastAction }}</div>
                </template>
                <div v-else-if="notFound" class="lg-phase">Dieses Live-Spiel gibt es nicht (mehr).</div>
                <div v-else class="lg-phase"><i class="pi pi-spin pi-spinner"></i> Lade …</div>
            </div>

            <div v-if="view && view.match.turns?.length" class="lg-card">
                <MatchTimeline :match="view.match" :live="!finished" />
            </div>
            <div v-else-if="view" class="lg-card lg-empty">Noch kein Wurf – der Spielverlauf erscheint hier live.</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MatchTimeline from '@/components/shared/MatchElement/MatchTimeline.vue';
import { getLiveGame, type LiveGame } from '@/components/frontend/biPoKnecht/knechtLive';
import { getTeamColor } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';
import { getLiveView } from './liveView';

const POLL_MS = 2000;

const route = useRoute();
const router = useRouter();
const id = String(route.params.LiveId ?? '');

const game = ref<LiveGame | null>(null);
const notFound = ref(false);
const now = ref(Date.now());
const view = computed(() => game.value ? getLiveView(game.value, now.value) : null);
const finished = computed(() => game.value?.status !== 'live' || view.value?.isOver);

let timer: ReturnType<typeof setInterval> | null = null;
const load = async () => {
    now.value = Date.now();
    if (document.visibilityState !== 'visible' && game.value) return;
    const loaded = await getLiveGame(id);
    if (loaded) game.value = loaded;
    else if (!game.value) notFound.value = true;
    // Beendet: nicht weiter abfragen
    if (game.value && game.value.status !== 'live' && timer) {
        clearInterval(timer);
        timer = null;
    }
};

onMounted(() => {
    load();
    timer = setInterval(load, POLL_MS);
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });

const goBack = () => {
    if (window.history.state?.back) router.back();
    else router.push('/');
};
</script>

<style scoped>
.LiveGame{
    margin-inline: calc(50% - 50vw);
    padding: 12px calc(50vw - 50%) 32px;
    background: var(--page-gray);
}
.lg-content{
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 640px;
    margin: 0 auto;
}
.lg-hero{
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 14px 18px;
    border-radius: 20px;
    background: var(--bp-navy, #0C1E47);
    color: white;
}
.lg-hero-head{
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
}
.lg-back{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-left: -8px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: white;
    cursor: pointer;
}
.lg-badge{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    background: #E5484D;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .08em;
}
.lg-badge--done{
    background: rgba(255, 255, 255, .15);
    letter-spacing: 0;
}
.lg-dot{
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
    animation: lg-blink 1.4s infinite;
}
@keyframes lg-blink{
    50%{ opacity: .3; }
}
.lg-minute{
    margin-left: auto;
    font-size: 15px;
    font-weight: 700;
    color: #C9D2E6;
}
.lg-score{
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.lg-team{
    display: flex;
    align-items: center;
    gap: 10px;
    padding-left: 10px;
    border-left: 4px solid var(--lg-team-color);
}
.lg-team-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 18px;
    font-weight: 800;
}
.lg-team-score{
    font-size: 34px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}
.lg-phase{
    font-size: 14px;
    font-weight: 700;
    color: #C9D2E6;
}
.lg-last{
    font-size: 13px;
    color: #C9D2E6;
}
.lg-card{
    padding: 14px;
    border-radius: 16px;
    background: var(--bp-surface);
    box-shadow: 0 1px 2px rgba(16, 24, 40, .06);
}
.lg-empty{
    font-size: 14px;
    color: var(--bp-text-muted);
    text-align: center;
}
</style>
