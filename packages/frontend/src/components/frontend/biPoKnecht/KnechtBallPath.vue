<template>
    <!-- Knecht Pro, Ballweg: abgelegte Baelle mit Nummer, gestrichelte Pfeile dazwischen und die Lupe beim Halten.
         In Bildschirmkoordinaten ueber allem (das Spielfeld kann gedreht sein), nimmt keine Tipps an. -->
    <Teleport to="body">
        <div class="KnechtBallPath" aria-hidden="true">
            <svg v-if="arrows.length" class="kbp-arrows">
                <defs>
                    <marker id="kbp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                        <path d="M0 0L10 5L0 10z" />
                    </marker>
                </defs>
                <line v-for="(arrow, index) in arrows" :key="index" :x1="arrow.x1" :y1="arrow.y1" :x2="arrow.x2" :y2="arrow.y2" :class="{ 'kbp-arrow--bad': arrow.bad }" marker-end="url(#kbp-arrow)" />
            </svg>

            <span
                v-for="(ball, index) in balls"
                :key="index"
                class="kbp-ball"
                :class="{ 'kbp-ball--bad': problems[index], 'kbp-ball--moving': hold?.moving === index }"
                :style="{ left: `${ball.x}px`, top: `${ball.y}px`, width: `${ballSize}px`, height: `${ballSize}px` }"
            >{{ problems[index] ? '✕' : index + 1 }}</span>

            <!-- Lupe: ueber dem Finger (am oberen Rand darunter), Becher vergroessert, die Stelle unter dem Finger hervorgehoben -->
            <div v-if="hold && geometry" class="kbp-loupe" :style="loupeStyle">
                <svg :viewBox="viewBox" class="kbp-loupe-view" :class="`kbp-loupe--${hold.zone.kind}`">
                    <rect :x="hold.x - span" :y="hold.y - span" :width="span * 2" :height="span * 2" class="kbp-table" />
                    <g v-for="cup in visibleCups" :key="cup.index">
                        <circle :cx="cup.x" :cy="cup.y" :r="rimRadius" class="kbp-rim" :class="{ 'kbp-rim--on': isRimOn(cup.index) }" :stroke-width="rimWidth" />
                        <circle :cx="cup.x" :cy="cup.y" :r="innerRadius" class="kbp-inner" :class="{ 'kbp-inner--on': isCupOn(cup.index), 'kbp-inner--off': !hittable.has(cup.index) }" />
                    </g>
                    <circle :cx="hold.x" :cy="hold.y" :r="ballSize / 2" class="kbp-loupe-ball" />
                </svg>
                <span class="kbp-loupe-label">{{ zoneLabel }}</span>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RIM_INNER, RIM_OUTER, type BallZone, type PathBall } from './knechtBallPath';
import type { RackGeometry } from './knechtEdges';

const props = defineProps<{
    path: PathBall[];
    problems: (string | null)[];
    // Finger liegt gerade auf (Lupe). moving: Index des Balls, der verschoben wird
    hold: { x: number; y: number; zone: BallZone; moving: number | null } | null;
    geometry: RackGeometry | null;
    hittable: Set<number>;
    ballSize: number;
}>();

const LOUPE_SIZE = 132;
const ZOOM = 2.6;

// Beim Verschieben steht der Ball unter dem Finger, nicht an der alten Stelle
const balls = computed(() => props.path.map((ball, index) => props.hold?.moving === index ? { ...ball, x: props.hold.x, y: props.hold.y } : ball));

// Pfeil vom Rand des einen Balls zum Rand des naechsten
const arrows = computed(() => balls.value.slice(1).map((ball, index) => {
    const from = balls.value[index];
    const dx = ball.x - from.x, dy = ball.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const gap = props.ballSize / 2 + 3;
    return {
        x1: from.x + dx / length * gap, y1: from.y + dy / length * gap,
        x2: ball.x - dx / length * gap, y2: ball.y - dy / length * gap,
        bad: !!props.problems[index + 1],
    };
}));

