<template>
    <GameSessionCard
        :session="matchday"
        :expanded="expanded"
        :title="matchday.isFinalFour ? 'Final 4' : `Spieltag ${matchday.number}`"
        :meta="getSessionMeta(matchday, 'Teams')"
        :highlights="highlights"
        :getLogo="getLogo"
        :getDisplayName="getDisplayName"
        :getGameType="() => 'league'"
        :extraTabs="matchday.isFinalFour ? [] : [{ value: 'table', label: 'Tabelle' }]"
        @update:expanded="emit('update:expanded', $event)"
    >
        <!-- Tabelle nach dem Spieltag mit Plaetzen auf und ab (Final-4-Abende aendern die Tabelle nicht) -->
        <template #tab="{ tab }">
            <div v-if="tab === 'table'">
                <ul class="mdc-list">
                    <li class="mdc-row mdc-row--head">
                        <span class="mdc-pos">#</span>
                        <span class="mdc-name" v-fit-text>Team</span>
                        <span class="mdc-record">S–N</span>
                        <span v-if="hasChanges" class="mdc-change">+/–</span>
                    </li>
                    <li v-for="row in table" :key="row.name" class="mdc-row" :class="{ 'mdc-row--withdrawn': row.withdrawn }">
                        <span class="mdc-pos" :class="getZoneClass(row.position - 1)">{{ row.position }}</span>
                        <Avatar :name="getDisplayName(row.name)" :avatarImage="getLogo(row.name)" class="mdc-logo"/>
                        <span class="mdc-name" v-fit-text>
                            {{ getDisplayName(row.name) }}
                            <span v-if="row.withdrawn" class="mdc-withdrawn">zurückgezogen</span>
                        </span>
                        <span class="mdc-record">{{ row.withdrawn ? '–' : `${row.wins}–${row.losses}` }}</span>
                        <span v-if="hasChanges" class="mdc-change" :class="getChangeClass(row.change)">{{ formatChange(row.change) }}</span>
                    </li>
                </ul>
                <p v-if="!hasChanges" class="mdc-hint">Erster Spieltag, daher noch keine Veränderung.</p>
            </div>
        </template>
    </GameSessionCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import GameSessionCard from '@/components/shared/GameTimeline/GameSessionCard.vue';
import { getSessionMeta } from '@/components/shared/GameTimeline/gameTimeline';
import { getMatchdayHighlights, getMatchdayTable, type Matchday } from './LeagueMatchdays';

const props = withDefaults(defineProps<{
    matchday: Matchday;
    expanded: boolean;
    regularGames: Match[];              // Hauptrunde der Liga, fuer die Tabelle
    leaguePlayers: LeaguePlayer[];
    withdrawnPlayers?: LeaguePlayer[];
    getLogo: (teamName: string) => string | undefined;
    getDisplayName: (teamName: string) => string;
    highlightTopSlots?: number;
    promotionSlots?: number;
    relegationSlots?: number;
}>(), {
    withdrawnPlayers: () => [],
    highlightTopSlots: 0,
    promotionSlots: 0,
    relegationSlots: 0,
});

const emit = defineEmits<{ 'update:expanded': [value: boolean] }>();

// Auch zugeklappt gebraucht: Tabellenfuehrung und Spruenge stehen in den Kopfzeilen
const table = computed(() => props.matchday.isFinalFour
    ? []
    : getMatchdayTable(props.regularGames, props.matchday, props.leaguePlayers, props.withdrawnPlayers));
const hasChanges = computed(() => table.value.some(row => row.change !== null));

const highlights = computed(() =>
    getMatchdayHighlights(props.matchday, props.matchday.isFinalFour ? null : table.value, props.getDisplayName));

const formatChange = (change: number | null) => {
    if (!change) return '–';
    return `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}`;
};

const getChangeClass = (change: number | null) =>
    !change ? 'mdc-change--same' : change > 0 ? 'mdc-change--up' : 'mdc-change--down';

// Zonen wie in LeagueStandingsTable: Aufstieg, Final 4, Abstieg
const getZoneClass = (index: number) => {
    if (index < props.promotionSlots) return 'mdc-zone-promotion';
    if (index < props.highlightTopSlots) return 'mdc-zone-qualify';
    if (table.value.length - 1 - index < props.relegationSlots) return 'mdc-zone-relegation';
    return '';
};
</script>

<style scoped>
.mdc-list{
    list-style: none;
    margin: 0;
    padding: 0;
}
.mdc-row{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    font-size: 0.8125rem;
    color: var(--bp-text);
}
.mdc-row + .mdc-row{
    border-top: 1px solid var(--bp-border);
}
.mdc-row--head{
    padding-top: 0;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--bp-text-subtle);
}
/* Kopfzeile: Platz fuer das Logo mitrechnen */
.mdc-row--head .mdc-name{
    padding-left: 34px;
    font-weight: 600;
    color: inherit;
}
.mdc-logo{
    flex-shrink: 0;
    width: 24px !important;
    height: 24px !important;
    min-width: 24px !important;
    font-size: 0.5625rem !important;
}
.mdc-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    font-weight: 600;
    color: var(--bp-text-strong);
}
.mdc-row--withdrawn .mdc-name,
.mdc-row--withdrawn .mdc-record{
    color: var(--bp-text-subtle);
}
.mdc-withdrawn{
    margin-left: 4px;
    font-size: 0.6875rem;
    font-weight: 400;
}
.mdc-record{
    flex-shrink: 0;
    min-width: 28px;
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--bp-text-strong);
}
.mdc-row--head .mdc-record{
    font-weight: 600;
    color: inherit;
}
.mdc-pos{
    flex-shrink: 0;
    width: 18px;
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--bp-text-strong);
}
.mdc-row--head .mdc-pos{
    font-weight: 600;
    color: inherit;
}
.mdc-zone-qualify{ color: #1F97B0; }
.mdc-zone-promotion{ color: var(--bp-success); }
.mdc-zone-relegation{ color: var(--bp-danger); }

.mdc-change{
    flex-shrink: 0;
    width: 36px;
    text-align: right;
    font-size: 0.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.mdc-change--up{ color: var(--bp-success); }
.mdc-change--down{ color: var(--bp-danger); }
.mdc-change--same{ color: var(--bp-text-faint); }

.mdc-hint{
    margin: 8px 0 0;
    font-size: 0.75rem;
    color: var(--bp-text-muted);
}
</style>
