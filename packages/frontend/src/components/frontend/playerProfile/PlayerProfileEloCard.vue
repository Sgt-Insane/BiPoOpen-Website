<template>
    <!-- Elo-Highlight: Rang, aktuelles Elo und Verlauf in einer Karte. Zeitraum waehlbar, Finger/Maus ueber die Kurve zeigt den Stand nach dem Spiel -->
    <section class="pp-elo">
        <div class="pp-elo-top">
            <router-link to="/Weltrangliste" class="pp-elo-rank" aria-label="Zur Weltrangliste">
                <div class="pp-elo-rank-value">{{ elo.rank !== null ? `#${elo.rank}` : '–' }}</div>
                <div class="pp-elo-rank-label">{{ rankLabel }} <i class="pi pi-chevron-right"></i></div>
            </router-link>

            <div class="pp-elo-main">
                <div class="pp-elo-rating">
                    <span class="pp-elo-rating-value">{{ formatNumber(active ? active.rating : elo.rating) }}</span>
                    <span class="pp-elo-rating-unit">Elo</span>
                    <span v-if="active" class="pp-elo-delta" :class="active.delta >= 0 ? 'is-up' : 'is-down'">{{ formatDelta(active.delta) }}</span>
                    <span v-else class="pp-elo-delta" :class="deltaClass(periodChange)">{{ formatChange(periodChange) }}</span>
                </div>
                <div class="pp-elo-caption">
                    <template v-if="active">{{ formatDate(active.time) }} · {{ active.won ? 'Sieg' : 'Niederlage' }}</template>
                    <template v-else>{{ periodLabel }} · Bestwert {{ formatNumber(elo.peak) }}</template>
                </div>
            </div>
        </div>

        <template v-if="points.length > 1">
            <svg ref="chart" class="pp-elo-chart" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none"
                @pointermove="onPointer" @pointerdown="onPointer" @pointerleave="active = null">
                <defs>
                    <linearGradient id="pp-elo-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--secondary-color)" stop-opacity=".35" />
                        <stop offset="100%" stop-color="var(--secondary-color)" stop-opacity="0" />
                    </linearGradient>
                </defs>
                <line v-for="y in gridLines" :key="y" x1="0" :x2="WIDTH" :y1="y" :y2="y" class="pp-elo-grid" vector-effect="non-scaling-stroke" />
                <path :d="areaPath" fill="url(#pp-elo-fill)" />
                <path :d="linePath" class="pp-elo-line" vector-effect="non-scaling-stroke" />
                <line v-if="active" :x1="activeX" :x2="activeX" y1="0" :y2="HEIGHT" class="pp-elo-cursor" vector-effect="non-scaling-stroke" />
            </svg>

            <div class="pp-elo-foot">
                <span>{{ formatDate(points[0].time) }}</span>
                <div class="pp-elo-periods" role="radiogroup" aria-label="Zeitraum">
                    <button v-for="option in PERIODS" :key="option.value" type="button" class="pp-elo-period"
                        :class="{ 'is-active': period === option.value }" :aria-checked="period === option.value" role="radio"
                        @click="period = option.value">{{ option.label }}</button>
                </div>
                <span>{{ formatDate(points[points.length - 1].time) }}</span>
            </div>
        </template>
    </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { ELO_MIN_GAMES, type EloHistoryPoint } from '@/components/frontend/worldRanking/eloRating';
import { getCachedGameData, getGameData, type GameData } from '@/util/gameDataCache';
import { getPlayerEloHistory } from './PlayerProfileUtilFunctions';

const props = defineProps<{ elo: PlayerEloSummary; playerName: string }>();

const WIDTH = 300;
const HEIGHT = 90;
const DAY = 24 * 60 * 60 * 1000;
type Period = '3m' | '1y' | 'all';
const PERIODS: { value: Period; label: string }[] = [
    { value: '3m', label: '3 M' },
    { value: '1y', label: '1 J' },
    { value: 'all', label: 'Alle' },
];

