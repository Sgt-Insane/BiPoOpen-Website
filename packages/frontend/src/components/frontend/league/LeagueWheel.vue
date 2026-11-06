<template>
    <div class="LeagueWheel" :class="{ 'lw-disabled': !canSpin }">
        <svg class="lw-rotor" viewBox="0 0 500 500" :style="rotorStyle" @click="spin()">
            <g v-for="segment in segments" :key="segment.entry.name">
                <circle v-if="segments.length === 1" :cx="CENTER" :cy="CENTER" :r="RADIUS" :fill="segment.fill" />
                <path v-else class="lw-segment" :d="segment.path" :fill="segment.fill" />

                <!-- Logo mittig im Segment, am Zeiger steht es dadurch aufrecht -->
                <image
                    :href="segment.entry.logo"
                    :x="CENTER + LOGO_DISTANCE - logoSize / 2"
                    :y="CENTER - logoSize / 2"
                    :width="logoSize"
                    :height="logoSize"
                    :transform="`rotate(${segment.midAngle} ${CENTER} ${CENTER})`"
                    preserveAspectRatio="xMidYMid meet"
                />
            </g>

            <!-- Gewinner-Segment: Umrandung liegt ueber den Nachbarsegmenten -->
            <path v-if="winnerSegment && segments.length > 1" class="lw-highlight" :d="winnerSegment.path" />
            <circle class="lw-rim" :cx="CENTER" :cy="CENTER" :r="RADIUS" />
        </svg>

        <div class="lw-hub" @click="spin()">
            <img :src="BipoLeagueLogo" alt="BiPo League" />
        </div>
        <div class="lw-pointer"></div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, PropType, ref, watch } from 'vue';
const BipoLeagueLogo = new URL(`/src/assets/league/BiPo-League-Logo.webp`, import.meta.url).href;

const props = defineProps({
    entries: { type: Array as PropType<LeaguePlayer[]>, required: true },
    disabled: { type: Boolean, default: false }
});

const emit = defineEmits<{
    (e: 'spin-start'): void;
    (e: 'spun', entry: LeaguePlayer): void;
}>();

// Masse im viewBox (500 x 500)
const CENTER = 250;
const RADIUS = 247;         // + halbe Randbreite = 250, das Rad fuellt die volle Breite
const HUB_RADIUS = 45;      // Mittelscheibe (18 % der Breite)
const LOGO_DISTANCE = (HUB_RADIUS + RADIUS) / 2;  // Logomitte: halbe Strecke zwischen Mittelscheibe und Rand
const MAX_LOGO_SIZE = 110;

const SPIN_DURATION = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1500 : 5000;

// Rot und Blau im Wechsel, bei ungerader Anzahl bekommt das letzte Segment ein helles Blau
const RED = '#EA5160';
const BLUE = '#2F9BD6';
const LIGHT_BLUE = '#7CC3E8';

const rotation = ref(0);
const isSpinning = ref(false);
const winnerName = ref<string | null>(null);
let spinTimeout: ReturnType<typeof setTimeout> | undefined;

const canSpin = computed(() => !props.disabled && !isSpinning.value && props.entries.length > 0);

const rotorStyle = computed(() => ({
    transform: `rotate(${rotation.value}deg)`,
    transition: `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
}));

const segmentAngle = computed(() => 360 / Math.max(props.entries.length, 1));

// Logo so gross, dass es noch in die Sehne des Segments passt
const logoSize = computed(() => {
    const halfAngleSin = props.entries.length > 1 ? Math.sin((segmentAngle.value / 2) * Math.PI / 180) : 1;
    return Math.min(MAX_LOGO_SIZE, 2 * LOGO_DISTANCE * halfAngleSin * 0.8);
});

const pointOnCircle = (angle: number) => {
    const radians = angle * Math.PI / 180;
    return `${CENTER + RADIUS * Math.cos(radians)} ${CENTER + RADIUS * Math.sin(radians)}`;
}

const getFill = (index: number, count: number) => {
    if (count > 1 && count % 2 === 1 && index === count - 1)
        return LIGHT_BLUE;
    return index % 2 === 0 ? RED : BLUE;
}

const segments = computed(() => {
    const angle = segmentAngle.value;
    const count = props.entries.length;

    return props.entries.map((entry, index) => {
        const startAngle = index * angle;
        const endAngle = startAngle + angle;
        const largeArc = angle > 180 ? 1 : 0;

        return {
            entry,
            fill: getFill(index, count),
            midAngle: startAngle + angle / 2,
            path: `M ${CENTER} ${CENTER} L ${pointOnCircle(startAngle)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${pointOnCircle(endAngle)} Z`
        };
    });
});

const winnerSegment = computed(() => segments.value.find(segment => segment.entry.name === winnerName.value));

// Neue Eintraege (naechste Phase) -> Hervorhebung zuruecksetzen
watch(() => props.entries.map(entry => entry.name).join('|'), () => {
    winnerName.value = null;
});

const spin = () => {
    if (!canSpin.value) return;

    const entries = props.entries;
    const winnerIndex = Math.floor(Math.random() * entries.length);
    const winner = entries[winnerIndex];

    // Zufaelliger Punkt im Gewinnersegment soll am Ende unter dem Zeiger (rechts, 0 Grad) stehen
    const targetAngle = (winnerIndex + 0.1 + Math.random() * 0.8) * segmentAngle.value;
    const currentAngle = ((rotation.value % 360) + 360) % 360;
    const offset = (((360 - targetAngle - currentAngle) % 360) + 360) % 360;
    const fullTurns = 5 + Math.floor(Math.random() * 3);

    winnerName.value = null;
    isSpinning.value = true;
    emit('spin-start');
    rotation.value += fullTurns * 360 + offset;

    spinTimeout = setTimeout(() => {
        isSpinning.value = false;
        winnerName.value = winner.name;
        emit('spun', winner);
    }, SPIN_DURATION);
}

defineExpose({ spin });

onBeforeUnmount(() => clearTimeout(spinTimeout));
</script>

<style scoped>
.LeagueWheel{
    --lw-navy: #1C2541;
    position: relative;
    width: 100%;
    aspect-ratio: 1;
}

.lw-rotor{
    display: block;
    overflow: visible;      /* Gewinner-Umrandung darf ueber den Rand ragen */
    width: 100%;
    height: 100%;
    cursor: pointer;
    will-change: transform;
}
.lw-disabled .lw-rotor,
.lw-disabled .lw-hub{
    cursor: default;
}

.lw-segment{
    stroke: white;
    stroke-width: 3;
}
.lw-rotor image{
    pointer-events: none;
}
.lw-highlight{
    fill: none;
    stroke: var(--lw-navy);
    stroke-width: 7;
    stroke-linejoin: round;
}
.lw-rim{
    fill: none;
    stroke: var(--lw-navy);
    stroke-width: 6;
}

.lw-hub{
    position: absolute;
    top: 50%;
    left: 50%;
    width: 18%;
    height: 18%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: var(--bp-surface);
    border: 3px solid var(--lw-navy);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}
.lw-hub img{
    width: 78%;
    height: 78%;
    object-fit: contain;
}

/* Zeiger rechts, Spitze ragt ins Segment. Groesse in %, damit sie mit dem Rad skaliert. */
.lw-pointer{
    position: absolute;
    top: 50%;
    right: -2.5%;           /* ragt leicht ueber den Rand hinaus */
    transform: translateY(-50%);
    width: 8%;
    height: 7%;
    background: var(--lw-navy);
    clip-path: polygon(0 50%, 100% 0, 100% 100%);
}
</style>
