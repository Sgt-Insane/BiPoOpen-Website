<template>
    <div class="WorldRanking">
        <!-- Skelett im Aufbau der Rangliste: Titel steht schon fest -->
        <div v-if="isLoading" aria-busy="true">
            <div class="wr-skeleton-header">
                <h1 class="bp-title">Weltrangliste</h1>
                <div class="wr-subtitle">Elo-Rating · alle offiziellen Spiele seit 2020</div>
            </div>
            <div class="wr-skeleton-chips">
                <div class="bp-skeleton wr-skeleton-chip"></div>
                <div class="bp-skeleton wr-skeleton-chip"></div>
            </div>
            <SkeletonList :rows="12" rank/>
        </div>
        <div v-else-if="hasError || !data" class="wr-error">Die Rangliste konnte nicht geladen werden.</div>
        <EloRanking v-else :data="data" :now="now"/>
    </div>
</template>

<script setup lang="ts">
import SkeletonList from '@/components/shared/SkeletonList.vue';
import EloRanking from './EloRanking.vue';
import { useWorldRankingData } from './useWorldRankingData';

const { now, data, isLoading, hasError } = useWorldRankingData();
</script>

<style scoped>
.WorldRanking {
    max-width: 720px;
    margin: 0 auto;
    color: var(--bp-text-strong);
}

.wr-skeleton-header {
    padding: 10px 0 14px;

    h1 {
        padding: 0;
    }
}
.wr-subtitle {
    margin-top: 4px;
    font-size: 13px;
    color: var(--bp-text-muted);
}
.wr-skeleton-chips {
    display: flex;
    gap: 8px;
    padding-bottom: 14px;
}
.wr-skeleton-chip {
    width: 84px;
    height: 34px;
    border-radius: 999px;
}

.wr-error {
    padding: 30px 14px;
    text-align: center;
    font-size: 14px;
    color: var(--bp-text-muted);
}
</style>
