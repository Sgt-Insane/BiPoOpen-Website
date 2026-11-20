<template>
    <div class="Results">
        <PageHeader title="Ergebnisse"/>

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
            <!-- Zeitstrahl wie bei den Liga-Spieltagen: Abende mit vielen Spielen als Block, sonst Spiele je Tag -->
            <GameTimeline
                class="rs-timeline"
                :entries="visibleEntries"
                :getGameType="getGameType"
                showChip
                :formatSinglesCount="count => `${count} ${count === 1 ? 'Spiel' : 'Spiele'}`"
                :formatSinglesDay="day => formatResultDay(day.getTime())"
            >
                <template #session="{ entry, expanded, setExpanded }">
                    <GameSessionCard
                        :session="entry"
                        :expanded="expanded"
                        :title="WEEKDAYS_LONG[entry.day.getDay()]"
                        :meta="getSessionMeta(entry, 'Spieler')"
                        :highlights="getSessionHighlights(entry, 'Spieler')"
                        :getLogo="getLogo"
                        :getGameType="getGameType"
                        showChip
                        @update:expanded="setExpanded"
                    />
                </template>
            </GameTimeline>

            <button v-if="visibleEntries.length < timeline.length" type="button" class="bp-more-button" @click="visibleCount += PAGE_SIZE">
                Ältere Spiele laden
            </button>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import PageHeader from '@/components/shared/PageHeader.vue';
import GameTimeline from '@/components/shared/GameTimeline/GameTimeline.vue';
import GameSessionCard from '@/components/shared/GameTimeline/GameSessionCard.vue';
import { buildGameTimeline, getParticipantCount, getSessionHighlights, getSessionMeta } from '@/components/shared/GameTimeline/gameTimeline';
import { getPlayerForLeagueTeam, withLeagueTeamLogos } from '@/components/frontend/league/LeaguePlayersData';
import { useGrayPage } from '@/components/shared/useGrayPage';
import { onGameSaved } from '@/components/shared/GameEntry/useAddGame';
import { getAllOpenGames } from '@/components/frontend/openGames/OpenGamesUtilFunctions';
import { getAllLeagueGames } from '@/components/frontend/league/LeagueUtilFunctions';
import { getCachedGameData } from '@/util/gameDataCache';
import {
    GAME_FILTERS, combineResults, formatResultDay,
    isGameFilter, matchesFilter, matchesPlayer, type GameFilter, type GameType,
} from './resultsUtil';

// Eintraege im Zeitstrahl je Seite
const PAGE_SIZE = 10;

useGrayPage();

const route = useRoute();

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

// Spielart aus der Quelle (Liga-Altdaten haben keine season/league Felder)
const typeByMatch = computed(() => new Map(filteredGames.value.map(entry => [entry.match, entry.type])));
const getGameType = (match: Match): GameType | undefined => typeByMatch.value.get(match);

// Liga und Cup stehen unter dem Teamnamen im Spiel. In der Bilanz zaehlt die Person dahinter,
// Jonas Weck und "Hopfenstreife" sind ein Eintrag, das Team steht als Unterpunkt darunter.
const ALIAS_LABELS: Partial<Record<GameType, string>> = { league: 'Liga', cup: 'Cup' };
const resolveParticipant = (name: string, match: Match) => {
    const alias = ALIAS_LABELS[getGameType(match) ?? 'open'];
    const person = alias ? getPlayerForLeagueTeam(name) : null;
    return person && person !== name ? { person, alias } : { person: name };
};

// Block nur bei einem richtigen Spieleabend. Auswertung aller Spiele bis 11/2026: Abende mit 2 bis 4 Personen
// sind kleine Runden, auch mit 5 bis 7 Spielen (z.B. 13.11.2026: 5 Spiele, 2 Personen). Ab 5 Personen und
// mehr als 5 Spielen wird es ein Abend mit vielen Leuten.
const MIN_EVENING_GAMES = 6;
const MIN_EVENING_PEOPLE = 5;
const isPlayEvening = (games: Match[]) =>
    games.length >= MIN_EVENING_GAMES && getParticipantCount(games, resolveParticipant) >= MIN_EVENING_PEOPLE;

const timeline = computed(() => buildGameTimeline(filteredGames.value.map(entry => entry.match), { isSession: isPlayEvening, resolveParticipant }));

// Seitenweise nach Eintraegen im Zeitstrahl (Bloecke und Tage), nicht nach Spielen:
// ein grosser Abend hat schnell 25 Spiele und wuerde die erste Seite sonst allein fuellen
const visibleEntries = computed(() => timeline.value.slice(0, visibleCount.value));

// Liga-Teams mit ihrem Logo, Spieler zeigen ihr Profilbild. Teams, die wie ihr Spieler heissen
// (z.B. "Michael Weck"), haben kein eigenes Logo und zeigen ebenfalls das Profilbild.
const teamLogos = computed(() => {
    const logos = new Map<string, string>();
    filteredGames.value
        .filter(entry => entry.type !== 'open')
        .forEach((entry) => {
            const match = withLeagueTeamLogos(entry.match);
            [match.team1, match.team2].forEach((team) => {
                const name = team.players[0]?.name;
                if (team.logo && team.players.length === 1 && getPlayerForLeagueTeam(name) !== name) logos.set(name, team.logo);
            });
        });
    return logos;
});
const getLogo = (name: string) => teamLogos.value.get(name);

const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

</script>

<style scoped>
.Results{
    max-width: 640px;
    margin: 0 auto;
    padding-top: 8px;
    color: var(--bp-text-strong);
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

.rs-timeline{
    margin-top: 14px;
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
</style>
