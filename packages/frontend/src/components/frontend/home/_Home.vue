<template>
    <div class="Home">
        <!-- Erst in der installierten App: auf dem iPhone ist Push erst ab hier moeglich -->
        <PushPromptCard
            v-if="isInstalled"
            title="Push aktivieren"
            text="Erfahre sofort von neuen Spielen."
            :to="PUSH_SETTINGS_PATH"
            dismissKey="bp-push-prompt-home"
        />

        <HomeHero
            :openGames="openGames"
            :leagueGames="leagueGames"
            :leagueCup="leagueCup"
            :lastTournament="lastTournament"
            :lastTournamentYear="LAST_TOURNAMENT_YEAR"
            :loading="isLoading"
        />

        <HomeRecentGames
            :openGames="openGames"
            :leagueGames="leagueGames"
            :loading="gamesLoading"
        />

        <HomePhotoMosaic />
    </div>
</template>

<script setup lang="ts">
import HomeHero from './HomeHero.vue';
import HomeRecentGames from './HomeRecentGames.vue';
import HomePhotoMosaic from './HomePhotoMosaic.vue';
import { useHomeData } from './useHomeData';
import { LAST_TOURNAMENT_YEAR } from './homeUtil';
import PushPromptCard from '@/components/shared/PushPromptCard.vue';
import { PUSH_SETTINGS_PATH } from '@/components/shared/usePushNotifications';
import { usePwaInstall } from '@/components/shared/usePwaInstall';

const { openGames, leagueGames, leagueCup, lastTournament, gamesLoading, isLoading } = useHomeData();
const { isInstalled } = usePwaInstall();
</script>

<style scoped>
.Home{
    display: flex;
    flex-direction: column;
    gap: 36px;
    max-width: 1100px;
    margin: 20px auto 0;
}

/* MOBILE */
@media (width <= 900px){
    .Home{
        gap: 28px;
        margin-top: 12px;
    }
}
</style>
