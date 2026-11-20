<template>
    <div class="gt-timeline">
        <div v-if="!rows.length" class="gt-empty">{{ emptyText }}</div>

        <template v-for="(row, index) in rows" :key="row.entry.key">
            <div v-if="row.monthLabel" class="gt-month">{{ row.monthLabel }}</div>

            <div class="gt-row" :class="{ 'gt-row--first': index === 0, 'gt-row--last': index === rows.length - 1 }">
                <!-- Zeitstrahl: Kalenderblatt fuer Bloecke, Punkt fuer Einzelspiele -->
                <div class="gt-rail">
                    <div v-if="row.entry.kind === 'session'" class="gt-date">
                        <span class="gt-date-month">{{ SHORT_MONTHS[row.entry.day.getMonth()] }}</span>
                        <span class="gt-date-day">{{ row.entry.day.getDate() }}</span>
                    </div>
                    <span v-else class="gt-dot"></span>
                </div>

                <!-- Block: Karte kommt von der Seite (Liga-Spieltag, Ergebnisse-Tag) -->
                <slot v-if="row.entry.kind === 'session'" name="session"
                    :entry="(row.entry as SessionEntry)"
                    :expanded="isExpanded(row.entry.key)"
                    :setExpanded="(value: boolean) => setExpanded(row.entry.key, value)"
                />

                <!-- Einzelspiele eines Tages -->
                <div v-else>
                    <button type="button" class="gt-singles-head" :aria-expanded="isExpanded(row.entry.key)" @click="setExpanded(row.entry.key, !isExpanded(row.entry.key))">
                        <span class="gt-singles-label">
                            <b>{{ formatSinglesCount(row.entry.games.length) }}</b>
                            <template v-if="row.entry.day"> · {{ formatSinglesDay(row.entry.day) }}</template>
                        </span>
                        <i class="pi gt-chevron" :class="isExpanded(row.entry.key) ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                    </button>
                    <div v-if="isExpanded(row.entry.key)" class="gt-singles-games">
                        <MatchElement v-for="match in row.entry.games" :key="match._id"
                            :match="match"
                            :gameType="getGameType?.(match)"
                            :showChip="showChip"
                            timestamp="clock"
                            compact
                        />
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts" generic="Entry extends GameTimelineEntry">
import { computed, ref } from 'vue';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import type { GameTimelineEntry } from './gameTimeline';

type GameType = 'open' | 'league' | 'cup' | 'tournament';

const props = withDefaults(defineProps<{
    entries: Entry[];                                 // neueste zuerst (buildGameTimeline)
    // Spielart je Spiel fuer MatchElement (Chip, Logos). Ohne Angabe leitet MatchElement sie ab.
    getGameType?: (match: Match) => GameType | undefined;
    showChip?: boolean;
    // "2 Einzelspiele" in der Liga, "2 Spiele" bei gemischten Spielen
    formatSinglesCount?: (count: number) => string;
    // "31.10." bzw. "Fr, 31.10."
    formatSinglesDay?: (day: Date) => string;
    emptyText?: string;
}>(), {
    getGameType: undefined,
    showChip: false,
    formatSinglesCount: (count: number) => `${count} ${count === 1 ? 'Einzelspiel' : 'Einzelspiele'}`,
    formatSinglesDay: (day: Date) => `${day.getDate()}.${day.getMonth() + 1}.`,
    emptyText: 'Noch keine Spiele gespielt.',
});

// Block mit dem Typ der Seite, z.B. Liga-Spieltag mit Nummer
type SessionEntry = Extract<Entry, { kind: 'session' }>;

defineSlots<{
    session(props: { entry: SessionEntry; expanded: boolean; setExpanded: (value: boolean) => void }): any;
}>();

const SHORT_MONTHS = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];

// Monatsueberschrift, sobald sich der Monat aendert. Jahr nur, wenn es nicht das aktuelle ist.
const getMonthLabel = (date: Date) => {
    const month = date.toLocaleDateString('de-DE', { month: 'long' });
    return date.getFullYear() === new Date().getFullYear() ? month : `${month} ${date.getFullYear()}`;
};

const rows = computed(() => {
    let previousLabel = '';
    return props.entries.map((entry) => {
        const label = entry.day ? getMonthLabel(entry.day) : '';
        const monthLabel = label !== previousLabel ? label : '';
        previousLabel = label;
        return { entry, monthLabel };
    });
});

// Per Default alles zugeklappt
const expandedState = ref<Record<string, boolean>>({});
const isExpanded = (key: string) => !!expandedState.value[key];
const setExpanded = (key: string, value: boolean) => {
    expandedState.value = { ...expandedState.value, [key]: value };
};
</script>

<style scoped>
.gt-timeline{
    padding-top: 4px;
}

.gt-empty{
    text-align: center;
    color: var(--bp-text-muted);
    padding: 40px 20px;
}

.gt-month{
    padding: 6px 0 10px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bp-text-subtle);
}

/* ─── Zeile mit Zeitstrahl ─── */
.gt-row{
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    column-gap: 10px;
    padding-bottom: 12px;
}
.gt-rail{
    position: relative;
    display: flex;
    justify-content: center;
}
/* Linie laeuft ueber die ganze Zeile, an Anfang und Ende nur bis zur Mitte des ersten/letzten Punkts */
.gt-rail::before{
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(50% - 1px);
    width: 2px;
    background: var(--bp-border-strong);
}
.gt-row--first .gt-rail::before{ top: 20px; }
.gt-row--last .gt-rail::before{ bottom: auto; height: 20px; }
.gt-row--first.gt-row--last .gt-rail::before{ display: none; }

/* Kalenderblatt */
.gt-date{
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 40px;
    height: fit-content;
    border-radius: 8px;
    overflow: hidden;
    background: var(--bp-surface);
    border: 1px solid var(--bp-border);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.gt-date-month{
    width: 100%;
    padding: 2px 0 1px;
    background: var(--main-color);
    color: #fff;
    font-size: 0.5625rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-align: center;
}
.gt-date-day{
    padding: 2px 0 4px;
    font-size: 1.125rem;
    font-weight: 800;
    line-height: 1.1;
    color: var(--bp-text-strong);
}

/* Punkt fuer Einzelspiele, auf Hoehe der Einzelspiele-Leiste */
.gt-dot{
    position: relative;
    margin-top: 14px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--bp-border-strong);
    background: var(--page-gray);
}

/* ─── Einzelspiele ─── */
.gt-singles-head{
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    border: 0;
    border-radius: 10px;
    background: var(--bp-fill);
    color: var(--bp-text-muted);
    font: inherit;
    font-size: 0.75rem;
    text-align: left;
    cursor: pointer;
}
.gt-singles-label{
    flex: 1;
    min-width: 0;
}
.gt-singles-label b{
    font-weight: 600;
    color: var(--bp-text);
}
.gt-chevron{
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--bp-text-faint);
}
/* Abstand kommt vom margin-bottom des MatchElements */
.gt-singles-games{
    display: flex;
    flex-direction: column;
    margin-top: 8px;
}
.gt-singles-games > :last-child{
    margin-bottom: 0;
}
</style>
