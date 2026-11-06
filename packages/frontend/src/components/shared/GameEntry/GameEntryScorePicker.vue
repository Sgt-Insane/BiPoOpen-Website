<template>
    <div class="GameEntryScorePicker" :class="{ 'gs-disabled': disabled }" :style="gridStyle" role="radiogroup" :aria-label="label">
        <button v-if="page > 0" type="button" class="gs-cell gs-nav" :disabled="disabled" aria-label="Weniger Treffer" @click="page--">
            <i class="pi pi-chevron-left"></i>
        </button>

        <button v-for="score in pageScores" :key="score"
            type="button"
            role="radio"
            class="gs-cell"
            :class="{ 'gs-selected': score === modelValue }"
            :style="{ '--gs-weight': weights[score] }"
            :aria-checked="score === modelValue"
            :disabled="disabled"
            @click="emit('update:modelValue', score)"
        >{{ score }}</button>

        <button v-if="hasNextPage" type="button" class="gs-cell gs-nav" :disabled="disabled" aria-label="Mehr Treffer" @click="page++">
            <i class="pi pi-plus"></i>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

// 11 Werte pro Seite + ein Pfeil, absteigend: 10-0 [+], [<] 21-11 ...
const PAGE_SIZE = 11;

// Breite (fr) je Feld: unwahrscheinlich MIN_SIZE, wahrscheinlichster Wert der Seite MAX_SIZE.
const MIN_SIZE = 0.75;
const MAX_SIZE = 1.5;
// Ohne chances alle gleich breit (Gewicht 1/3 = Breite 1)
const DEFAULT_WEIGHT = (1 - MIN_SIZE) / (MAX_SIZE - MIN_SIZE);

const props = withDefaults(defineProps<{
    modelValue: number | null;
    max?: number;
    chances?: number[];     // Wahrscheinlichkeit je Trefferwert (Index = Treffer), siehe getScoreChances
    disabled?: boolean;
    label?: string;
}>(), {
    max: 21,
    label: 'Treffer',
});

const emit = defineEmits<{ 'update:modelValue': [value: number] }>();

// Vorbelegte hohe Werte (Bearbeiten) direkt auf ihrer Seite oeffnen.
const page = ref(Math.floor((props.modelValue ?? 0) / PAGE_SIZE));

const pageScores = computed(() => {
    const start = page.value * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE - 1, props.max);
    return Array.from({ length: end - start + 1 }, (_, index) => end - index);
});

const hasNextPage = computed(() => (page.value + 1) * PAGE_SIZE <= props.max);

// 0-1 relativ zum wahrscheinlichsten Wert der aktuellen Seite.
const weights = computed(() => {
    const maxChance = Math.max(0, ...pageScores.value.map(score => props.chances?.[score] ?? 0));
    return Object.fromEntries(pageScores.value.map(score =>
        [score, maxChance > 0 ? (props.chances?.[score] ?? 0) / maxChance : DEFAULT_WEIGHT]
    ));
});

const gridStyle = computed(() => {
    const sizes = [
        ...(page.value > 0 ? [MIN_SIZE] : []),
        ...pageScores.value.map(score => MIN_SIZE + (MAX_SIZE - MIN_SIZE) * weights.value[score]),
        ...(hasNextPage.value ? [MIN_SIZE] : []),
    ];
    return { gridTemplateColumns: sizes.map(size => `minmax(0, ${size}fr)`).join(' ') };
});
</script>

<style scoped>
.GameEntryScorePicker{
    display: grid;
    gap: 4px;
    transition: grid-template-columns .25s ease;
}
.gs-cell{
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0;
    border: 1px solid var(--bp-border);
    border-radius: 8px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: calc(12px + 6px * var(--gs-weight, .33));
    font-weight: 600;
    cursor: pointer;
    transition: background .15s ease, color .15s ease, border-color .15s ease, font-size .25s ease;
}
.gs-cell:hover:not(:disabled){
    background: var(--bp-fill-soft);
}
.gs-cell:focus-visible{
    outline: 2px solid var(--main-color);
    outline-offset: 1px;
}
.gs-nav{
    background: var(--bp-fill-soft);
    color: var(--bp-text-secondary);
}
.gs-nav .pi{
    font-size: 11px;
}
.gs-selected,
.gs-selected:hover:not(:disabled){
    background: var(--bp-inverse-bg);
    border-color: var(--bp-inverse-bg);
    color: var(--bp-inverse-text);
}
.gs-disabled .gs-cell{
    color: var(--bp-text-faint);
    border-color: var(--bp-border);
    cursor: default;
}

/* MOBILE S */
@media (max-width: 360px){
    .GameEntryScorePicker{
        gap: 2px;
    }
    .gs-cell{
        font-size: calc(11px + 4px * var(--gs-weight, .33));
        border-radius: 6px;
    }
}
</style>
