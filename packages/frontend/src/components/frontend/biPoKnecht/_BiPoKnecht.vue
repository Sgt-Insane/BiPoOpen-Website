<template>
    <div class="BiPoKnecht">
        <ModalEnterTeam v-if="modalEnterTeamVisible" :setMatch="setMatch"/>
        <!-- key forces a fresh game state for every new match (e.g. a rematch) -->
        <BiPoKnecht v-if="match" :key="gameKey" :match="match" :onRematch="rematch"/>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BiPoKnecht from '@/components/frontend/biPoKnecht/BiPoKnecht.vue';
import ModalEnterTeam from './ModalEnterTeam.vue';

let modalEnterTeamVisible= ref(true);
let match = ref<Match>();
let gameKey = ref(0);
// Player names as entered, so a rematch starts from the original line-up
// (finalizeScores mutates the match, e.g. collapses 1v1 duplicate players).
let lineUp: { team1: string[]; team2: string[] } = { team1: [], team2: [] };

let setMatch = (newMatch: Match) => {
    lineUp = {
        team1: newMatch.team1.players.map(p => p.name),
        team2: newMatch.team2.players.map(p => p.name),
    };
    match.value = newMatch;
    modalEnterTeamVisible.value = false;
}

const toPlayers = (names: string[]): Player[] =>
    names.map(name => ({ _id: 'placeholder', name, score: 0 }));

// Same teams play again: fresh match, same players, back to "who starts?".
let rematch = () => {
    match.value = {
        _id: 'placeholder',
        team1: { _id: 'placeholder', players: toPlayers(lineUp.team1) },
        team2: { _id: 'placeholder', players: toPlayers(lineUp.team2) }
    };
    gameKey.value++;
}
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