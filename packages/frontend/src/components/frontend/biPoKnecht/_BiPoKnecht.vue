<template>
    <div class="BiPoKnecht">
        <ModalEnterTeam v-if="modalEnterTeamVisible" :setMatch="setMatch"/>
        <BiPoKnecht v-if="match" :match="match"/>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BiPoKnecht from '@/components/frontend/biPoKnecht/BiPoKnecht.vue';
import ModalEnterTeam from './ModalEnterTeam.vue';

let modalEnterTeamVisible= ref(true);
let match = ref<Match>();

let setMatch = (newMatch: Match) => {
    match.value = newMatch;
    modalEnterTeamVisible.value = false;
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