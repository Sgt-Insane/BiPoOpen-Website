<template>
	<Drawer
		v-model:visible="visible"
		position="bottom"
		:blockScroll="true"
		:showCloseIcon="false"
		:pt="{ root: { style: rootStyle } }"
		@show="onShow"
		@after-hide="onAfterHide"
	>
		<template #container>
			<!-- Handle + header: draggable with touch and mouse -->
			<div
				class="bs-drag-zone"
				@pointerdown="onPointerDown"
				@pointermove="onPointerMove"
				@pointerup="onPointerUp"
				@pointercancel="onPointerUp"
			>
				<button type="button" class="bs-handle" :aria-label="handleLabel" @click="onHandleClick">
					<span class="bs-handle-bar"></span>
				</button>
				<div class="bs-header">
					<div class="bs-header-content">
						<slot name="header"></slot>
					</div>
					<button
						v-if="closable"
						type="button"
						class="bs-close"
						aria-label="Schließen"
						@pointerdown.stop
						@click="close()"
					>
						<i class="pi pi-times"></i>
					</button>
				</div>
			</div>

			<!-- Content: drags the sheet only when scrolling would not make sense (see onTouchMove) -->
			<div
				ref="contentEl"
				class="bs-content"
				:class="{ 'bs-content-flush': flush }"
				@touchstart="onTouchStart"
				@touchmove="onTouchMove"
				@touchend="onTouchEnd"
				@touchcancel="onTouchEnd"
			>
				<slot></slot>
			</div>

			<!-- Covers the gap below the sheet while rubber-banding upwards -->
			<div class="bs-overscroll-fill" aria-hidden="true"></div>
		</template>
	</Drawer>
</template>

<script lang="ts">
// Ueber alle Instanzen: wie viele Sheets gerade offen sind
let openSheetCount = 0;
</script>

