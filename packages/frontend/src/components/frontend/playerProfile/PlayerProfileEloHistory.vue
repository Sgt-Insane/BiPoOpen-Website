<template>
    <!-- Elo-Verlauf als Kurve: Zeitraum waehlbar, Finger/Maus ueber die Kurve zeigt den Stand nach dem Spiel -->
    <section v-if="history.length > 1" class="pp-section">
        <div class="pp-section-head">
            <h2 class="pp-section-title">Elo-Verlauf</h2>
            <div class="pp-elo-periods" role="radiogroup" aria-label="Zeitraum">
                <button v-for="option in PERIODS" :key="option.value" type="button" class="pp-elo-period"
                    :class="{ 'is-active': period === option.value }" :aria-checked="period === option.value" role="radio"
                    @click="period = option.value">{{ option.label }}</button>
            </div>
        </div>

        <div class="pp-card pp-elo-history">
            <div class="pp-elo-history-top">
                <span class="pp-elo-history-value">{{ (active ?? points[points.length - 1]).rating.toLocaleString('de-DE') }}</span>
                <span class="pp-elo-history-meta">
                    <template v-if="active">
                        {{ formatDate(active.time) }} · <span :class="active.delta >= 0 ? 'is-up' : 'is-down'">{{ active.delta >= 0 ? '+' : '−' }}{{ Math.abs(active.delta) }}</span>
                        {{ active.won ? 'Sieg' : 'Niederlage' }}
                    </template>
                    <template v-else>
                        <span :class="periodChange >= 0 ? 'is-up' : 'is-down'">{{ periodChange >= 0 ? '▲' : '▼' }} {{ Math.abs(periodChange) }}</span>
                        im Zeitraum · Bestwert {{ peak.toLocaleString('de-DE') }}
                    </template>
                </span>
            </div>

            <svg ref="chart" class="pp-elo-chart" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none"
                @pointermove="onPointer" @pointerdown="onPointer" @pointerleave="active = null">
                <defs>
                    <linearGradient id="pp-elo-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--main-color)" stop-opacity=".25" />
                        <stop offset="100%" stop-color="var(--main-color)" stop-opacity="0" />
                    </linearGradient>
                </defs>
                <line v-for="y in gridLines" :key="y.value" x1="0" :x2="WIDTH" :y1="y.y" :y2="y.y" class="pp-elo-grid" vector-effect="non-scaling-stroke" />
                <path :d="areaPath" fill="url(#pp-elo-fill)" />
                <path :d="linePath" class="pp-elo-line" vector-effect="non-scaling-stroke" />
                <line v-if="active" :x1="activeX" :x2="activeX" y1="0" :y2="HEIGHT" class="pp-elo-cursor" vector-effect="non-scaling-stroke" />
            </svg>

            <div class="pp-elo-axis">
                <span>{{ formatDate(points[0].time) }}</span>
                <span>{{ minRating.toLocaleString('de-DE') }} – {{ maxRating.toLocaleString('de-DE') }} Elo</span>
                <span>{{ formatDate(points[points.length - 1].time) }}</span>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { getCachedGameData, getGameData, type GameData } from '@/util/gameDataCache';
import { getPlayerEloHistory } from './PlayerProfileUtilFunctions';
import type { EloHistoryPoint } from '@/components/frontend/worldRanking/eloRating';

const props = defineProps<{ playerName: string }>();

const WIDTH = 300;
const HEIGHT = 110;
const DAY = 24 * 60 * 60 * 1000;
type Period = '3m' | '1y' | 'all';
const PERIODS: { value: Period; label: string }[] = [
    { value: '3m', label: '3 M' },
    { value: '1y', label: '1 J' },
    { value: 'all', label: 'Alle' },
];

const gameData = shallowRef<GameData | null>(getCachedGameData());
watch(() => props.playerName, () => { getGameData().then(data => { gameData.value = data; }).catch(() => {}); }, { immediate: true });

const history = computed<EloHistoryPoint[]>(() => gameData.value ? getPlayerEloHistory(gameData.value, props.playerName) : []);
const period = ref<Period>('1y');

// Punkte im Zeitraum; mindestens die letzten zwei Spiele, damit immer eine Linie entsteht
const points = computed(() => {
    const list = history.value;
    if (period.value === 'all') return list;
    const from = Date.now() - (period.value === '3m' ? 90 : 365) * DAY;
    const inRange = list.filter(point => point.time >= from);
    return inRange.length >= 2 ? inRange : list.slice(-2);
});

const minRating = computed(() => Math.min(...points.value.map(point => point.rating)));
const maxRating = computed(() => Math.max(...points.value.map(point => point.rating)));
const peak = computed(() => Math.max(...history.value.map(point => point.rating)));
const periodChange = computed(() => {
    const list = points.value;
    const index = history.value.indexOf(list[0]);
    const start = index > 0 ? history.value[index - 1].rating : list[0].rating - list[0].delta;
    return list[list.length - 1].rating - start;
});

const toX = (index: number) => points.value.length > 1 ? index / (points.value.length - 1) * WIDTH : WIDTH / 2;
const toY = (rating: number) => {
    const range = Math.max(1, maxRating.value - minRating.value);
    return HEIGHT - 8 - (rating - minRating.value) / range * (HEIGHT - 16);
};
const linePath = computed(() => points.value.map((point, index) => `${index ? 'L' : 'M'}${toX(index).toFixed(1)},${toY(point.rating).toFixed(1)}`).join(' '));
const areaPath = computed(() => `${linePath.value} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`);
const gridLines = computed(() => [minRating.value, maxRating.value].map(value => ({ value, y: toY(value) })));

// Finger oder Maus ueber der Kurve: naechstes Spiel anzeigen
const chart = ref<SVGSVGElement | null>(null);
const active = ref<EloHistoryPoint | null>(null);
const activeX = computed(() => active.value ? toX(points.value.indexOf(active.value)) : 0);
const onPointer = (event: PointerEvent) => {
    const rect = chart.value?.getBoundingClientRect();
    if (!rect || points.value.length < 2) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    active.value = points.value[Math.round(ratio * (points.value.length - 1))];
};

const formatDate = (time: number) => new Date(time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
</script>

<style scoped>
.pp-elo-periods{
    display: flex;
    gap: 4px;
}
.pp-elo-period{
    padding: 3px 9px;
    border: 1px solid var(--bp-border-strong);
    border-radius: 999px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.pp-elo-period.is-active{
    border-color: var(--main-color);
    background: var(--main-color);
    color: white;
}
.pp-elo-history{
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
}
.pp-elo-history-top{
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
}
.pp-elo-history-value{
    font-size: 24px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.pp-elo-history-meta{
    font-size: 12px;
    color: var(--bp-text-muted);
}
.is-up{ color: #1F8A70; font-weight: 700; }
.is-down{ color: #E5484D; font-weight: 700; }
.pp-elo-chart{
    width: 100%;
    height: 110px;
    touch-action: pan-y;
    cursor: crosshair;
}
.pp-elo-grid{
    stroke: var(--bp-border);
    stroke-dasharray: 3 4;
}
.pp-elo-line{
    fill: none;
    stroke: var(--main-color);
    stroke-width: 2.2;
    stroke-linejoin: round;
}
.pp-elo-cursor{
    stroke: var(--bp-text-muted);
    stroke-width: 1;
}
.pp-elo-axis{
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--bp-text-muted);
}
</style>
