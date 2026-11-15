<template>
    <!-- Kleines Info-Symbol neben einer Ueberschrift: Antippen zeigt die Erklaerung (gleiche Blase wie bei Fachbegriffen) -->
    <GlossaryWord :term="term" class="InfoButton"><i class="pi pi-info-circle" aria-hidden="true"></i></GlossaryWord>
</template>

<script setup lang="ts">
import GlossaryWord from './GlossaryWord.vue';
import type { GlossaryKey } from './glossary';

defineProps<{ term: GlossaryKey }>();
</script>

<style scoped>
.InfoButton{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* grosse Tippflaeche, kleines Symbol */
    min-width: 32px;
    min-height: 32px;
    margin: -6px 0;
    font-size: .55em;
    vertical-align: middle;
    opacity: .55;
    cursor: pointer;
}
.InfoButton:hover{
    opacity: .9;
}
</style>
