<template>
    <!-- Live-Ticker auf der Startseite: laufende Knecht-Spiele, nur wenn gerade eins laeuft -->
    <section v-if="games.length" class="HomeLiveGames">
        <h2 class="hl-title"><span class="hl-dot"></span> Live<DevBadge feature="live" /></h2>
        <router-link v-for="entry in views" :key="entry.id" :to="`/Live/${entry.id}`" class="hl-card" :class="{ 'hl-card--paused': entry.view.paused }">
            <!-- Pausiert: Pause-Symbol mittig ueber der Kachel -->
            <span v-if="entry.view.paused" class="hl-pause" role="img" aria-label="Pausiert"><span></span><span></span></span>
            <div class="hl-teams">
                <div v-for="teamIndex in [0, 1]" :key="teamIndex" class="hl-team">
                    <span class="hl-color" :style="{ background: getTeamColor(entry.view.match, teamIndex) }"></span>
                    <span class="hl-name">{{ entry.view.teamNames[teamIndex] }}</span>
                    <span class="hl-score">{{ entry.view.score[teamIndex] }}</span>
                </div>
            </div>
            <div class="hl-meta">
                <span>{{ entry.view.paused ? 'Pausiert' : entry.view.phase }}<template v-if="entry.view.minute !== null"> · {{ entry.view.minute }}'</template></span>
                <span v-if="entry.view.lastAction" class="hl-last">{{ entry.view.lastAction }}</span>
            </div>
        </router-link>
    </section>
</template>

<script setup lang="ts">
import DevBadge from '@/components/shared/DevBadge.vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { listLiveGames, type LiveGame } from '@/components/frontend/biPoKnecht/knechtLive';
import { getTeamColor } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';
import { getLiveView } from './liveView';

const POLL_MS = 8000;

const games = ref<LiveGame[]>([]);
const views = computed(() => games.value.map(game => ({ id: game.id, view: getLiveView(game) })));

let timer: ReturnType<typeof setInterval> | null = null;
// Erst ab dem Anwurf: ein Spiel, das noch bei Becherfarben und "Wer fängt an?" steht (oder dort verlassen wurde), laeuft nicht
const load = async () => { games.value = (await listLiveGames()).filter(game => game.startTeamIndex !== null); };

// Nur abfragen, solange die Seite sichtbar ist
const onVisibility = () => { if (document.visibilityState === 'visible') load(); };
onMounted(() => {
    load();
    timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<style scoped>
.HomeLiveGames{
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.hl-title{
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.hl-dot{
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #E5484D;
    animation: hl-pulse 1.6s infinite;
}
@keyframes hl-pulse{
    0%{ box-shadow: 0 0 0 0 rgba(229, 72, 77, .6); }
    70%{ box-shadow: 0 0 0 8px rgba(229, 72, 77, 0); }
    100%{ box-shadow: 0 0 0 0 rgba(229, 72, 77, 0); }
}
.hl-card{
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--bp-surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
    color: inherit;
    text-decoration: none;
}
/* Pausiert: Inhalt gedaempft, rundes Pause-Symbol in der Mitte (Farben der Seite) */
.hl-card--paused > :not(.hl-pause){ opacity: .45; }
.hl-pause{
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--main-color);
    box-shadow: 0 4px 14px rgba(0, 0, 0, .18);
    transform: translate(-50%, -50%);
}
.hl-pause span{
    width: 5px;
    height: 18px;
    border-radius: 2px;
    background: white;
}
.hl-teams{
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.hl-team{
    display: flex;
    align-items: center;
    gap: 8px;
}
.hl-color{
    flex-shrink: 0;
    width: 4px;
    height: 20px;
    border-radius: 2px;
}
.hl-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.hl-score{
    font-size: 20px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--bp-text-strong);
}
.hl-meta{
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: var(--bp-text-muted);
}
.hl-last{
    color: var(--bp-text);
}
</style>
