<template>
    <section class="HomeRecentGames">
        <h2 class="hr-title">{{ title }}</h2>

        <Tabs v-model:value="activeFilter" class="p-tabs-chips">
            <TabList class="hr-filter">
                <Tab v-for="filter in FILTERS" :key="filter.value" :value="filter.value">{{ filter.label }}</Tab>
            </TabList>
        </Tabs>

        <div class="hr-list">
            <template v-if="loading">
                <Skeleton v-for="i in 4" :key="i" width="100%" height="116px" borderRadius="12px" />
            </template>

            <div v-else-if="!visibleGames.length" class="hr-empty">Noch keine Spiele</div>

            <MatchElement v-for="entry in visibleGames" v-else :key="entry.match._id" :match="entry.match" :gameType="entry.type" showChip showDate showElo class="hr-entry" />
        </div>

        <!-- Gewaehlter Filter wird auf die Ergebnisse-Seite mitgenommen -->
        <router-link v-if="!loading" :to="resultsLink" class="bp-more-button">
            Alle Ergebnisse <i class="pi pi-chevron-right"></i>
        </router-link>
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Skeleton from 'primevue/skeleton';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import { GAME_FILTERS, combineResults, matchesFilter, type GameFilter } from '@/components/frontend/results/resultsUtil';

const props = defineProps<{
    openGames: Match[];
    leagueGames: Match[];
    loading: boolean;
}>();

// Spiel-Filter wie auf der Ergebnisse-Seite
const GAME_COUNT = 6;
const FILTERS = GAME_FILTERS;

const activeFilter = ref<GameFilter>('all');
const title = 'Zuletzt gespielt';

const allGames = computed(() => combineResults(props.openGames, props.leagueGames));

const visibleGames = computed(() => allGames.value
    .filter(entry => matchesFilter(entry, activeFilter.value))
    .slice(0, GAME_COUNT));

const resultsLink = computed(() => activeFilter.value === 'all'
    ? '/Ergebnisse'
    : { path: '/Ergebnisse', query: { typ: activeFilter.value } });
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