// ─── Lupe ───
const span = computed(() => LOUPE_SIZE / ZOOM / 2);
const viewBox = computed(() => props.hold ? `${props.hold.x - span.value} ${props.hold.y - span.value} ${span.value * 2} ${span.value * 2}` : '0 0 1 1');
const loupeStyle = computed(() => {
    if (!props.hold) return {};
    const above = props.hold.y - LOUPE_SIZE - 40 > 8;
    return {
        left: `${Math.min(Math.max(props.hold.x - LOUPE_SIZE / 2, 8), window.innerWidth - LOUPE_SIZE - 8)}px`,
        top: `${above ? props.hold.y - LOUPE_SIZE - 40 : props.hold.y + 40}px`,
        width: `${LOUPE_SIZE}px`,
        height: `${LOUPE_SIZE}px`,
    };
});
const radius = computed(() => props.geometry?.radius ?? 20);
// Kante als Ring zwischen RIM_INNER und RIM_OUTER, Inneres bis RIM_INNER
const rimRadius = computed(() => radius.value * (RIM_INNER + RIM_OUTER) / 2);
const rimWidth = computed(() => radius.value * (RIM_OUTER - RIM_INNER));
const innerRadius = computed(() => radius.value * RIM_INNER);
const visibleCups = computed(() => {
    const geometry = props.geometry;
    const hold = props.hold;
    if (!geometry || !hold) return [];
    const reach = span.value + radius.value * RIM_OUTER;
    return geometry.standing
        .map(index => ({ index, ...geometry.centers[index] }))
        .filter(cup => Math.abs(cup.x - hold.x) < reach && Math.abs(cup.y - hold.y) < reach);
});
const isRimOn = (cup: number) => props.hold?.zone.kind === 'rim' && props.hold.zone.cup === cup;
const isCupOn = (cup: number) => props.hold?.zone.kind === 'cup' && props.hold.zone.cup === cup;
const zoneLabel = computed(() => {
    const zone = props.hold?.zone;
    if (!zone) return '';
    if (zone.kind === 'cup') return props.hittable.has(zone.cup) ? `Becher ${zone.cup + 1}` : `Becher ${zone.cup + 1} (nicht treffbar)`;
    if (zone.kind === 'rim') return `Kante Becher ${zone.cup + 1}`;
    return zone.kind === 'table' ? 'Tischplatte' : 'Airball';
});
</script>

<style scoped>
.KnechtBallPath{
    position: fixed;
    inset: 0;
    /* ueber dem Knecht (fixed, z-index 1000), unter Dialogen der Seite */
    z-index: 1050;
    pointer-events: none;
}
.kbp-arrows{
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
}
.kbp-arrows line{
    stroke: #1F2328;
    stroke-width: 2.5;
    stroke-dasharray: 6 5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 2px rgba(255, 255, 255, .9));
}
.kbp-arrows marker path{
    fill: #1F2328;
}
.kbp-arrows .kbp-arrow--bad{
    stroke: #E5484D;
}
.kbp-ball{
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(-50%, -50%);
    border: 2px solid #1F2328;
    border-radius: 50%;
    background: #FFF7E6;
    color: #1F2328;
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    box-shadow: 0 2px 6px rgba(0, 0, 0, .3);
}
.kbp-ball--bad{
    border-color: #E5484D;
    background: #E5484D;
    color: white;
}
.kbp-ball--moving{
    opacity: .6;
}
.kbp-loupe{
    position: absolute;
    border: 3px solid #1F2328;
    border-radius: 50%;
    overflow: hidden;
    background: #E8EDF1;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
}
.kbp-loupe-view{
    width: 100%;
    height: 100%;
}
.kbp-table{
    fill: #DDE6EC;
}
.kbp-loupe--table .kbp-table{
    fill: #9FD6A8;
}
.kbp-loupe--airball .kbp-table{
    fill: #C9CED4;
}
.kbp-rim{
    fill: none;
    stroke: #8FA3B3;
}
.kbp-rim--on{
    stroke: #F5A524;
}
.kbp-inner{
    fill: #4FB3CF;
}
.kbp-inner--on{
    fill: #2F9E44;
}
.kbp-inner--off{
    fill: #B8C2CB;
}
.kbp-loupe-ball{
    fill: rgba(255, 247, 230, .85);
    stroke: #1F2328;
    stroke-width: 1.5;
}
.kbp-loupe-label{
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(31, 35, 40, .85);
    color: white;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
}
</style>
