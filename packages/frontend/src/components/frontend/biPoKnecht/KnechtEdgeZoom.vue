<template>
    <div class="KnechtEdgeZoom" @pointerdown="$emit('activity')">
        <div class="kn-zoom-header">
            <span class="kn-zoom-title">{{ formatEdge(edge) }}</span>
            <span class="kn-zoom-hint">{{ contacts.length ? 'Zweiter Tipp = Doppelkante' : 'Tippe genau, wo der Ball die Kante traf' }}</span>
        </div>

        <!-- Nahansicht aus Sicht des Werfers: Spitze unten, der Werfer steht unter dem Bild -->
        <svg class="kn-zoom-svg" :viewBox="viewBox" @click="onTap">
            <g v-for="cup in visibleCups" :key="cup.index">
                <circle :cx="cup.x" :cy="cup.y" :r="RADIUS * EDGE_REACH" class="kn-zoom-reach" />
                <circle :cx="cup.x" :cy="cup.y" :r="RADIUS" class="kn-zoom-cup" :class="{ 'kn-zoom-cup--gone': !cup.standing, 'kn-zoom-cup--active': cup.index === edge.cup }" />
                <text :x="cup.x" :y="cup.y" class="kn-zoom-number">{{ cup.index + 1 }}</text>
            </g>
            <circle v-for="(contact, index) in contactPoints" :key="index" :cx="contact.x" :cy="contact.y" :r="RADIUS * BALL_TO_CUP" class="kn-zoom-ball" />
        </svg>

        <div class="kn-zoom-footer">
            <span class="kn-zoom-thrower">↓ Werfer</span>
            <button type="button" class="kn-zoom-button" @click="reset">Zurücksetzen</button>
            <button type="button" class="kn-zoom-button kn-zoom-button--primary" @click="$emit('close')">Fertig</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { EDGE_REACH, formatEdge, getEdgeSide } from './knechtEdges';

// Knecht Pro: Nahansicht des Bechers, an dessen Kante der Ball war. Ein Tipp auf den Rand legt die genaue
// Stelle fest, ein zweiter Tipp macht daraus eine Doppelkante. Andere Becher in der Naehe lassen sich auch antippen.
const props = defineProps<{ edge: EdgeHit; standing: number[] }>();
const emit = defineEmits<{ update: [edge: EdgeHit]; close: []; activity: [] }>();

const RADIUS = 1;
const BALL_TO_CUP = 0.42;
const STEP = 2.3;                       // Abstand der Bechermitten in Becherradien
const ROWS = [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]];   // hinten (oben) nach vorne (unten)

const positions = ROWS.flatMap((row, rowIndex) => row.map((index, position) => ({
    index,
    x: (position - (row.length - 1) / 2) * STEP,
    y: rowIndex * STEP * .87,
})));
const positionOf = (index: number) => positions.find(position => position.index === index)!;

// Der Becher mit der Kante in der Mitte, Nachbarn drumherum
const center = computed(() => positionOf(props.edge.cup));
const visibleCups = computed(() => positions
    .filter(position => Math.hypot(position.x - center.value.x, position.y - center.value.y) <= STEP * 1.05)
    .map(position => ({ ...position, standing: props.standing.includes(position.index) })));
const viewBox = computed(() => {
    const size = STEP * 1.4 + RADIUS * 2;
    return `${center.value.x - size / 2} ${center.value.y - size / 2} ${size} ${size}`;
});

// Winkel: 0 = vorne (zum Werfer, im Bild unten), positiv = rechts
const toPoint = (cup: number, angle: number) => {
    const { x, y } = positionOf(cup);
    const radians = angle * Math.PI / 180;
    const distance = RADIUS + RADIUS * BALL_TO_CUP * .6;
    return { x: x + Math.sin(radians) * distance, y: y + Math.cos(radians) * distance };
};

const contacts = computed(() => [
    ...(props.edge.angle !== undefined ? [{ cup: props.edge.cup, angle: props.edge.angle }] : []),
    ...(props.edge.second ? [props.edge.second] : []),
]);
const contactPoints = computed(() => contacts.value.map(contact => toPoint(contact.cup, contact.angle)));

const onTap = (event: MouseEvent) => {
    const svg = event.currentTarget as SVGSVGElement;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    // Naechster stehender Becher im Kantenbereich
    const target = visibleCups.value
        .filter(cup => cup.standing)
        .map(cup => ({ cup, distance: Math.hypot(point.x - cup.x, point.y - cup.y) }))
        .filter(entry => entry.distance <= RADIUS * EDGE_REACH)
        .sort((a, b) => a.distance - b.distance)[0];
    if (!target) return;
    const angle = Math.round(Math.atan2(point.x - target.cup.x, point.y - target.cup.y) * 180 / Math.PI);
    const contact = { cup: target.cup.index, angle };

    // Erster Tipp: genaue Stelle (und ggf. anderer Becher). Zweiter Tipp: Doppelkante.
    if (props.edge.angle === undefined || props.edge.second)
        emit('update', { cup: contact.cup, side: getEdgeSide(angle), angle });
    else
        emit('update', { ...props.edge, double: true, second: contact });
};

const reset = () => emit('update', { cup: props.edge.cup, side: props.edge.side });
</script>

<style scoped>
.KnechtEdgeZoom{
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: min(320px, calc(100% - 24px));
    padding: 12px;
    border-radius: 18px;
    background: var(--bp-surface);
    box-shadow: 0 14px 34px rgba(0, 0, 0, .3);
}
.kn-zoom-header{
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}
.kn-zoom-title{
    font-size: 15px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.kn-zoom-hint{
    font-size: 12px;
    color: var(--bp-text-muted);
}
.kn-zoom-svg{
    width: 100%;
    max-height: 58vh;
    aspect-ratio: 1;
    touch-action: manipulation;
    cursor: crosshair;
}
.kn-zoom-reach{
    fill: transparent;
}
.kn-zoom-cup{
    fill: color-mix(in srgb, #2EA3C7 16%, var(--bp-surface));
    stroke: #2EA3C7;
    stroke-width: .2;
}
.kn-zoom-cup--active{
    stroke-width: .3;
    filter: drop-shadow(0 0 .15px #2EA3C7);
}
.kn-zoom-cup--gone{
    fill: transparent;
    stroke: var(--bp-border-strong, #C9CDD2);
    stroke-width: .06;
    stroke-dasharray: .2 .2;
}
.kn-zoom-number{
    font-size: .7px;
    font-weight: 800;
    fill: #2EA3C7;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
}
.kn-zoom-cup--gone + .kn-zoom-number{
    fill: var(--bp-text-subtle);
}
.kn-zoom-ball{
    fill: white;
    stroke: rgba(31, 35, 40, .5);
    stroke-width: .05;
    filter: drop-shadow(0 .05px .08px rgba(0, 0, 0, .4));
}
.kn-zoom-footer{
    display: flex;
    align-items: center;
    gap: 6px;
}
.kn-zoom-thrower{
    flex: 1;
    font-size: 12px;
    font-weight: 700;
    color: var(--bp-text-muted);
}
.kn-zoom-button{
    padding: 8px 12px;
    border: 1.5px solid var(--bp-border);
    border-radius: 10px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
}
.kn-zoom-button--primary{
    border-color: var(--main-color);
    background: var(--main-color);
    color: white;
}
</style>
