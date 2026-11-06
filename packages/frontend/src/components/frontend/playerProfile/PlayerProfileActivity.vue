<template>
    <section class="pp-section">
        <div class="pp-section-head">
            <h2 class="pp-section-title">Aktivität</h2>
            <div ref="yearScroller" class="pp-activity-years" :class="{ 'is-scrolled': yearsScrolled }" @scroll="onYearsScroll">
                <button
                    v-for="year in years"
                    :key="year"
                    type="button"
                    :aria-pressed="year === selectedYear"
                    :class="{ 'is-active': year === selectedYear }"
                    @click="selectYear(year)"
                >{{ year }}</button>
            </div>
        </div>

        <div class="pp-card pp-activity">
            <div class="pp-activity-summary">
                <b>{{ yearData.playDays }}</b>
                {{ yearData.playDays === 1 ? 'Spieltag' : 'Spieltage' }} ·
                {{ yearData.games.toLocaleString('de-DE') }} {{ yearData.games === 1 ? 'Spiel' : 'Spiele' }}
            </div>

            <div class="pp-activity-months" :style="columnStyle" aria-hidden="true">
                <span
                    v-for="label in yearData.monthLabels"
                    :key="label.text"
                    :style="{ gridColumnStart: label.column + 1 }"
                >{{ label.text }}</span>
            </div>

            <!-- Antippen oder mit dem Finger drueberwischen waehlt einen Tag -->
            <div
                ref="grid"
                class="pp-activity-grid"
                :style="columnStyle"
                @pointerdown="selectFromPointer"
                @pointermove="onPointerMove"
            >
                <span
                    v-for="(day, index) in yearData.cells"
                    :key="index"
                    class="pp-activity-cell"
                    :class="day ? [`level-${day.level}`, { 'is-selected': day === selectedDay }] : 'is-empty'"
                    :title="day ? getDayLabel(day) : undefined"
                ></span>
            </div>

            <div class="pp-activity-footer">
                <span class="pp-activity-hint" :class="{ 'is-selected': selectedDay }">
                    {{ selectedDay ? getDayLabel(selectedDay) : 'Tippe auf einen Tag' }}
                </span>
                <span class="pp-activity-legend" aria-hidden="true">
                    weniger
                    <span v-for="level in LEVEL_COUNT" :key="level" class="pp-activity-cell" :class="`level-${level - 1}`"></span>
                    mehr
                </span>
            </div>

            <div class="pp-activity-stats">
                <div>
                    <div class="pp-activity-stat-value">{{ yearData.longestStreak }} {{ yearData.longestStreak === 1 ? 'Tag' : 'Tage' }}</div>
                    <div class="pp-activity-stat-label">längste Serie</div>
                </div>
                <div>
                    <div class="pp-activity-stat-value">{{ MONTH_LABELS[yearData.topMonth] }} · {{ yearData.topMonthGames }}</div>
                    <div class="pp-activity-stat-label">aktivster Monat</div>
                </div>
                <div>
                    <div class="pp-activity-stat-value">{{ WEEKDAY_LABELS[yearData.topWeekday] }}</div>
                    <div class="pp-activity-stat-label">Lieblingstag</div>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

// Alle Spiele, unabhaengig von Zeitraum und Spielart
const props = defineProps<{ matchHistory: MatchHistoryEntry[] }>();

type ActivityDay = { date: Date; games: number; wins: number; level: number };
type DayCount = { games: number; wins: number };

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
// Woche beginnt am Montag
const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const LEVEL_COUNT = 5;

const getDayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const getWeekdayIndex = (date: Date) => (date.getDay() + 6) % 7;

// Stufe 0 = kein Spiel, danach 1 / 2-3 / 4-6 / 7+ Spiele
const getLevel = (games: number) => {
    if (games === 0) return 0;
    if (games === 1) return 1;
    if (games <= 3) return 2;
    if (games <= 6) return 3;
    return 4;
};

