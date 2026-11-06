<template>
    <HeroSlideLayout
        kicker="Nackte Meilen"
        :title="title"
        ctaLabel="Wer schuldet was?"
        ctaTo="/Nackte-Meilen"
    >
        <div class="sn-content">
            <div class="sn-progress-wrapper">
                <div class="sn-progress">
                    <div class="sn-progress-fill" :style="{ width: `${absolviert.length / total * 100}%` }"></div>
                </div>
                <div class="sn-progress-label">{{ absolviert.length }} von {{ total }} gelaufen</div>
            </div>

            <div class="sn-tiles">
                <button v-if="biggestDebt" type="button" class="sn-tile" @click="openPlayerProfile?.(biggestDebt.name)">
                    <span class="sn-tile-label">Größte Schuld</span>
                    <span class="sn-tile-name">{{ biggestDebt.name }}</span>
                    <span class="sn-tile-detail">{{ biggestDebt.count }} {{ biggestDebt.count === 1 ? 'Meile' : 'Meilen' }} offen</span>
                </button>
                <button v-if="lastRun" type="button" class="sn-tile" @click="openPlayerProfile?.(lastRun.name)">
                    <span class="sn-tile-label">Zuletzt gelaufen</span>
                    <span class="sn-tile-name">{{ lastRun.name }}</span>
                    <span class="sn-tile-detail">am {{ lastRun.completedAt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }}</span>
                </button>
            </div>
        </div>
    </HeroSlideLayout>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import type { AbsolvierteMeile, OffeneMeile } from '@/components/frontend/nackteMeilen/nackteMeilen';
import { formatPlayerName } from '../homeUtil';
import HeroSlideLayout from './HeroSlideLayout.vue';

const props = defineProps<{
    // Mindestens eine offene oder absolvierte Meile (siehe getNackteMeilen)
    offen: OffeneMeile[];
    absolviert: AbsolvierteMeile[];
}>();

const openPlayerProfile = inject<(name: string) => void>('openPlayerProfile');

const total = computed(() => props.offen.length + props.absolviert.length);

const title = computed(() => {
    const count = props.offen.length;
    if (count === 0) return 'Alle Meilen gelaufen';
    return `${count} ${count === 1 ? 'Meile' : 'Meilen'} noch offen`;
});

const biggestDebt = computed(() => {
    const counts = new Map<string, number>();
    props.offen.forEach((meile) => {
        const name = formatPlayerName(meile.name);
        counts.set(name, (counts.get(name) ?? 0) + 1);
    });

    const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return top ? { name: top[0], count: top[1] } : undefined;
});

// absolviert ist bereits nach Datum absteigend sortiert
const lastRun = computed(() => {
    const latest = props.absolviert[0];
    return latest ? { name: formatPlayerName(latest.name), completedAt: latest.completedAt } : undefined;
});
</script>

<style scoped>
.sn-content{
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 480px;
}
.sn-progress{
    height: 6px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    overflow: hidden;
}
.sn-progress-fill{
    height: 100%;
    background: var(--bp-surface);
    border-radius: 999px;
}
.sn-progress-label{
    margin-top: 6px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
}
.sn-tiles{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.sn-tile{
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    padding: 10px 12px;
    background: var(--hs-glass);
    border: 1px solid var(--hs-glass-border);
    border-radius: 12px;
    color: white;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
}
.sn-tile:hover{
    background: rgba(255, 255, 255, 0.22);
}
.sn-tile-label{
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.75);
}
.sn-tile-name,
.sn-tile-detail{
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.sn-tile-name{
    font-size: 15px;
    font-weight: 800;
}
.sn-tile-detail{
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
}
</style>
