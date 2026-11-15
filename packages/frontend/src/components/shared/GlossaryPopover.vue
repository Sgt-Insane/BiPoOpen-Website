<template>
    <!-- Kleine Erklaerblase direkt am angetippten Wort (einmal in App.vue) -->
    <transition name="gp">
        <div v-if="active" ref="bubble" class="GlossaryPopover" :class="{ 'gp--below': position.below }" role="tooltip"
            :style="{ left: `${position.left}px`, top: `${position.top}px`, '--gp-arrow': `${position.arrow}px` }">
            <div class="gp-term">{{ GLOSSARY[active.key].term }}</div>
            <div class="gp-text">{{ GLOSSARY[active.key].text }}</div>
        </div>
    </transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { GLOSSARY } from './glossary';
import { useGlossary } from './useGlossary';

const { active, close } = useGlossary();
const bubble = ref<HTMLElement | null>(null);

const WIDTH = 260;
const MARGIN = 10;
const APPROX_HEIGHT = 110;

// Ueber dem Wort, wenn oben genug Platz ist (unter der App-Leiste), sonst darunter; Pfeil zeigt aufs Wort
const position = computed(() => {
    if (!active.value) return { left: 0, top: 0, arrow: 0, below: false };
    const { rect } = active.value;
    const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN);
    const center = rect.left + rect.width / 2;
    const left = Math.min(Math.max(MARGIN, center - width / 2), window.innerWidth - width - MARGIN);
    const below = rect.top - APPROX_HEIGHT < 64;
    return {
        left,
        top: below ? rect.top + rect.height + 8 : rect.top - 8,
        arrow: Math.min(Math.max(14, center - left), width - 14),
        below,
    };
});

// Schliessen: Tipp daneben, Scrollen, Escape, Seitenwechsel
const onPointerDown = (event: PointerEvent) => {
    if (!active.value) return;
    const target = event.target as HTMLElement;
    if (bubble.value?.contains(target) || target.closest('.GlossaryWord')) return;
    close();
};
const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
const onScroll = () => { if (active.value) close(); };

onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll);
});
onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('resize', onScroll);
});

const route = useRoute();
watch(() => route.fullPath, close);
</script>

<style scoped>
.GlossaryPopover{
    position: fixed;
    z-index: 3000;
    width: min(260px, calc(100vw - 20px));
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--bp-inverse-bg, #14213d);
    color: var(--bp-inverse-text, white);
    box-shadow: 0 8px 24px rgba(0, 0, 0, .25);
    transform: translateY(-100%);
    pointer-events: auto;
}
.GlossaryPopover::after{
    content: '';
    position: absolute;
    left: var(--gp-arrow);
    bottom: -6px;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    background: inherit;
    transform: rotate(45deg);
    border-radius: 2px;
}
.gp--below{
    transform: none;
}
.gp--below::after{
    top: -6px;
    bottom: auto;
}
.gp-term{
    font-size: 13px;
    font-weight: 800;
}
.gp-text{
    margin-top: 2px;
    font-size: 13px;
    line-height: 1.4;
    opacity: .9;
}
.gp-enter-active, .gp-leave-active{
    transition: opacity .15s ease;
}
.gp-enter-from, .gp-leave-to{
    opacity: 0;
}
</style>