const dayCounts = computed(() => {
    const counts = new Map<string, DayCount>();
    props.matchHistory.forEach(({ time, won }) => {
        if (!time || time <= 0) return;
        const key = getDayKey(new Date(time));
        const count = counts.get(key) ?? { games: 0, wins: 0 };
        count.games++;
        if (won) count.wins++;
        counts.set(key, count);
    });
    return counts;
});

// Aufsteigend, nur Jahre mit Spielen
const years = computed(() => {
    const set = new Set<number>();
    props.matchHistory.forEach(({ time }) => { if (time > 0) set.add(new Date(time).getFullYear()); });
    return [...set].sort((a, b) => a - b);
});

const selectedYear = ref(years.value[years.value.length - 1] ?? new Date().getFullYear());
const selectedDayKey = ref<string | null>(null);

watch(years, list => {
    if (!list.includes(selectedYear.value) && list.length) selectedYear.value = list[list.length - 1];
});

const selectYear = (year: number) => {
    selectedYear.value = year;
    selectedDayKey.value = null;
};

// Ganzes Jahr, im laufenden Jahr bleiben die Tage nach heute leer
const yearData = computed(() => {
    const year = selectedYear.value;
    const now = new Date();
    const getDayIndex = (date: Date) => Math.round((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000);
    const yearEndIndex = getDayIndex(new Date(year, 11, 31));
    const lastDayIndex = year === now.getFullYear() ? getDayIndex(new Date(year, now.getMonth(), now.getDate())) : yearEndIndex;

    // Spalten = Wochen, die erste Spalte beginnt am Montag vor dem 1. Januar
    const offset = getWeekdayIndex(new Date(year, 0, 1));
    const weekCount = Math.floor((offset + yearEndIndex) / 7) + 1;

    const cells: (ActivityDay | null)[] = [];
    const monthGames = new Array(12).fill(0);
    const weekdayGames = new Array(7).fill(0);
    let games = 0;
    let playDays = 0;
    let streak = 0;
    let longestStreak = 0;

    for (let i = 0; i < weekCount * 7; i++) {
        const dayIndex = i - offset;
        if (dayIndex < 0 || dayIndex > lastDayIndex) {
            cells.push(null);
            continue;
        }
        const date = new Date(year, 0, 1 + dayIndex);
        const count = dayCounts.value.get(getDayKey(date)) ?? { games: 0, wins: 0 };
        cells.push({ date, ...count, level: getLevel(count.games) });

        games += count.games;
        monthGames[date.getMonth()] += count.games;
        weekdayGames[getWeekdayIndex(date)] += count.games;
        if (count.games > 0) {
            playDays++;
            streak++;
            longestStreak = Math.max(longestStreak, streak);
        } else {
            streak = 0;
        }
    }

    // Beschriftung an der Woche mit dem Monatsersten
    const monthLabels = MONTH_LABELS.map((text, month) => ({
        text,
        column: Math.floor((offset + getDayIndex(new Date(year, month, 1))) / 7),
    }));

    const topMonth = monthGames.indexOf(Math.max(...monthGames));

    return {
        cells,
        weekCount,
        monthLabels,
        games,
        playDays,
        longestStreak,
        topMonth,
        topMonthGames: monthGames[topMonth],
        topWeekday: weekdayGames.indexOf(Math.max(...weekdayGames)),
    };
});

const selectedDay = computed(() => yearData.value.cells.find(day => day && getDayKey(day.date) === selectedDayKey.value) ?? null);

const columnStyle = computed(() => ({ gridTemplateColumns: `repeat(${yearData.value.weekCount}, minmax(0, 1fr))` }));

const getDayLabel = (day: ActivityDay) => {
    const date = day.date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    if (day.games === 0) return `${date} · keine Spiele`;
    return `${date} · ${day.games} ${day.games === 1 ? 'Spiel' : 'Spiele'} · ${day.wins} ${day.wins === 1 ? 'Sieg' : 'Siege'}`;
};

// Treffer ueber die Position statt ueber das Element, damit auch die Luecken zwischen den kleinen Kaestchen zaehlen
const grid = ref<HTMLElement | null>(null);

const selectFromPointer = (event: PointerEvent) => {
    if (!grid.value) return;
    const rect = grid.value.getBoundingClientRect();
    const { weekCount, cells } = yearData.value;
    const column = Math.min(weekCount - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * weekCount)));
    const row = Math.min(6, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * 7)));
    const day = cells[column * 7 + row];
    if (day) selectedDayKey.value = getDayKey(day.date);
};

