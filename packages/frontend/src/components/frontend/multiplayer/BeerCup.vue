<template>
    <!-- Becher wie im Logo: dunkle Kontur, weisser Rand, Streifen.
         sway: Bier schwappt live mit der Bewegung. slosh: kippt kurz und Bier schwappt raus (direction 1 = nach rechts) -->
    <svg class="BeerCup" :class="{ 'BeerCup--slosh': slosh }" viewBox="0 0 200 240" aria-hidden="true">
        <defs>
            <clipPath :id="clipId"><path :d="BODY" /></clipPath>
        </defs>
        <g :transform="`rotate(${lean} 100 226)`">
        <!-- Bier, das der Handybewegung folgt -->
        <path v-if="crest" class="bc-wave" :d="crest" />
        <g :transform="direction === 1 ? 'translate(200 0) scale(-1 1)' : undefined">
        <g class="bc-tilt">
            <!-- Bier, das ueber den Rand schwappt -->
            <g class="bc-splash">
                <path class="bc-wave" d="M120,46 C112,22 88,14 70,22 C56,6 30,10 24,28 C10,30 4,46 10,60 C14,72 26,70 24,58 C22,50 30,46 40,46 Z" />
                <circle class="bc-drop bc-drop--1" cx="6" cy="24" r="8" />
                <circle class="bc-drop bc-drop--2" cx="-4" cy="58" r="6" />
                <circle class="bc-drop bc-drop--3" cx="34" cy="0" r="5.5" />
            </g>
            <path :d="BODY" :fill="fill" />
            <g :clip-path="`url(#${clipId})`">
                <rect x="0" y="58" width="200" height="30" :fill="shade" />
                <rect x="0" y="62" width="200" height="6" fill="#fff" />
                <rect x="0" y="82" width="200" height="8" fill="#fff" />
                <rect x="0" y="134" width="200" height="8" fill="#fff" />
            </g>
            <path :d="BODY" fill="none" stroke="#1E274A" stroke-width="8" stroke-linejoin="round" />
            <rect x="20" y="40" width="160" height="20" rx="10" fill="#fff" stroke="#1E274A" stroke-width="8" />
        </g>
        </g>
        </g>
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { TEAM_COLORS } from '../biPoKnecht/KnechtUtilFunctions';

const props = defineProps<{ color?: string; slosh?: boolean; sway?: number; direction?: 1 | -1 }>();

const BODY = 'M32,58 H168 L148,214 Q146,226 134,226 H66 Q54,226 52,214 Z';
const SHADES: Record<string, string> = { [TEAM_COLORS[0]]: '#D0364E', [TEAM_COLORS[1]]: '#4D9BB3' };
const clipId = `bc-${Math.random().toString(36).slice(2, 8)}`;
const fill = computed(() => props.color ?? TEAM_COLORS[0]);
// Welle ueber dem Rand: wandert zur Seite, auf die das Bier schwappt, und wird hoeher
const crest = computed(() => {
    const sway = props.sway ?? 0;
    const height = Math.min(34, Math.abs(sway) * 42);
    if (height < 3) return null;
    const peak = 100 + Math.max(-1, Math.min(1, sway)) * 58;
    const top = 50 - height;
    return `M24,52 C${peak - 34},52 ${peak - 26},${top} ${peak},${top} C${peak + 26},${top} ${peak + 34},52 176,52 Z`;
});
const lean = computed(() => Math.max(-1, Math.min(1, props.sway ?? 0)) * 5);
const shade = computed(() => SHADES[fill.value] ?? 'rgba(0, 0, 0, .15)');
</script>

<style scoped>
.BeerCup{
    display: block;
    overflow: visible;
}
.bc-tilt{
    transform-box: view-box;
    transform-origin: 100px 226px;
}
.bc-splash{ opacity: 0; }
.bc-wave, .bc-drop{
    fill: #FFCE44;
    stroke: #1E274A;
    stroke-width: 4;
    stroke-linejoin: round;
}
.BeerCup--slosh .bc-tilt{ animation: bc-tilt 1s ease-in-out; }
.BeerCup--slosh .bc-splash{ animation: bc-splash 1s ease-out; }
.BeerCup--slosh .bc-drop--1{ animation: bc-drop 1s ease-out; }
.BeerCup--slosh .bc-drop--2{ animation: bc-drop 1s ease-out .05s; }
.BeerCup--slosh .bc-drop--3{ animation: bc-drop 1s ease-out .1s; }
@keyframes bc-tilt{
    0%{ transform: rotate(0); }
    25%{ transform: rotate(-16deg); }
    50%{ transform: rotate(6deg); }
    70%{ transform: rotate(-3deg); }
    100%{ transform: rotate(0); }
}
@keyframes bc-splash{
    0%, 12%{ opacity: 0; transform: translateY(12px) scale(.6); }
    28%{ opacity: 1; transform: translate(-4px, 0) scale(1); }
    70%{ opacity: 1; }
    100%{ opacity: 0; transform: translate(-14px, 10px); }
}
@keyframes bc-drop{
    0%, 20%{ transform: translate(0, 0); }
    100%{ transform: translate(-22px, 26px); }
}
@media (prefers-reduced-motion: reduce){
    .BeerCup--slosh .bc-tilt, .BeerCup--slosh .bc-drop{ animation: none; }
    .BeerCup--slosh .bc-splash{ animation: none; opacity: 1; }
}
</style>
