<template>
    <div class="Manage">
        <h1 class="bp-title" style="padding-bottom: 50px; position: inherit;">Tournament Backend</h1>

        <div class="bp-button" @click="toggleModal()">Neues Turnier erstellen</div>
        
        <router-link class="ma-tournament" :to="'/Manage/Tournaments/' + tournament.name.replaceAll(' ','-')" v-for="tournament in tournaments" :key="tournament.name">{{ tournament.name }}</router-link>

        <Transition name="fade">
            <Modal v-if="showModal">        
                <template #title>Neues Turnier erstellen</template>
                <template #template>
                    <div>Turniername</div>
                    <input type="text" v-model="tournamentName">
                </template>
                <template #cancle>
                    <div @click="toggleModal()">Abbrechen</div>
                </template>
                <template #confirm>
                    <div @click="createTournament();">Erstellen</div>
                </template>
            </Modal>
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Modal from '@/components/shared/Modal.vue';
import { addTournament, getAllTournaments } from "@/util/tournamentFunctions";
import { useToast } from 'primevue/usetoast';
import { useRouter } from "vue-router";

const toast = useToast();
const router = useRouter();

let tournaments = ref<Tournament[]|undefined>();

const getTournaments = async () => {
    tournaments.value = await getAllTournaments();
    tournaments.value?.reverse();
}
getTournaments();

const createTournament = async () => {
    let tournament = {
        name: tournamentName.value,
        teams: [], // Initialize teams as an empty array
        groupPhase: {
            groups: [],
            matches: []
        },
        koPhase: {
            matches: []
        },
        settings: {
            trackPlayerShots: true,
            trackTeamShots: true,
            fixedGroupAmmount: 8,
            advancingTeamsPerGroup: 2,
        }
    };
    
    // @ts-ignore
    let success = await addTournament(tournament);
    if(success){
        await getTournaments();
        tournamentName = ref();
        toggleModal();
        setTimeout(() => toast.add({ severity: 'success', summary: 'Erfolg', detail: 'Turnier wurde erstellt', life: 3000 }), 400);
        router.push("/Manage/Tournaments/" + tournament.name.replaceAll(' ','-'));
    }
}

let showModal = ref(false);
const toggleModal = () => {
    showModal.value = !showModal.value;
}

let tournamentName = ref();
</script>

<style scoped>
.Manage{
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.ma-tournament{
    padding: 20px;
    background: var(--bp-surface);
    cursor: pointer;
    color: var(--bp-text-strong);
    text-align: center;
    margin-bottom: 50px;
    filter: drop-shadow(0px 0px 5px rgba(0, 0, 0, 0.3));
    text-decoration: none;
    width: 50%;
}
.ma-tournament:hover{
    background: var(--bp-fill-strong);
}
.bp-button{
    width: 50%;
}

/*MOBILE*/
@media (width <= 900px){
    .ma-tournament, .bp-button {
        width: 90%;
        margin-bottom: 25px;
    }
}
</style>