const onPointerMove = (event: PointerEvent) => {
    if (event.buttons) selectFromPointer(event);
};

// Neuestes Jahr steht rechts, bei vielen Jahren dorthin scrollen
const yearScroller = ref<HTMLElement | null>(null);
const yearsScrolled = ref(false);
const onYearsScroll = () => yearsScrolled.value = (yearScroller.value?.scrollLeft ?? 0) > 0;
onMounted(() => {
    if (yearScroller.value) yearScroller.value.scrollLeft = yearScroller.value.scrollWidth;
    onYearsScroll();
});
</script>

<style scoped>
.pp-activity-years {
    display: flex;
    gap: 6px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;

    button {
        flex-shrink: 0;
        padding: 5px 12px;
        border: 1px solid var(--bp-border);
        border-radius: 999px;
        background: var(--bp-surface);
        color: var(--bp-text-strong);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }
    button.is-active {
        border-color: var(--bp-inverse-bg);
        background: var(--bp-inverse-bg);
        color: var(--bp-inverse-text);
    }
}
.pp-activity-years::-webkit-scrollbar {
    display: none;
}
.pp-activity-years.is-scrolled {
    mask-image: linear-gradient(to right, transparent, black 24px);
}

.pp-activity {
    padding: 14px;
}

.pp-activity-summary {
    margin-bottom: 14px;
    font-size: 14px;
    color: var(--bp-text-muted);

    b {
        margin-right: 2px;
        font-size: 22px;
        font-weight: 800;
        color: var(--bp-text-strong);
    }
}

.pp-activity-months,
.pp-activity-grid {
    display: grid;
    column-gap: 2px;
}
.pp-activity-months {
    margin-bottom: 4px;
    font-size: 10px;
    line-height: 1;
    color: var(--bp-text-muted);

    span {
        grid-row: 1;
        white-space: nowrap;
    }
}
.pp-activity-grid {
    grid-template-rows: repeat(7, auto);
    grid-auto-flow: column;
    row-gap: 2px;
    cursor: pointer;
    touch-action: pan-y;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}

.pp-activity-cell {
    display: block;
    aspect-ratio: 1;
    border-radius: 1px;
    background: var(--bp-fill);
}
.pp-activity-cell.is-empty {
    visibility: hidden;
}
.pp-activity-cell.level-1 { background: color-mix(in srgb, var(--main-color) 25%, var(--bp-surface)); }
.pp-activity-cell.level-2 { background: color-mix(in srgb, var(--main-color) 55%, var(--bp-surface)); }
.pp-activity-cell.level-3 { background: var(--main-color); }
.pp-activity-cell.level-4 { background: color-mix(in srgb, var(--main-color) 70%, var(--bp-text-strong)); }
.pp-activity-cell.is-selected {
    outline: 1.5px solid var(--bp-text-strong);
    outline-offset: 0.5px;
}

.pp-activity-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 12px;
    margin-top: 12px;
    font-size: 12px;
    color: var(--bp-text-muted);
}
.pp-activity-hint.is-selected {
    font-weight: 700;
    color: var(--bp-text-strong);
}
.pp-activity-legend {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
    font-size: 11px;

    .pp-activity-cell {
        width: 10px;
    }
    .pp-activity-cell:first-child {
        margin-left: 3px;
    }
    .pp-activity-cell:last-child {
        margin-right: 3px;
    }
}

.pp-activity-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--bp-border);
}
.pp-activity-stat-value {
    font-size: 15px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.pp-activity-stat-label {
    margin-top: 1px;
    font-size: 12px;
    color: var(--bp-text-muted);
}

@media (min-width: 560px) {
    .pp-activity-months,
    .pp-activity-grid {
        column-gap: 3px;
    }
    .pp-activity-grid {
        row-gap: 3px;
    }
    .pp-activity-cell {
        border-radius: 2px;
    }
}
</style>
