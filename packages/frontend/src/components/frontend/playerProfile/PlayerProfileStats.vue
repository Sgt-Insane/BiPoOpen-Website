<template>
    <div class="pp-card pp-stats">
        <!-- Siegquote & Spiele -->
        <div class="pp-stats-overview">
            <div class="pp-ring">
                <svg viewBox="0 0 64 64" aria-hidden="true">
                    <circle cx="32" cy="32" r="27" class="pp-ring-track"/>
                    <circle cx="32" cy="32" r="27" class="pp-ring-value" :stroke-dasharray="`${ringLength} ${RING_CIRCUMFERENCE}`"/>
                </svg>
                <div class="pp-ring-text">
                    <b>{{ data.winrate }} %</b>
                    <span>Siege</span>
                </div>
            </div>

            <div class="min-w-0 flex-1">
                <div class="pp-stats-games"><b>{{ formatNumber(data.totalMatches) }}</b> Spiele</div>
                <div class="pp-stats-split">
                    <span v-if="data.totalWins" class="pp-stats-split-win" :style="{ flex: data.totalWins }"></span>
                    <span v-if="data.totalLosses" class="pp-stats-split-loss" :style="{ flex: data.totalLosses }"></span>
                </div>
                <div class="pp-stats-split-labels">
                    <span class="pp-win">{{ formatNumber(data.totalWins) }} Siege</span>
                    <span class="pp-loss">{{ formatNumber(data.totalLosses) }} Niederlagen</span>
                </div>
            </div>
        </div>

        <!-- Treffer -->
        <div class="pp-stats-tiles pp-stats-tiles--2">
            <div class="pp-stats-tile">
                <b>{{ data.totalHits > 0 ? formatDecimal(data.averageHits) : '–' }}</b>
                <span>Treffer pro Spiel</span>
            </div>
            <div class="pp-stats-tile">
                <b>{{ formatNumber(data.totalHits) }}</b>
                <span>Treffer gesamt</span>
            </div>
        </div>

        <!-- Form, aeltestes links -->
        <div v-if="recentForm.length" class="pp-stats-form">
            <span class="pp-stats-form-label">Letzte {{ recentForm.length }}</span>
            <span class="pp-stats-form-results">
                <span
                    v-for="(result, index) in recentForm"
                    :key="index"
                    class="pp-stats-form-result"
                    :class="result === 'W' ? 'is-win' : 'is-loss'"
                    :title="result === 'W' ? 'Sieg' : 'Niederlage'"
                >{{ result === 'W' ? 'S' : 'N' }}</span>
            </span>
        </div>

        <!-- Serien -->
        <div class="pp-stats-tiles pp-stats-tiles--3">
            <div class="pp-stats-tile">
                <b>{{ data.currentWinStreak }} <small>{{ data.currentWinStreak === 1 ? 'Sieg' : 'Siege' }}</small></b>
                <span>aktuelle Serie</span>
            </div>
            <div class="pp-stats-tile">
                <b class="pp-win">{{ data.bestWinStreak }} <small>{{ data.bestWinStreak === 1 ? 'Sieg' : 'Siege' }}</small></b>
                <span>längste Serie</span>
            </div>
            <div class="pp-stats-tile">
                <b class="pp-loss">{{ data.extraStats.longestLosingStreak }} <small>Niederl.</small></b>
                <span>längste Pleite</span>
            </div>
        </div>

        <div v-if="bestTime" class="pp-stats-time">
            <i class="pi pi-clock"></i>
            <span>Stärkste Zeit <b>{{ bestTime.label }}</b> · {{ bestTime.winrate }} % in {{ bestTime.total }} Spielen</span>
        </div>
    </div>

    <!-- Kategorien -->
    <div class="pp-card pp-categories">
        <div v-for="category in categories" :key="category.name" class="pp-category">
            <div class="pp-category-head">
                <span class="pp-category-dot" :style="{ background: category.color }"></span>
                <span class="pp-category-name">{{ category.label }}</span>
                <span class="pp-category-meta">
                    {{ category.wins }} / {{ category.matches }} · Ø {{ category.trackedMatches > 0 ? formatDecimal(category.averageHits) : '–' }}
                </span>
                <b class="pp-category-rate">{{ category.winrate }} %</b>
            </div>
            <div class="pp-category-bar">
                <span :style="{ width: `${category.winrate}%`, background: category.color }"></span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: PlayerProfileData }>();

const RING_CIRCUMFERENCE = 2 * Math.PI * 27;
const ringLength = computed(() => props.data.winrate / 100 * RING_CIRCUMFERENCE);

const formatNumber = (value: number) => value.toLocaleString('de-DE');
const formatDecimal = (value: number) => value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const recentForm = computed(() => props.data.recentForm.slice(0, 5).reverse());

