<template>
    <div class="BiPoKnecht">
        <ModalEnterTeam v-if="modalEnterTeamVisible" :setMatch="setMatch"/>
        <!-- key forces a fresh game state for every new match (e.g. a rematch) -->
        <BiPoKnecht v-if="match" :key="gameKey" :match="match" :isLeagueGame="isLeagueGame" :onRematch="rematch"/>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BiPoKnecht from '@/components/frontend/biPoKnecht/BiPoKnecht.vue';
import ModalEnterTeam from './ModalEnterTeam.vue';

let modalEnterTeamVisible = ref(true);
let match = ref<Match>();
let isLeagueGame = ref(false);
let gameKey = ref(0);

// Player names and team metadata as entered, so a rematch starts from the original line-up
let lineUp: { team1: string[]; team2: string[]; team1Name?: string; team2Name?: string } = { team1: [], team2: [] };

let setMatch = (newMatch: Match, isLeague: boolean = false) => {
    isLeagueGame.value = isLeague;
    lineUp = {
        team1: newMatch.team1.players.map(p => p.name),
        team2: newMatch.team2.players.map(p => p.name),
        team1Name: newMatch.team1.name,
        team2Name: newMatch.team2.name,
    };
    match.value = newMatch;
    modalEnterTeamVisible.value = false;
};

const toPlayers = (names: string[]): Player[] =>
    names.map(name => ({ _id: 'placeholder', name, score: 0 }));

// Same teams play again: fresh match, same players, back to "who starts?".
let rematch = () => {
    const freshTeam1Players = toPlayers(lineUp.team1);
    const freshTeam2Players = toPlayers(lineUp.team2);
    if (freshTeam1Players.length === 1) freshTeam1Players.push({ ...freshTeam1Players[0] });
    if (freshTeam2Players.length === 1) freshTeam2Players.push({ ...freshTeam2Players[0] });

    match.value = {
        _id: 'placeholder',
        team1: { _id: 'placeholder', name: lineUp.team1Name, players: freshTeam1Players },
        team2: { _id: 'placeholder', name: lineUp.team2Name, players: freshTeam2Players },
        season: match.value?.season,
        league: match.value?.league,
    };
    gameKey.value++;
};
</script>

<style scoped>
.BiPoKnecht{
    position: absolute;
    width: 100dvw;
    height: 100dvh;
    top: 0%;
    left: 0%;
    z-index: 1000;
    background-color: var(--bp-surface);
}
</style>
