<template>
    <!-- Text wie "Treffer · Balls Back": jedes erklaerungswuerdige Teil wird antippbar -->
    <span class="GlossaryText"><template v-for="(part, index) in parts" :key="index"><template v-if="index"> · </template><GlossaryWord :text="part" /></template></span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import GlossaryWord from './GlossaryWord.vue';

const props = defineProps<{ text: string }>();
const parts = computed(() => props.text.split(' · '));
</script>
