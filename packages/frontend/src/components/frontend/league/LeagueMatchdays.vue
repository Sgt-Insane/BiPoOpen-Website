<template>
    <!-- Unten Platz fuer den schwebenden Auslosen-Button -->
    <GameTimeline :entries="timeline" :getGameType="() => 'league'" class="pb-[88px]">
        <template #session="{ entry, expanded, setExpanded }">
            <LeagueMatchdayCard
                :matchday="entry"
                :expanded="expanded"
                :regularGames="regularGames"
                :leaguePlayers="leaguePlayers"
                :withdrawnPlayers="withdrawnPlayers"
                :getLogo="getLogo"
                :getDisplayName="getDisplayName"
                :highlightTopSlots="highlightTopSlots"
                :promotionSlots="promotionSlots"
                :relegationSlots="relegationSlots"
                @update:expanded="setExpanded"
            />
        </template>
    </GameTimeline>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GameTimeline from '@/components/shared/GameTimeline/GameTimeline.vue';
import LeagueMatchdayCard from './LeagueMatchdayCard.vue';
import { getLeagueTeamLogo } from './LeaguePlayersData';
import { getMatchdayTimeline, getRegularSeasonGames } from './LeagueMatchdays';

const props = withDefaults(defineProps<{
    leagueGames: Match[];               // neueste zuerst
    regularSeasonGameCount: number;
    leaguePlayers: LeaguePlayer[];
    withdrawnPlayers?: LeaguePlayer[];
    seasonSlug: string;
    highlightTopSlots?: number;
    promotionSlots?: number;
    relegationSlots?: number;
}>(), {
    withdrawnPlayers: () => [],
    highlightTopSlots: 0,
    promotionSlots: 0,
    relegationSlots: 0,
});

const timeline = computed(() => getMatchdayTimeline(props.leagueGames, props.regularSeasonGameCount));
const regularGames = computed(() => getRegularSeasonGames(props.leagueGames, props.regularSeasonGameCount));

// Teams stehen im Spiel nur als Name, Logo und Schreibweise kommen aus den Saisondaten.
const teamsByName = computed(() => new Map(
    [...props.leaguePlayers, ...props.withdrawnPlayers].map(player => [player.name.toLocaleLowerCase(), player])
));
const getLogo = (teamName: string) =>
    teamsByName.value.get(teamName.toLocaleLowerCase())?.logo ?? getLeagueTeamLogo(teamName, props.seasonSlug);
const getDisplayName = (teamName: string) =>
    teamsByName.value.get(teamName.toLocaleLowerCase())?.name ?? teamName;
</script>
