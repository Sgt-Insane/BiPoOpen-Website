<template>
    <section class="HomeRecentGames">
        <h2 class="hr-title">{{ title }} <GlossaryHint :terms="['offenesSpiel', 'liga', 'eloAverage', 'nackteMeile', 'shot']" /></h2>

        <Tabs v-model:value="activeFilter" class="p-tabs-chips">
            <TabList class="hr-filter">
                <Tab v-for="filter in FILTERS" :key="filter.value" :value="filter.value">{{ filter.label }}</Tab>
            </TabList>
        </Tabs>

        <!-- Nackte Meilen / Offene Shots: Kurzliste statt Spielen -->
        <HomeDebtList v-if="activeFilter === 'miles' || activeFilter === 'shots'" :kind="activeFilter" :openGames="openGames" :leagueGames="leagueGames" :gamesLoading="loading" />

        <div v-else class="hr-list">
            <template v-if="loading">
                <Skeleton v-for="i in 4" :key="i" width="100%" height="116px" borderRadius="12px" />
            </template>

            <div v-else-if="!visibleGames.length" class="hr-empty">Noch keine Spiele</div>

            <MatchElement v-for="entry in visibleGames" v-else :key="entry.match._id" :match="entry.match" :gameType="entry.type" showChip showDate showElo class="hr-entry" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import GlossaryHint from '@/components/shared/GlossaryHint.vue';
import Skeleton from 'primevue/skeleton';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import HomeDebtList from './HomeDebtList.vue';
import { isCupGame } from '@/components/frontend/league/LeagueUtilFunctions';
import { withLeagueTeamLogos } from '@/components/frontend/league/LeaguePlayersData';

const props = defineProps<{
    openGames: Match[];
    leagueGames: Match[];
    loading: boolean;
}>();

type GameType = 'league' | 'cup' | 'open';
type Filter = 'all' | GameType | 'miles' | 'shots';

const GAME_COUNT = 6;

const FILTERS: { label: string; value: Filter }[] = [
    { label: 'Alle', value: 'all' },
    { label: 'Liga', value: 'league' },
    { label: 'Cup', value: 'cup' },
    { label: 'Offen', value: 'open' },
    { label: 'Meilen', value: 'miles' },
    { label: 'Shots', value: 'shots' },
];

const TITLES: Partial<Record<Filter, string>> = { miles: 'Nackte Meilen', shots: 'Offene Shots' };

const activeFilter = ref<Filter>('all');
const title = computed(() => TITLES[activeFilter.value] ?? 'Zuletzt gespielt');

const allGames = computed(() => [
    ...props.openGames.map(match => ({ match, type: 'open' as GameType, time: match.time ?? 0 })),
    ...props.leagueGames.map(match => ({ match, type: (isCupGame(match) ? 'cup' : 'league') as GameType, time: match.time ?? 0 })),
].sort((a, b) => b.time - a.time));

const visibleGames = computed(() => allGames.value
    .filter(entry => activeFilter.value === 'all' || entry.type === activeFilter.value)
    .slice(0, GAME_COUNT)
    .map(entry => entry.type === 'open' ? entry : { ...entry, match: withLeagueTeamLogos(entry.match) }));
</script>

<style scoped>
.HomeRecentGames{
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.hr-title{
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
:deep(.hr-filter){
    padding: 0;
}
/* Alle Chips sichtbar und gleich aussehend: lieber umbrechen als seitlich scrollen (kein Ausblend-Verlauf) */
:deep(.hr-filter .p-tablist-content){
    overflow: visible;
}
:deep(.hr-filter .p-tablist-tab-list){
    flex-wrap: wrap;
    gap: 6px;
}
:deep(.hr-filter .p-tablist-nav-button){
    display: none;
}

.hr-list{
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    align-items: start;
}
.hr-list > .hr-entry{
    margin-bottom: 0;
}
.hr-empty{
    grid-column: 1 / -1;
    padding: 30px 0;
    text-align: center;
    color: var(--p-text-muted-color);
}

/* MOBILE */
@media (width <= 900px){
    .hr-title{
        font-size: 20px;
    }
    :deep(.hr-filter .p-tab){
        padding-inline: 0.7rem;
    }
    .hr-list{
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
