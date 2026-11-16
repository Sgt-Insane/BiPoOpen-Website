<template>
    <!-- Einstieg in den BiPo Knecht direkt von der Startseite (Nutzertest: sonst nur ueber "Eintragen" zu finden) -->
    <button type="button" class="HomeKnechtCard" @click="openAddGame()">
        <span class="hk-icon" aria-hidden="true">🎯</span>
        <span class="hk-text">
            <span class="hk-title">Mit BiPo Knecht spielen</span>
            <span class="hk-sub">Spieler wählen, jeden Wurf live zählen</span>
        </span>
        <i class="pi pi-chevron-right hk-arrow" aria-hidden="true"></i>
    </button>
</template>

<script setup lang="ts">
import { useAddGame } from '@/components/shared/GameEntry/useAddGame';

const { openAddGame } = useAddGame();
</script>

<style scoped>
.HomeKnechtCard{
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    margin: 12px 0;
    padding: 12px 14px;
    border: 1px solid var(--bp-border);
    border-radius: 14px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.hk-icon{
    font-size: 22px;
    line-height: 1;
}
.hk-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}
.hk-title{
    font-size: 15px;
    font-weight: 700;
}
.hk-sub{
    font-size: 12px;
    color: var(--bp-text-faint);
}
.hk-arrow{
    font-size: 13px;
    color: var(--bp-text-faint);
}
</style>
