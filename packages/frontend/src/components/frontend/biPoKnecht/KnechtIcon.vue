<template>
    <svg class="KnechtIcon" viewBox="0 0 24 24" aria-hidden="true">
        <template v-for="(shape, index) in shapes" :key="index">
            <circle v-if="'r' in shape" :cx="shape.cx" :cy="shape.cy" :r="shape.r" :class="classes(shape)" />
            <path v-else :d="shape.d" :class="classes(shape)" />
        </template>
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { KNECHT_ICONS, type KnechtIconName, type KnechtIconShape } from './knechtIcons';

const props = defineProps<{ name: KnechtIconName }>();

const shapes = computed<KnechtIconShape[]>(() => KNECHT_ICONS[props.name]);

const classes = (shape: KnechtIconShape) => ({
    'kn-icon-fill': shape.fill,
    'kn-icon-soft': shape.soft,
    'kn-icon-ball': 'ball' in shape && shape.ball,
    'kn-icon-dashed': 'dashed' in shape && shape.dashed,
});
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
/* Zweifarbig: Kontur plus helle Flaeche in derselben Farbe (passt auf hellem wie auf farbigem Grund) */
.kn-icon-soft{
    fill: color-mix(in srgb, currentColor 14%, transparent);
}
/* Ball immer weiss mit Kontur */
.kn-icon-ball{
    fill: #FFFFFF;
}
.kn-icon-dashed{
    stroke-dasharray: 2.2 2.6;
}
</style>
