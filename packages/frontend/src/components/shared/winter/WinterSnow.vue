<template>
	<!-- Leichter Schneefall ueber dem Inhalt, unter Header und Bottom-Nav. Klicks gehen durch. -->
	<canvas ref="canvasRef" class="WinterSnow" aria-hidden="true"></canvas>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

type Flake = { x: number; y: number; r: number; speed: number; drift: number; phase: number; alpha: number };

// Bewusst wenige Flocken: eine pro ~14000 px² Bildschirm, hoechstens 45
const AREA_PER_FLAKE = 14000;
const MAX_FLAKES = 45;

const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let flakes: Flake[] = [];
let width = 0;
let height = 0;
let frame = 0;
let lastTime = 0;

const createFlake = (y: number): Flake => {
	const r = 1 + Math.random() * 1.8;
	return {
		x: Math.random() * width,
		y,
		r,
		// Groessere Flocken fallen etwas schneller (wirkt naeher)
		speed: 14 + r * 10 + Math.random() * 8,
		drift: 6 + Math.random() * 12,
		phase: Math.random() * Math.PI * 2,
		alpha: 0.45 + Math.random() * 0.4,
	};
};

const resize = () => {
	const canvas = canvasRef.value;
	if (!canvas || !ctx) return;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	width = window.innerWidth;
	height = window.innerHeight;
	canvas.width = Math.round(width * dpr);
	canvas.height = Math.round(height * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	const target = Math.min(MAX_FLAKES, Math.round((width * height) / AREA_PER_FLAKE));
	while (flakes.length < target) flakes.push(createFlake(Math.random() * height));
	flakes.length = target;
};

const draw = (time: number) => {
	frame = requestAnimationFrame(draw);
	if (!ctx) return;
	// Nach Tab-Wechsel o.ae. nicht springen
	const dt = Math.min((time - lastTime) / 1000, 0.05);
	lastTime = time;

	// Auf hellem Grund weisse Flocken mit zartem Rand, im Dark Mode einfach weiss
	const dark = document.documentElement.classList.contains('bp-dark');
	ctx.clearRect(0, 0, width, height);
	ctx.lineWidth = 0.8;
	ctx.strokeStyle = 'rgba(130, 148, 175, 0.55)';

	for (const flake of flakes) {
		flake.y += flake.speed * dt;
		flake.phase += dt * 0.8;
		if (flake.y - flake.r > height) {
			Object.assign(flake, createFlake(-flake.r));
		}
		const x = flake.x + Math.sin(flake.phase) * flake.drift;

		ctx.globalAlpha = dark ? flake.alpha * 0.8 : flake.alpha;
		ctx.beginPath();
		ctx.arc(x, flake.y, flake.r, 0, Math.PI * 2);
		ctx.fillStyle = '#fff';
		ctx.fill();
		if (!dark) ctx.stroke();
	}
	ctx.globalAlpha = 1;
};

onMounted(() => {
	ctx = canvasRef.value?.getContext('2d') ?? null;
	if (!ctx) return;
	resize();
	window.addEventListener('resize', resize);
	lastTime = performance.now();
	frame = requestAnimationFrame(draw);
});

onBeforeUnmount(() => {
	cancelAnimationFrame(frame);
	window.removeEventListener('resize', resize);
});
</script>

<style scoped>
.WinterSnow {
	position: fixed;
	inset: 0;
	width: 100%;
	height: 100%;
	/* Unter Header/Bottom-Nav (99), unter Drawern und Dialogen */
	z-index: 98;
	pointer-events: none;
}
</style>
