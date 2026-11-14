<template>
    <!-- Schulden auf einen Blick: Nackte Meilen und offene Shots, im Stil der Nackte-Meilen-Seite -->
    <section class="HomeDebts" aria-label="Offene Schulden">
        <router-link to="/Nackte-Meilen" class="hd-card">
            <span class="hd-icon" aria-hidden="true">🍑</span>
            <span class="hd-text">
                <span class="hd-title">Nackte Meilen</span>
                <span class="hd-meta">{{ loading ? '…' : `${milesOpen} offen` }}</span>
            </span>
            <i class="pi pi-angle-right hd-arrow"></i>
        </router-link>
        <router-link to="/Offene-Shots" class="hd-card">
            <span class="hd-icon" aria-hidden="true">🥃</span>
            <span class="hd-text">
                <span class="hd-title">Offene Shots</span>
                <span class="hd-meta">{{ shotsOpen === null ? '…' : `${shotsOpen} offen` }}</span>
            </span>
            <i class="pi pi-angle-right hd-arrow"></i>
        </router-link>
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getNackteMeilen } from '@/components/frontend/nackteMeilen/nackteMeilen';
import { getShots } from '@/components/frontend/shots/shots';

const props = defineProps<{ openGames: Match[]; leagueGames: Match[]; loading: boolean }>();

const milesOpen = computed(() => getNackteMeilen([...props.openGames, ...props.leagueGames]).offen.length);

const shotsOpen = ref<number | null>(null);
getShots()
    .then(shots => { shotsOpen.value = shots.filter(shot => !shot.drunkAt).length; })
    .catch(() => { shotsOpen.value = 0; });
</script>

<style scoped>
.HomeDebts{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}
.hd-card{
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 12px 10px 12px 12px;
    border-radius: 16px;
    background: #0C1E47;
    color: white;
    text-decoration: none;
    box-shadow: 0 1px 2px rgba(16, 24, 40, .06);
    transition: transform .12s ease;
}
.hd-card:active{
    transform: scale(.98);
}
.hd-icon{
    font-size: 24px;
    line-height: 1;
}
.hd-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}
.hd-title{
    font-size: 15px;
    font-weight: 800;
    line-height: 1.15;
}
.hd-meta{
    font-size: 13px;
    color: #C9D2E6;
}
.hd-arrow{
    color: #C9D2E6;
}
</style>
