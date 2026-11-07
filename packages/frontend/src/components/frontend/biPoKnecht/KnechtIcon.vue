<template>
    <svg class="KnechtIcon" viewBox="0 0 24 24" aria-hidden="true">
        <template v-for="(shape, index) in shapes" :key="index">
            <circle v-if="'r' in shape" :cx="shape.cx" :cy="shape.cy" :r="shape.r" :class="{ 'kn-icon-fill': shape.fill }" />
            <path v-else :d="shape.d" :class="{ 'kn-icon-fill': shape.fill, 'kn-icon-dashed': shape.dashed }" />
        </template>
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { KNECHT_ICONS, type KnechtIconName, type KnechtIconShape } from './knechtIcons';

const props = defineProps<{ name: KnechtIconName }>();

const shapes = computed<KnechtIconShape[]>(() => KNECHT_ICONS[props.name]);
</script>

<style scoped>
.KnechtIcon{
    width: 1.25em;
    height: 1.25em;
    flex: 0 0 auto;
    vertical-align: -.25em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.kn-icon-fill{
    fill: currentColor;
    stroke: none;
}
.kn-icon-dashed{
    stroke-dasharray: 2.2 2.6;
}
</style>
