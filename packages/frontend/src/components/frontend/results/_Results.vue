<template>
    <div class="Results">
        <div class="rs-head">
            <button type="button" class="rs-back" aria-label="Zurück" @click="goBack">
                <i class="pi pi-chevron-left"></i>
            </button>
            <h1 class="rs-title">Ergebnisse</h1>
        </div>

        <!-- Spielerfilter: Spieler- oder Teamname -->
        <div class="rs-search">
            <i class="pi pi-search rs-search-icon"></i>
            <input
                v-model="playerQuery"
                class="rs-search-input"
                type="search"
                placeholder="Spieler filtern …"
                aria-label="Spieler filtern"
                autocomplete="off"
                enterkeyhint="search"
                @keydown.esc="playerQuery = ''"
            />
            <button v-if="playerQuery" type="button" class="rs-search-clear" aria-label="Filter löschen" @click="playerQuery = ''">
                <i class="pi pi-times"></i>
            </button>
        </div>

        <Tabs v-model:value="activeFilter" class="p-tabs-chips">
            <TabList class="rs-filter">
                <Tab v-for="filter in GAME_FILTERS" :key="filter.value" :value="filter.value">{{ filter.label }}</Tab>
            </TabList>
        </Tabs>

        <div v-if="loading" aria-busy="true">
            <div v-for="i in 5" :key="i" class="bp-skeleton bp-skeleton-match"></div>
        </div>

        <div v-else-if="!filteredGames.length" class="rs-empty">
            {{ playerQuery.trim() ? `Keine Spiele mit „${playerQuery.trim()}“` : 'Noch keine Spiele' }}
        </div>

        <template v-else>
            <section v-for="day in visibleDays" :key="day.key" class="rs-day">
                <div class="rs-day-head">
                    <h2 class="rs-day-title">{{ day.label }}</h2>
                    <span class="rs-day-count">{{ day.total }} {{ day.total === 1 ? 'Spiel' : 'Spiele' }}</span>
                </div>

                <MatchElement v-for="entry in day.games" :key="entry.match._id" :match="entry.match" :gameType="entry.type" showChip showElo showEloChange>
                    <template #meta>
                        <span v-if="entry.time" class="rs-clock">{{ formatResultClock(entry.time) }}</span>
                    </template>
                </MatchElement>
            </section>

            <button v-if="visibleCount < filteredGames.length" type="button" class="bp-more-button" @click="visibleCount += PAGE_SIZE">
                Ältere Spiele laden
            </button>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import { useGrayPage } from '@/components/shared/useGrayPage';
import { onGameSaved } from '@/components/shared/GameEntry/useAddGame';
import { getAllOpenGames } from '@/components/frontend/openGames/OpenGamesUtilFunctions';
import { getAllLeagueGames } from '@/components/frontend/league/LeagueUtilFunctions';
import { getCachedGameData } from '@/util/gameDataCache';
import {
    GAME_FILTERS, combineResults, formatResultClock, formatResultDay, getResultDayKey,
    isGameFilter, matchesFilter, matchesPlayer, type GameFilter, type ResultEntry,
} from './resultsUtil';

const PAGE_SIZE = 20;

useGrayPage();

const route = useRoute();
const router = useRouter();

// Von der Startseite kommt der dort gewaehlte Filter mit: /Ergebnisse?typ=league
const activeFilter = ref<GameFilter>(isGameFilter(route.query.typ) ? route.query.typ : 'all');
const playerQuery = ref('');
const visibleCount = ref(PAGE_SIZE);

// Schon geladene Spiele (z.B. aus Profil oder Weltrangliste) sofort zeigen, frisch nachladen
const cached = getCachedGameData();
const openGames = ref<Match[]>(cached?.openGames ?? []);
const leagueGames = ref<Match[]>(cached?.leagueGames ?? []);
const loading = ref(!cached);

