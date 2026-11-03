<script setup lang="ts">
import { computed, ref } from "vue"
import Column from 'primevue/column';
import { getTournamentByName } from "@/util/tournamentFunctions";
import { getPlayersWithStats } from "@/util/tournamentPlayerFunctions";
import SkeletonList from '@/components/shared/SkeletonList.vue';
import DataTable from 'primevue/datatable';
import Avatar from '@/components/shared/Avatar.vue';
import { useTableLabels } from '@/components/shared/table';

const labels = useTableLabels();

let tournaments = ref<Tournament[]>([]);

// Initial load tournaments
let tournamentsToEvaluate = ["SCW 3 Batenhorst 2023","SCW 3 Ostern 2024", "SCW 3 Batenhorst 2024", "SCW 3 Karneval 2025"];
const getTournament = async () => {
    for (let i = 0; i < tournamentsToEvaluate.length; i++) {
        let tournament = await getTournamentByName(tournamentsToEvaluate[i]);
        if(tournament)
            tournaments.value.push(tournament);
    }   
}
getTournament();

const hallOfFameList = computed(() => {
    let players:PlayerWithStats[] = [];

    // Get players from all tournaments with stats. If the same player played in multiple tournaments, add the stats together
    tournaments.value.forEach((tournament) => {
        let playersWithStats = getPlayersWithStats(tournament);
        playersWithStats.forEach((player) => {
            let playerInList = players.find((playerTMP) => playerTMP.name == player.name);
            if(playerInList){
                playerInList.hits += player.hits;
                playerInList.ammountOfMatches += player.ammountOfMatches;
                playerInList.ammountOfMatchesWithTrackedShots += player.ammountOfMatchesWithTrackedShots;
                playerInList.ammountOfDrunkenCups += player.ammountOfDrunkenCups;
                playerInList.wins += player.wins;
            }else{
                players.push(player);
            }
        });
    });

    // Remove players with specific names
    let playersToRemove = ["David Jones", "Marian", "Jan"];
    players = players.filter((player) => !playersToRemove.includes(player.name));

    // Calculate correct average numbers
    players.forEach((player) => {
        // Calculate correct win
        let averageWins = player.wins / player.ammountOfMatches;
        player.averageWins = Math.round(averageWins * 100);

        // Calculate correct averageScore
        player.averageHits = player.hits / player.ammountOfMatchesWithTrackedShots;
        player.averageHits = Math.round(player.averageHits * 100) / 100; // Round average Hits
        if(!player.ammountOfMatchesWithTrackedShots)
            player.averageHits = 0;
    });

    // Sort players by wins and averageWins
    players.sort((player1, player2) => {
        if(player2.averageWins == player1.averageWins)
            return player2.wins - player1.wins;
        
        return player2.averageWins - player1.averageWins;
    });

    // Set placement
    for (let i = 0; i < players.length; i++) {
        players[i].placement = i;
        let playersWithSameScore = players.filter((player) => player.averageWins == players[i].averageWins && player.wins == players[i].wins)
        if(playersWithSameScore.length > 1){
            playersWithSameScore.forEach((playerWithSameScore) => {
                playerWithSameScore.placement = playersWithSameScore[0].placement;
            });
        }
    }

    return players;
});

let winners = [
    { year: "Karneval 2025", name: "", player1: "Vadim Laukert", player2: "Marcel Brüggehofe"},
    { year: "Batenhorst 2024", name: "Lederlappen", player1: "Nick Brinkrolf", player2: "Fitim Shehi"},
    { year: "Ostern 2024", name: "Holzbein Kiel", player1: "Leonard Südbrock", player2: "Jonas Weck"},
    { year: "Batenhorst 2023", name: "", player1: "Jens Ossenbrink", player2: "Simon Weck"},
]
let trophyIcon = new URL(`/src/assets/icons/trophy.png`, import.meta.url).href;
</script>

<template>
    <div class="HallofFame">
        
        <h1 class="bp-title">Hall of Fame</h1>

        <div>

            <div class="hof-winners">
                <div class="hof-winner" v-for="winner in winners">
                    <div class="hof-winner-icon">
                        <img :src="trophyIcon" alt="">
                        <div>{{ winner.year }}</div>
                    </div>
                    <div class="hof-team">
                        <div class="hof-team-name">{{ winner.name }}</div>
                        <div>{{ winner.player1 }}</div>
                        <div>{{ winner.player2 }}</div>
                    </div>
                </div>
            </div>


            <div class="hof-text">Statistiken alle Spieler aus allen Turnieren sortiert nach der Anzahl der Siegen</div>

            <SkeletonList v-if="tournaments.length != tournamentsToEvaluate.length" :rows="10" rank class="mb-[30px]"/>

            <DataTable v-else
                :value="hallOfFameList"
                scrollable
                sortField="averageWins"
                :sortOrder="-1"
                class="mb-[30px]"
            >
                <Column header="#" frozen class="bp-col-rank">
                    <template #body="{ data }">
                        <span class="bp-rank" :class="`bp-rank-${data.placement + 1}`">{{ data.placement + 1 }}</span>
                    </template>
                </Column>
                <Column field="name" header="Name" sortable frozen>
                    <template #body="slotProps">
                        <div class="bp-name-cell">
                            <Avatar :name="slotProps.data.name"/>
                            <span class="bp-name">{{ slotProps.data.name }}</span>
                        </div>
                    </template>
                </Column>
                <Column field="averageWins" sortable :header="labels.winRate" class="bp-col-strong">
                    <template #body="slotProps">
                        {{ slotProps.data.averageWins + " %" }}
                    </template>
                </Column>
                <Column field="wins" sortable :header="labels.wins"/>
                <Column field="ammountOfMatches" sortable :header="labels.games"/>
                <Column field="averageHits" sortable :header="labels.hitRate">
                    <template #body="slotProps">
                        {{ slotProps.data.hits ? slotProps.data.averageHits : "/" }}
                    </template>
                </Column>
            </DataTable>

        </div>

    </div>
</template>

<style scoped>
/* HoF Winners */
.hof-winners{
    display: flex;
    width: 100%;
    justify-content: center;
    align-items: center;
    flex-direction: column;
}
.hof-winner{
    position: relative;
    display: flex;
    align-items: center;
    margin: 0px 40px 30px 40px;
    width: 20%;
}
.hof-winner::after {
  content: '';
  position: absolute;
  bottom: -20px;
  width: 100%;
  border-bottom: 1px solid var(--main-color);
  opacity: 0.5;
}
.hof-winner:nth-child(even){
    flex-direction: row-reverse;
}
.hof-winner-icon{
    position: relative;
    margin-right: 20px;
}
.hof-winner-icon img{
    width: 110px;
}
.hof-winner-icon div{
    position: absolute;
    bottom: 9px;
    left: 20px;
    width: 70px;
    height: 30px;
    font-weight: bold;
    color: white;
    font-size: 11px;
    line-height: 11px;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
}
.hof-team{
    flex: 1;
    text-align: center;
}
.hof-team-name{
    font-weight: bold;
    font-size: 18px;
}


.hof-text{
    text-align: center;
    margin-top: 50px;
    margin-bottom: 50px;
    font-size: 18px;
    color: var(--main-color);
}


/*MOBILE*/
@media (width <= 900px){
    .hof-winner{
        width: 85%;
    }
    .hof-text{
        font-size: 16px;
        margin-bottom: 30px;
    }
}

</style>
