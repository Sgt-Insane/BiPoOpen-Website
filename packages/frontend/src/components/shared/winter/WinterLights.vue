<template>
	<!-- Lichterkette unter dem Header: Draht haengt zwischen den Aufhaengepunkten durch, je eine Birne am tiefsten Punkt -->
	<div ref="rootRef" class="WinterLights" aria-hidden="true">
		<svg v-if="width" :width="width" :height="HEIGHT" :viewBox="`0 0 ${width} ${HEIGHT}`">
			<path :d="wirePath" class="wl-wire"/>
			<g
				v-for="bulb in bulbs"
				:key="bulb.x"
				:transform="`translate(${bulb.x} ${SAG_Y}) rotate(${bulb.tilt})`"
			>
				<rect x="-2.2" y="-0.5" width="4.4" height="4" rx="1" class="wl-socket"/>
				<g class="wl-bulb" :style="{ color: bulb.color, animationDelay: `${bulb.delay}s` }">
					<ellipse cx="0" cy="8.6" rx="3.5" ry="5.4" fill="currentColor"/>
					<ellipse cx="-1.2" cy="7" rx="0.9" ry="1.9" fill="#fff" opacity=".55"/>
				</g>
			</g>
		</svg>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const SEGMENT = 34;     // Abstand der Birnen in px
const HEIGHT = 22;
const HOOK_Y = 1.5;     // Aufhaengepunkte
const SAG_Y = 6.5;      // tiefster Punkt des Drahts (dort haengt die Birne)
const COLORS = ['#EA5160', '#F5B82E', '#2FA65A', '#61C3D9', '#F48FB1'];

const rootRef = ref<HTMLElement | null>(null);
const width = ref(0);
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
	const el = rootRef.value;
	if (!el) return;
	width.value = el.clientWidth;
	resizeObserver = new ResizeObserver(() => { width.value = el.clientWidth; });
	resizeObserver.observe(el);
});
onBeforeUnmount(() => resizeObserver?.disconnect());

const segmentCount = computed(() => Math.ceil(width.value / SEGMENT) + 1);

// Quadratische Kurve: Kontrollpunkt doppelt so tief, damit die Mitte genau auf SAG_Y liegt
const wirePath = computed(() => {
	let d = `M0 ${HOOK_Y}`;
	for (let i = 0; i < segmentCount.value; i++) {
		const x = i * SEGMENT;
		d += ` Q${x + SEGMENT / 2} ${2 * SAG_Y - HOOK_Y} ${x + SEGMENT} ${HOOK_Y}`;
	}
	return d;
});

const bulbs = computed(() => Array.from({ length: segmentCount.value }, (_, i) => ({
	x: i * SEGMENT + SEGMENT / 2,
	color: COLORS[i % COLORS.length],
	// Leicht schief und nicht im Gleichtakt funkeln, sonst wirkt es mechanisch
	tilt: [-8, 5, -3, 9, -6, 2][i % 6],
	delay: -((i * 1.37) % 3.2),
})));
</script>

<style scoped>
.WinterLights {
	position: absolute;
	top: 100%;
	left: 0;
	right: 0;
	height: 22px;
	overflow: hidden;
	pointer-events: none;
}
.WinterLights svg {
	display: block;
}
.wl-wire {
	fill: none;
	stroke: #2F4A3A;
	stroke-width: 1.2;
	stroke-linecap: round;
}
.wl-socket {
	fill: #56635C;
}
.wl-bulb {
	animation: wl-twinkle 3.2s ease-in-out infinite;
}
@keyframes wl-twinkle {
	0%, 100% { opacity: 1; }
	50% { opacity: .55; }
}

/* Im Dunkeln leuchten die Birnen */
:global(html.bp-dark .WinterLights .wl-wire) {
	stroke: #7D8A84;
}
:global(html.bp-dark .WinterLights .wl-socket) {
	fill: #8C9893;
}
:global(html.bp-dark .WinterLights .wl-bulb) {
	filter: drop-shadow(0 0 3px currentColor);
}

@media (prefers-reduced-motion: reduce) {
	.wl-bulb {
		animation: none;
	}
}
</style>