const loadGames = async () => {
    const [openResult, leagueResult] = await Promise.allSettled([getAllOpenGames(), getAllLeagueGames()]);
    if (openResult.status === 'fulfilled') openGames.value = openResult.value;
    if (leagueResult.status === 'fulfilled') leagueGames.value = leagueResult.value;
    loading.value = false;
};

loadGames();
// Plus in der Navigation: neues Spiel sofort in der Liste
onGameSaved(loadGames);

const allGames = computed(() => combineResults(openGames.value, leagueGames.value));

const filteredGames = computed(() => allGames.value.filter(entry =>
    matchesFilter(entry, activeFilter.value) && matchesPlayer(entry.match, playerQuery.value)));

// Neuer Filter: wieder oben mit der ersten Seite anfangen
watch([activeFilter, playerQuery], () => visibleCount.value = PAGE_SIZE);

// Spieleanzahl je Tag ueber alle gefilterten Spiele, auch wenn der Tag nur zum Teil geladen ist
const dayTotals = computed(() => {
    const totals = new Map<string, number>();
    for (const entry of filteredGames.value) {
        const key = getResultDayKey(entry.time);
        totals.set(key, (totals.get(key) ?? 0) + 1);
    }
    return totals;
});

const visibleDays = computed(() => {
    const days: { key: string; label: string; total: number; games: ResultEntry[] }[] = [];
    for (const entry of filteredGames.value.slice(0, visibleCount.value)) {
        const key = getResultDayKey(entry.time);
        let day = days[days.length - 1];
        if (day?.key !== key) {
            day = { key, label: entry.time ? formatResultDay(entry.time) : 'Ohne Datum', total: dayTotals.value.get(key) ?? 0, games: [] };
            days.push(day);
        }
        day.games.push(entry);
    }
    return days;
});

const goBack = () => {
    if (window.history.state?.back) router.back();
    else router.push('/');
};
</script>

<style scoped>
.Results{
    max-width: 640px;
    margin: 0 auto;
    padding-top: 8px;
    color: var(--bp-text-strong);
}

.rs-head{
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0 16px;
}
.rs-back{
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-left: -8px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--bp-text-strong);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    .pi{
        font-size: 16px;
    }
}
.rs-back:hover{
    background: var(--bp-fill);
}
.rs-title{
    margin: 0;
    color: var(--main-color);
    font-size: 32px;
    font-weight: 800;
    line-height: 1.15;
}

/* Spielerfilter */
.rs-search{
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    margin-bottom: 12px;
    padding: 0 6px 0 14px;
    border: 1px solid var(--bp-border-strong);
    border-radius: 12px;
    background: var(--bp-surface);
}
.rs-search:focus-within{
    border-color: var(--main-color);
}
.rs-search-icon{
    color: var(--bp-text-subtle);
    font-size: 14px;
}
.rs-search-input{
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--bp-text-strong);
    /* 16px: iOS zoomt beim Fokus sonst in die Seite */
    font-size: 16px;
}
.rs-search-input::placeholder{
    color: var(--bp-text-subtle);
}
/* Eigenes X statt des Browser-X */
.rs-search-input::-webkit-search-cancel-button{
    display: none;
}
.rs-search-clear{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--bp-text-subtle);
    cursor: pointer;

    .pi{
        font-size: 12px;
    }
}
.rs-search-clear:hover{
    background: var(--bp-fill-soft);
}

:deep(.rs-filter){
    padding: 0;
}

/* Tage */
.rs-day{
    margin-top: 18px;
}
.rs-day-head{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 8px;
}
.rs-day-title{
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.rs-day-count{
    font-size: 13px;
    color: var(--bp-text-muted);
}
.rs-clock{
    font-size: clamp(12px, 3.1vw, 13px);
    color: var(--p-text-muted-color);
}

.rs-empty{
    padding: 40px 0;
    text-align: center;
    color: var(--bp-text-muted);
}

.bp-skeleton-match:first-child{
    margin-top: 18px;
}
.bp-more-button{
    margin-top: 10px;
}

/* MOBILE */
@media (width <= 900px){
    .rs-title{
        font-size: 28px;
    }
}
</style>