<script setup lang="ts">
/**
 * Unified bottom sheet with a drag handle, following the standard behaviour of
 * Material bottom sheets / iOS sheets / vaul:
 * - drag handle or header: sheet follows the finger, rubber-band above the top detent
 * - release: fast fling (> VELOCITY_THRESHOLD) moves one detent in fling direction,
 *   otherwise snap to the nearest detent; dragged > CLOSE_THRESHOLD below the lowest detent closes
 * - content: dragging down at scrollTop 0 (or up while half open) moves the sheet, otherwise native scroll
 * - tap on handle toggles large/half (closes when `fit`)
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import Drawer from 'primevue/drawer';
import { blockBodyScroll } from 'primevue/utils';
import { resetStickyTop } from './useStickyStack';

const visible = defineModel<boolean>('visible', { default: false });

// Das Sheet scrollt selbst: Sticky-Inhalt (z.B. Tabellenkoepfe) klebt an seiner Oberkante.
resetStickyTop();

const props = withDefaults(defineProps<{
	fit?: boolean;      // height by content, single detent
	flush?: boolean;    // content without horizontal padding
	closable?: boolean; // close button top right
}>(), {
	closable: true,
});

const MAX_HEIGHT_RATIO = 0.9;
const HALF_HEIGHT_RATIO = 0.5;
const VELOCITY_THRESHOLD = 0.4; // px/ms
const CLOSE_THRESHOLD = 0.25;   // fraction of the lowest detent's visible height
const DRAG_SLOP = 6;            // px before a gesture counts as drag
const VELOCITY_WINDOW = 100;    // ms of samples used for velocity
const RUBBER_BAND_MAX = 40;     // px
const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

const contentEl = ref<HTMLElement>();
const offset = ref(0);       // translateY of the sheet in px (0 = large)
const detentIndex = ref(0);  // 0 = large, 1 = half
const isDragging = ref(false);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const rootStyle = computed(() => ({
	height: props.fit ? 'auto' : `${MAX_HEIGHT_RATIO * 100}dvh`,
	maxHeight: `${MAX_HEIGHT_RATIO * 100}dvh`,
	width: '100%',
	maxWidth: '720px',
	borderTopLeftRadius: '20px',
	borderTopRightRadius: '20px',
	transform: `translate3d(0, ${offset.value}px, 0)`,
	transition: isDragging.value || prefersReducedMotion ? 'none' : `transform 0.5s ${EASING}`,
}));

const handleLabel = computed(() => {
	if (props.fit) return 'Schließen';
	return detentIndex.value == 0 ? 'Verkleinern' : 'Vergrößern';
});

// ─── Detents ───
const getSheetEl = () => contentEl.value?.parentElement ?? null;

// Offsets ascending: index 0 = large (0px), index 1 = half
const getDetents = () => {
	if (props.fit) return [0];
	let sheetHeight = getSheetEl()?.offsetHeight ?? 0;
	return [0, Math.max(0, sheetHeight - window.innerHeight * HALF_HEIGHT_RATIO)];
};

const snapTo = (index: number) => {
	detentIndex.value = index;
	offset.value = getDetents()[index];
};

const close = () => {
	// Keep the current offset: the drawer leave animation continues from here
	visible.value = false;
};

const resetPosition = () => {
	detentIndex.value = 0;
	offset.value = 0;
};

// Uebereinander geoeffnete Sheets (z.B. Spiel eintragen aus einem anderen Sheet):
// PrimeVue gibt den Body-Scroll beim Schliessen frei, auch wenn darunter noch ein Sheet offen ist.
let isOpen = false;

const onShow = () => {
	if (!isOpen) openSheetCount++;
	isOpen = true;
	resetPosition();
};

const onAfterHide = () => {
	if (isOpen) openSheetCount--;
	isOpen = false;
	if (openSheetCount > 0) blockBodyScroll();
	resetPosition();
};

// Ausgeblendet ohne after-hide (z.B. Seitenwechsel bei offenem Sheet)
onBeforeUnmount(() => {
	if (isOpen) openSheetCount--;
});

const onResize = () => {
	if (!isDragging.value && detentIndex.value > 0) snapTo(detentIndex.value);
};
window.addEventListener('resize', onResize);
onBeforeUnmount(() => window.removeEventListener('resize', onResize));

// ─── Drag core (shared by pointer and touch) ───
let dragStartY = 0;
let dragStartOffset = 0;
let samples: { y: number; t: number }[] = [];

const startDrag = (y: number) => {
	isDragging.value = true;
	dragStartY = y;
	dragStartOffset = offset.value;
	samples = [{ y, t: performance.now() }];
};

const moveDrag = (y: number) => {
	let raw = dragStartOffset + (y - dragStartY);
	// Rubber band above the top detent
	offset.value = raw < 0 ? -Math.min(RUBBER_BAND_MAX, Math.sqrt(-raw) * 2) : raw;

	let now = performance.now();
	samples.push({ y, t: now });
	samples = samples.filter((sample) => now - sample.t <= VELOCITY_WINDOW);
};

const endDrag = () => {
	isDragging.value = false;

	let first = samples[0];
	let last = samples[samples.length - 1];
	let velocity = last && first && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0; // > 0 = downwards

	let detents = getDetents();
	let current = offset.value;

	if (velocity > VELOCITY_THRESHOLD) {
		let next = detents.findIndex((detent) => detent > current + 1);
		next == -1 ? close() : snapTo(next);
		return;
	}
	if (velocity < -VELOCITY_THRESHOLD) {
		let previous = detents.map((detent, index) => ({ detent, index })).filter(({ detent }) => detent < current - 1).pop();
		snapTo(previous ? previous.index : 0);
		return;
	}

	let lowest = detents[detents.length - 1];
	let sheetHeight = getSheetEl()?.offsetHeight ?? 0;
	if (current > lowest + (sheetHeight - lowest) * CLOSE_THRESHOLD) {
		close();
		return;
	}

	let nearest = 0;
	detents.forEach((detent, index) => {
		if (Math.abs(detent - current) < Math.abs(detents[nearest] - current)) nearest = index;
	});
	snapTo(nearest);
};

// ─── Handle + header (pointer events: touch and mouse) ───
let pointerId: number | null = null;
let pointerStartY = 0;
let suppressClick = false;

const onPointerDown = (event: PointerEvent) => {
	if (event.pointerType == 'mouse' && event.button != 0) return;
	suppressClick = false;
	pointerId = event.pointerId;
	pointerStartY = event.clientY;
};

const onPointerMove = (event: PointerEvent) => {
	if (event.pointerId != pointerId) return;
	if (!isDragging.value) {
		if (Math.abs(event.clientY - pointerStartY) < DRAG_SLOP) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		startDrag(event.clientY);
	}
	moveDrag(event.clientY);
};

const onPointerUp = (event: PointerEvent) => {
	if (event.pointerId != pointerId) return;
	pointerId = null;
	if (!isDragging.value) return;
	suppressClick = true;
	endDrag();
};

const onHandleClick = () => {
	if (suppressClick) {
		suppressClick = false;
		return;
	}
	if (props.fit) close();
	else snapTo(detentIndex.value == 0 ? 1 : 0);
};

// ─── Content (touch events, so native scrolling keeps working) ───
let touchStartX = 0;
let touchStartY = 0;
let touchMode: 'undecided' | 'sheet' | 'scroll' = 'undecided';

const onTouchStart = (event: TouchEvent) => {
	if (event.touches.length != 1) {
		touchMode = 'scroll';
		return;
	}
	touchStartX = event.touches[0].clientX;
	touchStartY = event.touches[0].clientY;
	touchMode = 'undecided';
};

const onTouchMove = (event: TouchEvent) => {
	if (touchMode == 'scroll') return;
	let touch = event.touches[0];

	if (touchMode == 'undecided') {
		let dx = touch.clientX - touchStartX;
		let dy = touch.clientY - touchStartY;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_SLOP) return;

		let atTop = (contentEl.value?.scrollTop ?? 0) <= 0;
		let dragsSheet = Math.abs(dy) > Math.abs(dx) && event.cancelable && (
			(dy > 0 && atTop) ||             // pull down at the top of the content
			(dy < 0 && detentIndex.value > 0) // pull up while half open
		);
		touchMode = dragsSheet ? 'sheet' : 'scroll';
		if (!dragsSheet) return;
		startDrag(touch.clientY);
	}

	event.preventDefault();
	moveDrag(touch.clientY);
};

const onTouchEnd = () => {
	if (touchMode == 'sheet' && isDragging.value) endDrag();
	touchMode = 'undecided';
};
</script>

<style scoped>
.bs-drag-zone {
	flex-shrink: 0;
	touch-action: none;
	user-select: none;
	cursor: grab;
}
.bs-drag-zone:active {
	cursor: grabbing;
}

.bs-handle {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 64px;
	height: 24px;
	margin: 0 auto;
	padding: 0;
	border: none;
	background: none;
	cursor: inherit;
}
.bs-handle-bar {
	width: 36px;
	height: 4px;
	border-radius: 2px;
	background: var(--bp-border-strong);
}
.bs-handle:focus-visible {
	outline: 2px solid var(--main-color);
	outline-offset: -2px;
	border-radius: 8px;
}

.bs-header {
	display: flex;
	align-items: flex-start;
	gap: 12px;
	padding: 0 1.25rem 1rem;
}
.bs-header-content {
	flex: 1;
	min-width: 0;
	min-height: 36px; /* close button: single-line titles sit centered next to it */
	display: flex;
	align-items: center;
}

.bs-close {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: var(--bp-fill-soft);
	color: var(--bp-text-strong);
	cursor: pointer;
	transition: background .2s ease;
}
.bs-close:hover {
	background: var(--bp-fill-strong);
}
.bs-close:focus-visible {
	outline: 2px solid var(--main-color);
	outline-offset: 2px;
}
.bs-close .pi {
	font-size: 14px;
	font-weight: bold;
}

.bs-content {
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	overscroll-behavior: contain;
	padding: 0 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
}
.bs-content-flush {
	padding-left: 0;
	padding-right: 0;
}

.bs-overscroll-fill {
	position: absolute;
	left: 0;
	right: 0;
	top: 100%;
	height: 40px; /* RUBBER_BAND_MAX */
	background: inherit;
}
</style>