const bestTime = computed(() => props.data.extraStats.timeOfDayStats.find(block => block.label === props.data.extraStats.bestTimeOfDay));

const CATEGORY_STYLES: Record<string, { label: string; color: string; order: number }> = {
    'Offene Spiele 1v1': { label: 'Offene Spiele 1v1', color: 'var(--bp-text)', order: 0 },
    'Offene Spiele 2v2': { label: 'Offene Spiele 2v2', color: 'var(--bp-text)', order: 0 },
    'BiPo League': { label: 'BiPo League', color: 'var(--main-color)', order: 1 },
    'BiPo League Cup': { label: 'League Cup', color: 'var(--secondary-color)', order: 2 },
    'BiPo Open Turniere': { label: 'BiPo Open', color: '#e3a92b', order: 1 },
};

const categories = computed(() => props.data.categories
    .map(category => ({
        ...category,
        ...(CATEGORY_STYLES[category.name] ?? { label: category.name, color: 'var(--bp-text-faint)', order: 9 }),
        winrate: category.matches > 0 ? Math.round(category.wins / category.matches * 100) : 0,
    }))
    .sort((a, b) => a.order - b.order));
</script>

<style scoped>
.pp-stats {
    padding: 14px;
}

/* ── Siegquote ── */
.pp-stats-overview {
    display: flex;
    align-items: center;
    gap: 16px;
}
.pp-ring {
    position: relative;
    flex-shrink: 0;
    width: 72px;
    height: 72px;

    svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
    }
    circle {
        fill: none;
        stroke-width: 7;
    }
}
.pp-ring-track {
    stroke: var(--bp-primary-weak);
}
.pp-ring-value {
    stroke: var(--main-color);
    stroke-linecap: round;
}
.pp-ring-text {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.1;

    b {
        font-size: 15px;
        font-weight: 800;
    }
    span {
        font-size: 10px;
        color: var(--bp-text-muted);
    }
}
.pp-stats-games {
    font-size: 13px;
    color: var(--bp-text-muted);

    b {
        margin-right: 2px;
        font-size: 26px;
        font-weight: 800;
        color: var(--bp-text-strong);
    }
}
.pp-stats-split {
    display: flex;
    gap: 3px;
    height: 6px;
    margin: 6px 0 5px;

    span {
        border-radius: 3px;
    }
}
.pp-stats-split-win {
    background: #1f9d55;
}
.pp-stats-split-loss {
    background: #d64545;
}
.pp-stats-split-labels {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
}

/* ── Kacheln ── */
.pp-stats-tiles {
    display: grid;
    gap: 8px;
    margin-top: 14px;
}
.pp-stats-tiles--2 { grid-template-columns: 1fr 1fr; }
.pp-stats-tiles--3 { grid-template-columns: 1fr 1fr 1fr; }
.pp-stats-tile {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--bp-fill-soft);

    b {
        font-size: 17px;
        font-weight: 800;
        line-height: 1.2;
    }
    small {
        font-size: 12px;
        font-weight: 700;
    }
    span {
        margin-top: 1px;
        font-size: 12px;
        color: var(--bp-text-muted);
    }
}

/* ── Form ── */
.pp-stats-form {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 14px;
}
.pp-stats-form-label {
    font-size: 12px;
    color: var(--bp-text-muted);
}
.pp-stats-form-results {
    display: flex;
    gap: 5px;
}
.pp-stats-form-result {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    color: white;
    font-size: 11px;
    font-weight: 800;
}
.pp-stats-form-result.is-win { background: #1f9d55; }
.pp-stats-form-result.is-loss { background: #d64545; }

.pp-stats-time {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding: 9px 12px;
    border: 1px solid var(--bp-border);
    border-radius: 12px;
    font-size: 13px;
    color: var(--bp-text);

    .pi {
        color: var(--bp-text-muted);
    }
}

/* ── Kategorien ── */
.pp-categories {
    padding: 4px 14px;
}
.pp-category {
    padding: 11px 0;
}
.pp-category + .pp-category {
    border-top: 1px solid var(--bp-border);
}
.pp-category-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}
.pp-category-dot {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border-radius: 3px;
}
.pp-category-name {
    flex: 1;
    min-width: 0;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pp-category-meta {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--bp-text-muted);
}
.pp-category-rate {
    flex-shrink: 0;
    min-width: 40px;
    text-align: right;
}
.pp-category-bar {
    height: 4px;
    margin-top: 7px;
    overflow: hidden;
    border-radius: 2px;
    background: var(--bp-fill);

    span {
        display: block;
        height: 100%;
        border-radius: 2px;
    }
}
</style>