const formatNumber = (value: number) => value.toLocaleString('de-DE');
const formatDelta = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value)}`;
const formatChange = (value: number) => value > 0 ? `▲ ${value}` : value < 0 ? `▼ ${-value}` : '±0';
const deltaClass = (value: number) => value > 0 ? 'is-up' : value < 0 ? 'is-down' : '';
const formatDate = (time: number) => new Date(time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

const rankLabel = computed(() => {
    if (props.elo.rank !== null) return 'Weltrangliste';
    if (props.elo.inactive) return 'inaktiv';
    return `ab ${ELO_MIN_GAMES} Spielen`;
});

// Verlauf aus allen gewerteten Spielen
const gameData = shallowRef<GameData | null>(getCachedGameData());
watch(() => props.playerName, () => { getGameData().then(data => { gameData.value = data; }).catch(() => {}); }, { immediate: true });
const history = computed<EloHistoryPoint[]>(() => gameData.value ? getPlayerEloHistory(gameData.value, props.playerName) : []);

const period = ref<Period>('3m');
const periodLabel = computed(() => ({ '3m': 'letzte 3 Monate', '1y': 'letztes Jahr', all: 'insgesamt' })[period.value]);

// Punkte im Zeitraum; mindestens die letzten zwei Spiele, damit immer eine Linie entsteht
const points = computed(() => {
    const list = history.value;
    if (period.value === 'all') return list;
    const from = Date.now() - (period.value === '3m' ? 90 : 365) * DAY;
    const inRange = list.filter(point => point.time >= from);
    return inRange.length >= 2 ? inRange : list.slice(-2);
});

const periodChange = computed(() => {
    const list = points.value;
    if (!list.length) return props.elo.ratingChange;
    return list[list.length - 1].rating - (list[0].rating - list[0].delta);
});

const minRating = computed(() => Math.min(...points.value.map(point => point.rating)));
const maxRating = computed(() => Math.max(...points.value.map(point => point.rating)));
const toX = (index: number) => index / Math.max(1, points.value.length - 1) * WIDTH;
const toY = (rating: number) => {
    const range = Math.max(1, maxRating.value - minRating.value);
    return HEIGHT - 6 - (rating - minRating.value) / range * (HEIGHT - 12);
};
const linePath = computed(() => points.value.map((point, index) => `${index ? 'L' : 'M'}${toX(index).toFixed(1)},${toY(point.rating).toFixed(1)}`).join(' '));
const areaPath = computed(() => `${linePath.value} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`);
const gridLines = computed(() => [toY(minRating.value), toY(maxRating.value)]);

const chart = ref<SVGSVGElement | null>(null);
const active = ref<EloHistoryPoint | null>(null);
const activeX = computed(() => active.value ? toX(points.value.indexOf(active.value)) : 0);
const onPointer = (event: PointerEvent) => {
    const rect = chart.value?.getBoundingClientRect();
    if (!rect || points.value.length < 2) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    active.value = points.value[Math.round(ratio * (points.value.length - 1))];
};
</script>

<style scoped>
.pp-elo {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px 12px;
    border-radius: 16px;
    background: linear-gradient(135deg, #14213d 0%, #1e3a6b 100%);
    color: white;
    box-shadow: 0 4px 14px rgba(20, 33, 61, 0.25);
}
.pp-elo-top {
    display: flex;
    align-items: center;
    gap: 14px;
}

.pp-elo-rank {
    flex-shrink: 0;
    min-width: 72px;
    padding-right: 14px;
    border-right: 1px solid rgba(255, 255, 255, 0.15);
    color: inherit;
    text-align: center;
    text-decoration: none;
}
.pp-elo-rank-value {
    font-size: 28px;
    font-weight: 800;
    line-height: 1.1;
}
.pp-elo-rank-label {
    margin-top: 2px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.65);

    i { font-size: 8px; }
}

.pp-elo-main {
    flex: 1;
    min-width: 0;
}
.pp-elo-rating {
    display: flex;
    align-items: baseline;
    gap: 6px;
}
.pp-elo-rating-value {
    font-size: 24px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
}
.pp-elo-rating-unit {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.65);
}
.pp-elo-delta {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.65);
}
.pp-elo-delta.is-up { color: #4ade80; }
.pp-elo-delta.is-down { color: #f87171; }
.pp-elo-caption {
    margin-top: 2px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.65);
}

.pp-elo-chart {
    display: block;
    width: 100%;
    height: 90px;
    touch-action: pan-y;
    cursor: crosshair;
}
.pp-elo-grid {
    stroke: rgba(255, 255, 255, 0.15);
    stroke-dasharray: 3 4;
}
.pp-elo-line {
    fill: none;
    stroke: var(--secondary-color);
    stroke-width: 2.2;
    stroke-linejoin: round;
}
.pp-elo-cursor {
    stroke: rgba(255, 255, 255, 0.6);
    stroke-width: 1;
}

.pp-elo-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.55);
}
.pp-elo-periods {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
}
.pp-elo-period {
    padding: 3px 10px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.pp-elo-period.is-active {
    background: white;
    color: #14213d;
}
</style>
