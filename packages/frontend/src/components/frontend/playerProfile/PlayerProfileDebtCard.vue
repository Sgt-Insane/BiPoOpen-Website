<template>
    <!-- Schuldenkonto: offene Nackte Meilen und Shots dieser Person, ganz oben im Profil -->
    <section v-if="hasAny" class="pp-section">
        <div class="pp-section-head">
            <h2 class="pp-section-title">Schuldenkonto</h2>
            <span class="pp-section-aside">{{ openTotal ? `${openTotal} offen` : 'alles beglichen ✓' }}</span>
        </div>

        <div class="pp-card pp-debt">
            <router-link to="/Nackte-Meilen" class="pp-debt-tile" :class="{ 'pp-debt-tile--open': miles.open }">
                <span class="pp-debt-icon" aria-hidden="true">🍑</span>
                <span class="pp-debt-text">
                    <b>{{ miles.open }}</b>
                    <span>{{ miles.open === 1 ? 'Meile offen' : 'Meilen offen' }}</span>
                    <small>{{ miles.done }} gelaufen</small>
                </span>
            </router-link>
            <router-link to="/Offene-Shots" class="pp-debt-tile" :class="{ 'pp-debt-tile--open': shots.open }">
                <span class="pp-debt-icon" aria-hidden="true">🥃</span>
                <span class="pp-debt-text">
                    <b>{{ shots.open }}</b>
                    <span>{{ shots.open === 1 ? 'Shot offen' : 'Shots offen' }}</span>
                    <small>{{ shots.done }} getrunken</small>
                </span>
            </router-link>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { getGameData, getCachedGameData, type GameData } from '@/util/gameDataCache';
import { getNackteMeilen } from '@/components/frontend/nackteMeilen/nackteMeilen';
import { getShots, type Shot } from '@/components/frontend/shots/shots';

const props = defineProps<{ playerName: string }>();

const gameData = shallowRef<GameData | null>(getCachedGameData());
const allShots = ref<Shot[]>([]);

watch(() => props.playerName, () => {
    getGameData().then(data => { gameData.value = data; }).catch(() => {});
    getShots().then(list => { allShots.value = list; }).catch(() => { allShots.value = []; });
}, { immediate: true });

const isMe = (name: string) => name.trim().toLowerCase() === props.playerName.trim().toLowerCase();

const miles = computed(() => {
    const data = gameData.value;
    if (!data) return { open: 0, done: 0 };
    const { offen, absolviert } = getNackteMeilen([...data.openGames, ...data.leagueGames]);
    return { open: offen.filter(mile => isMe(mile.name)).length, done: absolviert.filter(mile => isMe(mile.name)).length };
});

const shots = computed(() => {
    const mine = allShots.value.filter(shot => isMe(shot.name));
    return { open: mine.filter(shot => !shot.drunkAt).length, done: mine.filter(shot => shot.drunkAt).length };
});

const openTotal = computed(() => miles.value.open + shots.value.open);
const hasAny = computed(() => openTotal.value + miles.value.done + shots.value.done > 0);
</script>

<style scoped>
.pp-debt{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 8px;
}
.pp-debt-tile{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--bp-fill-soft);
    color: inherit;
    text-decoration: none;
}
.pp-debt-tile--open{
    background: var(--bp-navy, #0C1E47);
    color: white;
}
.pp-debt-icon{
    font-size: 24px;
    line-height: 1;
}
.pp-debt-text{
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.2;
}
.pp-debt-text b{
    font-size: 22px;
    font-weight: 800;
}
.pp-debt-text span{
    font-size: 13px;
    font-weight: 600;
}
.pp-debt-text small{
    font-size: 11px;
    opacity: .7;
}
</style>
