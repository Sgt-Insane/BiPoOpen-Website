<template>
    <HeroSlideLayout
        :kicker="`BiPo Open ${NEXT_BIPO_OPEN.year}`"
        title="Countdown läuft"
        :subtitle="`${startDate} · 14:00 Uhr`"
        :ctaLabel="`Rückblick ${lastYear}`"
        :ctaTo="`/${lastYear}`"
    >
        <div class="sc-timer">
            <div v-for="unit in countdown" :key="unit.label" class="sc-unit">
                <span class="sc-value">{{ unit.value }}</span>
                <span class="sc-label">{{ unit.label }}</span>
            </div>
        </div>
    </HeroSlideLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { BIPO_OPEN_TOURNAMENT_YEARS, NEXT_BIPO_OPEN } from '@/util/bipoOpenTournamentMeta';

// Bis zum naechsten Turnier: das letzte Turnier mit Teams, Spielplan und Fotos ansehen
const lastYear = BIPO_OPEN_TOURNAMENT_YEARS[BIPO_OPEN_TOURNAMENT_YEARS.length - 1];
import { NEXT_BIPO_OPEN_START } from '../homeUtil';
import HeroSlideLayout from './HeroSlideLayout.vue';

const startDate = new Date(NEXT_BIPO_OPEN_START).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

const now = ref(Date.now());
const timer = setInterval(() => now.value = Date.now(), 1000);
onBeforeUnmount(() => clearInterval(timer));

const countdown = computed(() => {
    const diff = Math.max(0, NEXT_BIPO_OPEN_START - now.value);
    return [
        { value: Math.floor(diff / 86400000), label: 'Tage' },
        { value: Math.floor((diff % 86400000) / 3600000), label: 'Std' },
        { value: Math.floor((diff % 3600000) / 60000), label: 'Min' },
        { value: Math.floor((diff % 60000) / 1000), label: 'Sek' },
    ];
});
</script>

<style scoped>
.sc-timer{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    max-width: 360px;
}
.sc-unit{
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 4px 8px;
    background: var(--hs-glass);
    border: 1px solid var(--hs-glass-border);
    border-radius: 12px;
}
.sc-value{
    font-size: 24px;
    font-weight: 800;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}
.sc-label{
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.8);
}
</style>
