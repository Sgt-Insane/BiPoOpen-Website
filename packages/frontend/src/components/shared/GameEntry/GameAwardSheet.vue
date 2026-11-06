<template>
    <BottomSheet v-model:visible="visible" fit :closable="false">
        <template #header>
            <div class="ga-header">
                <!-- Neu pro Erfolg, damit das Konfetti jedes Mal wieder faellt -->
                <div :key="index" class="ga-confetti" aria-hidden="true">
                    <span v-for="(piece, pieceIndex) in confetti" :key="pieceIndex" class="ga-confetti-piece" :style="piece"></span>
                </div>
                <span class="ga-saved"><i class="pi pi-check"></i> {{ score }} gespeichert</span>
            </div>
        </template>

        <div v-if="badge?.award" :key="index" class="ga-body">
            <span class="ga-icon" :class="`ga-icon--${badge.group}`">
                <span class="material-icons">{{ badge.icon }}</span>
            </span>
            <div class="ga-kicker" :class="`ga-kicker--${badge.group}`">
                Neuer Erfolg<template v-if="badges.length > 1"> · {{ index + 1 }} / {{ badges.length }}</template>
            </div>
            <div class="ga-title">{{ badge.award.title }}</div>
            <div class="ga-text">
                {{ textParts[0] }}<strong>{{ textParts[1] }}</strong>{{ textParts[2] }}<br>
                Ab jetzt im Profil zu sehen.
            </div>

            <button type="button" class="ga-button" @click="next()">Weiter</button>
        </div>
    </BottomSheet>
</template>

<script setup lang="ts">
/**
 * Neue Erfolge nach dem Eintragen eines Spiels, einer nach dem anderen ("Weiter").
 */
import { computed, ref, watch } from 'vue';
import BottomSheet from '@/components/shared/BottomSheet.vue';

const CONFETTI_COLORS = ['#EA5160', '#61C3D9', '#E3A92B', '#4CAF7A', '#3B4A6B'];
const CONFETTI_COUNT = 22;

const visible = defineModel<boolean>('visible', { default: false });

const props = defineProps<{
    badges: PlayerBadge[];  // mit award
    score: string;          // "10 : 9"
}>();

const index = ref(0);
const badge = computed(() => props.badges[index.value]);

watch(visible, (isVisible) => {
    if (isVisible) index.value = 0;
});

const next = () => {
    if (index.value < props.badges.length - 1) index.value++;
    else visible.value = false;
};

// Text mit fett gesetztem highlight: [davor, highlight, danach]
const textParts = computed(() => {
    const { text, highlight } = badge.value?.award ?? { text: '' };
    const start = highlight ? text.indexOf(highlight) : -1;
    if (!highlight || start < 0) return [text, '', ''];
    return [text.slice(0, start), highlight, text.slice(start + highlight.length)];
});

// Zufaellig verteilt, je Erfolg neu
const createConfetti = () => Array.from({ length: CONFETTI_COUNT }, (_, pieceIndex) => ({
    left: `${Math.random() * 100}%`,
    background: CONFETTI_COLORS[pieceIndex % CONFETTI_COLORS.length],
    animationDelay: `${Math.random() * 0.5}s`,
    animationDuration: `${2 + Math.random() * 1.2}s`,
    '--fall': `${70 + Math.random() * 90}px`,
    '--drift': `${(Math.random() - 0.5) * 50}px`,
    '--rotate-start': `${Math.random() * 360}deg`,
    '--rotate': `${(Math.random() - 0.5) * 720}deg`,
}));

const confetti = ref(createConfetti());
watch([visible, index], () => { confetti.value = createConfetti(); });
</script>

<style scoped>
/* ─── Kopf ─── */
.ga-header{
    position: relative;
    display: flex;
    justify-content: center;
    width: 100%;
}
.ga-saved{
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--bp-success-weak);
    color: var(--bp-success-strong);
    font-size: 13px;
    font-weight: 700;
}
.ga-saved .pi{
    font-size: 11px;
    font-weight: 800;
}

/* ─── Konfetti ─── */
.ga-confetti{
    position: absolute;
    top: -24px;     /* Griff des Sheets */
    left: -1.25rem;
    right: -1.25rem;
    height: 180px;
    overflow: hidden;
    pointer-events: none;
}
.ga-confetti-piece{
    position: absolute;
    top: 0;
    width: 10px;
    height: 5px;
    border-radius: 2px;
    opacity: 0;
    animation: ga-confetti-fall ease-out both;
}
@keyframes ga-confetti-fall{
    0%{ transform: translate(0, -12px) rotate(var(--rotate-start)); opacity: 0; }
    10%{ opacity: 1; }
    75%{ opacity: 1; }
    100%{ transform: translate(var(--drift), var(--fall)) rotate(var(--rotate)); opacity: 0; }
}

/* ─── Erfolg ─── */
.ga-body{
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 12px;
    text-align: center;
}
.ga-icon{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 104px;
    height: 104px;
    margin-bottom: 22px;
    border-radius: 50%;
    color: white;
    animation: ga-pop .5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.ga-icon .material-icons{
    font-size: 48px;
}
.ga-icon--milestone{
    background: linear-gradient(160deg, #7FD6EA 0%, #36AFC8 100%);
    box-shadow: 0 0 0 10px var(--secondary-color-weak), 0 8px 20px rgba(54, 175, 200, .35);
}
.ga-icon--title{
    background: linear-gradient(160deg, #F6CF6B 0%, #E3A92B 100%);
    box-shadow: 0 0 0 10px var(--bp-gold-weak), 0 8px 20px rgba(227, 169, 43, .35);
}
.ga-icon--record{
    background: linear-gradient(160deg, #A48DF0 0%, #6D4FD0 100%);
    box-shadow: 0 0 0 10px var(--bp-violet-weak), 0 8px 20px rgba(109, 79, 208, .35);
}
.ga-icon--performance{
    background: linear-gradient(160deg, #F58A95 0%, #EA5160 100%);
    box-shadow: 0 0 0 10px var(--bp-primary-weak), 0 8px 20px rgba(234, 81, 96, .35);
}
@keyframes ga-pop{
    0%{ transform: scale(.5); opacity: 0; }
    100%{ transform: scale(1); opacity: 1; }
}

.ga-kicker{
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .1em;
    text-transform: uppercase;
}
.ga-kicker--milestone{ color: var(--bp-secondary-text); }
.ga-kicker--title{ color: var(--bp-gold); }
.ga-kicker--record{ color: var(--bp-violet); }
.ga-kicker--performance{ color: var(--bp-primary-text); }

.ga-title{
    margin-top: 10px;
    font-size: 26px;
    font-weight: 800;
    color: var(--bp-text-strong);
    line-height: 1.2;
}
.ga-text{
    margin-top: 12px;
    font-size: 15px;
    color: var(--bp-text-secondary);
    line-height: 1.5;
}
.ga-text strong{
    color: var(--bp-text-strong);
}

.ga-button{
    width: 100%;
    height: 52px;
    margin-top: 32px;
    border: none;
    border-radius: 14px;
    background: var(--main-color);
    color: white;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
}
.ga-button:focus-visible{
    outline: 2px solid var(--bp-text-strong);
    outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce){
    .ga-icon{
        animation: none;
    }
    .ga-confetti-piece{
        animation: none;
        opacity: 1;
        transform: translate(var(--drift), calc(var(--fall) * .5)) rotate(var(--rotate));
    }
}
</style>
