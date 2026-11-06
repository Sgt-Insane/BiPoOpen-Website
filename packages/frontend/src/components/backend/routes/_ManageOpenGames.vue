<template>
    <div class="HallofFame">
        
        <h1 class="bp-title">Open Games Backend</h1>

        <div v-if="!openGames" aria-busy="true">
            <div v-for="i in 6" :key="i" class="bp-skeleton bp-skeleton-match"></div>
        </div>

        <div v-if="openGames">
            <div v-for="openGame in openGames" :key="openGame._id">
                <MatchElement :match="openGame" :isBackend="true" @edit="openEdit" showDate/> <!-- TODO-Minor: Only Display some Games not all. Adjust Database download to only get the latest games -->
            </div>
        </div>

        <GameEntryDrawer
            v-model:visible="editVisible"
            title="Spiel bearbeiten"
            :subtitle="editingMatch?.time ? getGameTime(editingMatch.time) : 'Offenes Spiel'"
            :initialSides="editSides"
            allowExtraPlayers
            :save="setGameResult"
            :remove="deleteMatch"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import GameEntryDrawer from '@/components/shared/GameEntry/GameEntryDrawer.vue';
import { applySidesToMatch, useMatchEdit, type GameEntrySide } from '@/components/shared/GameEntry/gameEntry';
import { getAllOpenGames, updateOpenGame, deleteOpenGame } from "@/components/frontend/openGames/OpenGamesUtilFunctions";

let openGames = ref<Match[]|undefined>();
const { editingMatch, editVisible, editSides, openEdit } = useMatchEdit();

const getOpenGames = async () => {
    let openGamesWrongOrder = await getAllOpenGames();
    openGames.value = openGamesWrongOrder!.reverse();
}
getOpenGames();


const setGameResult = async (sides: GameEntrySide[]) => {
    let success = await updateOpenGame(applySidesToMatch(editingMatch.value!, sides));
    await getOpenGames();
    return success;
}

const deleteMatch = async () => {
    let success = await deleteOpenGame(editingMatch.value!);
    await getOpenGames();
    return success;
}

let getGameTime = (dateNumber:number) => {
    let date = new Date(dateNumber);
    let time = date.getHours() + ":" + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
    return date.toLocaleDateString("de-DE") + "  -  " + time + " Uhr";
}
</script>

<style scoped>
.bp-title{
    padding-bottom: 10px;   
}
.bp-button{
    position: sticky;
    top: 155px;
    z-index: 4;
}
.nav-tabs{
    position: sticky;
    top: 218px;
    padding-top: 20px;
    background: var(--bp-surface);
    z-index: 2;
}
.nav-link{
    border-radius: 0px;
    width: 40vw;
    padding: 15px 10px;
    color: var(--secondary-color);
    font-weight: bold;
}
.nav-item{
    flex: 1;
}
.nav-item .active{
    background-color: var(--main-color) !important;
    color: white !important;
}
.nav-item button{
    width: 100%;
}
/* MOBILE */
@media (width <= 900px){
    .bp-button{
        top: 130px;
        padding: 15px 20px;
        margin-bottom: 30px;
    }
   .nav-tabs{
        top: 180px;
    }   
   .nav-link{
        font-size: 14px;
        padding: 10px 10px;
    }
}
</style>