<template>
    <!-- Erklaerungswuerdiges Wort: gepunktet unterstrichen, Antippen zeigt die Erklaerung direkt daran -->
    <span v-if="key" ref="word" class="GlossaryWord" role="button" tabindex="0" :aria-label="`${GLOSSARY[key].term}: Erklärung anzeigen`"
        @click.stop.prevent="show" @keydown.enter.prevent="show"><slot>{{ text }}</slot></span>
    <span v-else><slot>{{ text }}</slot></span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { GLOSSARY, findGlossaryKey, type GlossaryKey } from './glossary';
import { useGlossary } from './useGlossary';

const props = defineProps<{ term?: GlossaryKey; text?: string }>();

// Begriff explizit (term) oder aus dem Text erkannt
const key = computed(() => props.term ?? (props.text ? findGlossaryKey(props.text) : null));
const word = ref<HTMLElement | null>(null);
const { open } = useGlossary();

const show = () => {
    if (key.value && word.value) open(key.value, word.value);
};
</script>

<style scoped>
.GlossaryWord{
    text-decoration: underline dotted;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 3px;
    text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
    cursor: help;
    -webkit-tap-highlight-color: transparent;
}
.GlossaryWord:hover{
    text-decoration-color: currentColor;
}
</style>
