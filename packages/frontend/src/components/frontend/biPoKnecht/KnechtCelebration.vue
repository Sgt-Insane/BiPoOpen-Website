<template>
    <transition name="kc">
        <div v-if="celebration" :key="celebration.id" class="KnechtCelebration" :class="`kc--${celebration.kind}`" :style="{ '--kc-color': look.color, '--kc-dark': look.dark }" aria-live="polite">
            <div class="kc-stage" :style="{ transform: flipped ? 'rotate(180deg)' : undefined }">
                <div class="kc-flash"></div>
                <!-- Effekte hinter dem Titel -->
                <div class="kc-stripes"><span v-for="i in 3" :key="i" class="kc-stripe" :style="{ '--i': i }"></span></div>
                <span v-for="ring in look.rings" :key="`r${ring}`" class="kc-ring" :style="{ '--i': ring }"></span>
                <span
                    v-for="particle in particles"
                    :key="particle.key"
                    class="kc-particle"
                    :class="`kc-particle--${look.particle}`"
                    :style="particle.style"
                ></span>
                <div v-if="celebration.kind === 'rerack'" class="kc-rack">
                    <span v-for="cup in rerackCups" :key="cup.key" class="kc-rack-cup" :style="cup.style"></span>
                </div>
                <span v-if="look.ball" class="kc-ball" :class="`kc-ball--${look.ball}`"></span>
                <span v-if="look.ball === 'orbit'" class="kc-ball kc-ball--orbit kc-ball--second"></span>

                <!-- Titel wie beim Bowling -->
                <div class="kc-content">
                    <!-- Formation: kleines Becher-Dreieck mit Nummern, stehende Becher ploppen auf -->
                    <div v-if="formation" class="kc-formation" :class="`kc-formation--${formation.effect}`">
                        <div v-if="formation.effect === 'wall'" class="kc-wall"></div>
                        <div v-if="formation.effect === 'ring'" class="kc-fire-ring"></div>
                        <svg v-if="formation.effect === 'stripe' && stripeLine" class="kc-stripe-line" :viewBox="`0 0 ${RACK_WIDTH} ${RACK_HEIGHT}`">
                            <line :x1="stripeLine.x1" :y1="stripeLine.y1" :x2="stripeLine.x2" :y2="stripeLine.y2" />
                        </svg>
                        <span
                            v-for="cup in formationCups"
                            :key="cup.number"
                            class="kc-fcup"
                            :class="{ 'kc-fcup--on': cup.standing, 'kc-fcup--tower': cup.standing && formation.effect === 'towers', 'kc-fcup--hole': !cup.standing && formation.effect === 'hole' }"
                            :style="cup.style"
                        >{{ cup.number }}</span>
                    </div>
                    <div v-else class="kc-icon"><KnechtIcon :name="look.icon" /></div>
                    <div class="kc-title" :style="{ fontSize: titleSize }">{{ title }}</div>
                    <div v-if="subtitle" class="kc-subtitle">{{ subtitle }}</div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KnechtIcon from './KnechtIcon.vue';
import type { KnechtIconName } from './knechtIcons';
import type { FormationEffect } from './knechtFormations';
import type { KnechtCelebration, KnechtCelebrationKind } from './useBiPoKnecht';

// Grosse Animation nach besonderen Aktionen. Faengt keine Eingaben ab: man kann direkt weiter tippen.
const props = defineProps<{ celebration: KnechtCelebration | null; flipped?: boolean }>();

type ParticleKind = 'debris' | 'flame' | 'ember' | 'spark' | 'confetti' | 'star';
type Look = {
    title: string;
    subtitle?: (player: string) => string;
    icon: KnechtIconName;
    color: string;
    dark: string;
    particle: ParticleKind | null;
    count: number;
    rings: number[];
    ball?: 'bounce' | 'orbit' | 'loop';
};

const LOOKS: Record<KnechtCelebrationKind, Look> = {
    bomb: { title: 'Bombe!', subtitle: player => `${player} · beide Bälle im selben Becher`, icon: 'bomb', color: '#E5484D', dark: '#7A1418', particle: 'debris', count: 26, rings: [1, 2] },
    'on-fire': { title: 'On Fire!', subtitle: player => `${player} wirft weiter`, icon: 'onfire', color: '#F76B15', dark: '#7A2400', particle: 'flame', count: 44, rings: [] },
    'heating-up': { title: 'Heating Up', subtitle: player => `${player} · noch ein Treffer bis On Fire`, icon: 'heating', color: '#F76B15', dark: '#8A3A00', particle: 'ember', count: 16, rings: [] },
    ballsback: { title: 'Balls Back!', subtitle: () => 'Beide Bälle zurück', icon: 'ballsback', color: '#2EA3C7', dark: '#0B4A5E', particle: 'spark', count: 14, rings: [1], ball: 'orbit' },
    deathcup: { title: 'Deathcup!', subtitle: player => `${player} beendet das Spiel`, icon: 'deathcup', color: '#FF4D4D', dark: '#000000', particle: 'ember', count: 14, rings: [1, 2, 3] },
    nachwurf: { title: 'Nachwurf!', subtitle: () => "Gentleman's Rule", icon: 'nachwurf', color: '#1F8A70', dark: '#0A3D31', particle: 'confetti', count: 30, rings: [] },
    overtime: { title: 'Verlängerung!', subtitle: () => '2 × 3 Becher', icon: 'overtime', color: '#F5A524', dark: '#6B4300', particle: 'confetti', count: 30, rings: [] },
    bouncer: { title: 'Bouncer!', subtitle: player => `${player} · über den Tisch`, icon: 'bouncer', color: '#8E4EC6', dark: '#3A1260', particle: 'spark', count: 10, rings: [], ball: 'bounce' },
    rerack: { title: 'Re-Rack!', subtitle: () => 'Neue Formation', icon: 'reRack', color: '#1F8A70', dark: '#0A3D31', particle: null, count: 0, rings: [] },
    trickshot: { title: 'Gefangen!', subtitle: player => `${player} wirft den Trickshot`, icon: 'trickshot', color: '#F5A524', dark: '#6B4300', particle: 'star', count: 10, rings: [], ball: 'loop' },
    lastcup: { title: 'Letzter Becher!', subtitle: player => `${player} räumt ab`, icon: 'lastCup', color: '#E0A800', dark: '#5C4300', particle: 'star', count: 24, rings: [1, 2] },
    formation: { title: 'Formation', icon: 'reRack', color: '#E5484D', dark: '#7A1418', particle: 'spark', count: 12, rings: [] },
    'trickshot-hit': { title: 'Trickshot!', subtitle: player => `${player} verwandelt`, icon: 'trickshot', color: '#F5A524', dark: '#6B4300', particle: 'star', count: 22, rings: [1] },
};

const FORMATION_COLORS: Record<FormationEffect, [string, string]> = {
    wall: ['#8B5E3C', '#3B2414'],
    ring: ['#F76B15', '#7A2400'],
    hole: ['#8E4EC6', '#3A1260'],
    towers: ['#2EA3C7', '#0B4A5E'],
    stripe: ['#1F8A70', '#0A3D31'],
    pop: ['#E5484D', '#7A1418'],
};

const formation = computed(() => props.celebration?.kind === 'formation' ? props.celebration.formation ?? null : null);
const look = computed<Look>(() => {
    const base = LOOKS[props.celebration?.kind ?? 'bomb'];
    if (!formation.value) return base;
    const [color, dark] = FORMATION_COLORS[formation.value.effect];
    return { ...base, color, dark, particle: formation.value.effect === 'ring' ? 'ember' : 'spark', count: formation.value.effect === 'ring' ? 18 : 12 };
});
const title = computed(() => formation.value?.name ?? look.value.title);
// Lange Woerter passen sich der Breite an, damit nichts abgeschnitten wird
const titleSize = computed(() => `min(15cqw, ${(118 / Math.max(title.value.length, 1)).toFixed(1)}cqw, 96px)`);
const subtitle = computed(() => {
    if (formation.value) return `Becher ${[...formation.value.cups].sort((a, b) => a - b).join(' · ')} stehen`;
    return props.celebration && look.value.subtitle ? look.value.subtitle(props.celebration.player).replace(/^ · /, '') : '';
});

// ─── Formation: Becher aus Sicht des Werfers, Spitze unten ───
const ROWS = [[7, 8, 9, 10], [4, 5, 6], [2, 3], [1]];
const CUP_SIZE = 40;
const CUP_STEP = 48;
const RACK_WIDTH = CUP_STEP * 3 + CUP_SIZE;
const RACK_HEIGHT = CUP_STEP * .87 * 3 + CUP_SIZE;
const cupCenter = (number: number) => {
    const row = ROWS.findIndex(entry => entry.includes(number));
    const position = ROWS[row].indexOf(number);
    return {
        x: RACK_WIDTH / 2 + (position - (ROWS[row].length - 1) / 2) * CUP_STEP,
        y: CUP_SIZE / 2 + row * CUP_STEP * .87,
    };
};
const formationCups = computed(() => {
    const standing = new Set(formation.value?.cups ?? []);
    let order = 0;
    return ROWS.flat().map(number => {
        const { x, y } = cupCenter(number);
        const isStanding = standing.has(number);
        return {
            number,
            standing: isStanding,
            style: { left: `${x - CUP_SIZE / 2}px`, top: `${y - CUP_SIZE / 2}px`, '--d': `${isStanding ? .15 + (order++) * .07 : 0}s` },
        };
    });
});
// Schneise: Linie durch die fehlenden Becher
const stripeLine = computed(() => {
    const missing = ROWS.flat().filter(number => !formation.value?.cups.includes(number)).map(cupCenter);
    if (missing.length < 2) return null;
    const first = missing[0], last = missing[missing.length - 1];
    const dx = last.x - first.x, dy = last.y - first.y;
    return { x1: first.x - dx * .35, y1: first.y - dy * .35, x2: last.x + dx * .35, y2: last.y + dy * .35 };
});

// Zufall je Animation fest (aus der id), damit sich nichts beim Neuzeichnen verschiebt
const createRandom = (seed: number) => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
};

const particles = computed(() => {
    if (!props.celebration || !look.value.particle) return [];
    const random = createRandom(props.celebration.id % 2147483646 + 1);
    return Array.from({ length: look.value.count }, (_, index) => {
        const angle = random() * Math.PI * 2;
        const distance = 30 + random() * 45;
        return {
            key: index,
            style: {
                '--x': `${(random() * 100).toFixed(1)}%`,
                '--dx': `${(Math.cos(angle) * distance).toFixed(1)}vmin`,
                '--dy': `${(Math.sin(angle) * distance).toFixed(1)}vmin`,
                '--s': (0.6 + random() * 0.9).toFixed(2),
                '--d': `${(random() * 0.5).toFixed(2)}s`,
                '--r': `${Math.round(random() * 720 - 360)}deg`,
                '--h': `${Math.round(random() * 360)}`,
            },
        };
    });
});

// Re-Rack: zehn kleine Becher fliegen durcheinander und ordnen sich zum Dreieck
const rerackCups = computed(() => {
    if (!props.celebration) return [];
    const random = createRandom(props.celebration.id % 2147483646 + 7);
    const cups: { key: number; style: Record<string, string> }[] = [];
    [4, 3, 2, 1].forEach((count, row) => {
        for (let i = 0; i < count; i++) {
            cups.push({
                key: cups.length,
                style: {
                    '--tx': `${((i - (count - 1) / 2) * 34).toFixed(0)}px`,
                    '--ty': `${(row * 30 - 45).toFixed(0)}px`,
                    '--fx': `${((random() - .5) * 320).toFixed(0)}px`,
                    '--fy': `${((random() - .5) * 420).toFixed(0)}px`,
                    '--d': `${(cups.length * 0.04).toFixed(2)}s`,
                },
            });
        }
    });
    return cups;
});
</script>

<style scoped>
.KnechtCelebration{
    position: absolute;
    inset: 0;
    z-index: 25;
    overflow: hidden;
    pointer-events: none;
    container-type: size;
}
.kc-stage{
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
}

/* Lichtblitz in der Farbe der Aktion */
.kc-flash{
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--kc-color) 55%, transparent) 0%, color-mix(in srgb, var(--kc-color) 18%, transparent) 45%, transparent 75%);
    animation: kc-flash 2.2s ease-out both;
}
@keyframes kc-flash{
    0%{ opacity: 0; }
    8%{ opacity: 1; }
    70%{ opacity: .7; }
    100%{ opacity: 0; }
}

/* Schraege Streifen, die durchs Bild fegen */
.kc-stripes{
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
}
.kc-stripe{
    position: absolute;
    width: 160%;
    height: calc(18px + var(--i) * 10px);
    background: var(--kc-color);
    opacity: calc(.9 - var(--i) * .22);
    transform: translateX(-120%) skewX(-24deg) translateY(calc((var(--i) - 2) * 46px));
    animation: kc-stripe 2.2s cubic-bezier(.2, .8, .2, 1) both;
    animation-delay: calc(var(--i) * .05s);
}
@keyframes kc-stripe{
    0%{ transform: translateX(-120%) skewX(-24deg) translateY(calc((var(--i) - 2) * 46px)); }
    22%{ transform: translateX(0) skewX(-24deg) translateY(calc((var(--i) - 2) * 46px)); }
    78%{ transform: translateX(4%) skewX(-24deg) translateY(calc((var(--i) - 2) * 46px)); }
    100%{ transform: translateX(130%) skewX(-24deg) translateY(calc((var(--i) - 2) * 46px)); }
}

/* Titel */
.kc-content{
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    text-align: center;
    animation: kc-slam 2.2s cubic-bezier(.2, .9, .3, 1.2) both;
}
@keyframes kc-slam{
    0%{ transform: scale(3); opacity: 0; filter: blur(6px); }
    14%{ transform: scale(.88); opacity: 1; filter: blur(0); }
    22%{ transform: scale(1.06); }
    30%{ transform: scale(1); }
    80%{ transform: scale(1); opacity: 1; }
    100%{ transform: scale(1.25) translateY(-14px); opacity: 0; }
}
.kc-icon{
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border: 4px solid white;
    border-radius: 50%;
    background: var(--kc-color);
    color: white;
    font-size: 34px;
    box-shadow: 0 8px 0 var(--kc-dark), 0 14px 30px rgba(0, 0, 0, .35);
    animation: kc-icon .7s cubic-bezier(.3, 1.6, .5, 1) .1s both;
}
@keyframes kc-icon{
    0%{ transform: scale(0) rotate(-180deg); }
    100%{ transform: scale(1) rotate(0); }
}
.kc-title{
    font-weight: 900;
    font-style: italic;
    line-height: .95;
    letter-spacing: .01em;
    text-transform: uppercase;
    white-space: nowrap;
    color: white;
    -webkit-text-stroke: 3px var(--kc-dark);
    paint-order: stroke fill;
    text-shadow: 0 6px 0 var(--kc-dark), 0 14px 34px rgba(0, 0, 0, .45);
    transform: skewX(-8deg);
}
.kc-subtitle{
    padding: 5px 14px;
    border-radius: 999px;
    background: var(--kc-dark);
    color: white;
    font-size: 15px;
    font-weight: 800;
    white-space: nowrap;
    box-shadow: 0 6px 16px rgba(0, 0, 0, .3);
    animation: kc-subtitle .5s ease-out .35s both;
}
@keyframes kc-subtitle{
    0%{ transform: translateY(16px); opacity: 0; }
    100%{ transform: translateY(0); opacity: 1; }
}

/* Druckwellen */
.kc-ring{
    position: absolute;
    left: 50%;
    top: 50%;
    width: 120px;
    height: 120px;
    margin: -60px 0 0 -60px;
    border: 6px solid var(--kc-color);
    border-radius: 50%;
    animation: kc-ring 1.1s ease-out both;
    animation-delay: calc(var(--i) * .16s);
}
@keyframes kc-ring{
    0%{ transform: scale(.2); opacity: 1; }
    100%{ transform: scale(5.5); opacity: 0; }
}

/* ─── Partikel ─── */
.kc-particle{
    position: absolute;
    left: 50%;
    top: 50%;
}
/* Bombe: Truemmer fliegen nach aussen */
.kc-particle--debris{
    width: calc(14px * var(--s));
    height: calc(14px * var(--s));
    border-radius: 3px;
    background: var(--kc-color);
    box-shadow: 0 0 10px var(--kc-color);
    animation: kc-burst 1.3s cubic-bezier(.1, .7, .3, 1) both;
    animation-delay: calc(var(--d) * .3);
}
.kc-particle--spark{
    width: calc(10px * var(--s));
    height: calc(10px * var(--s));
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 12px 4px var(--kc-color);
    animation: kc-burst 1.2s ease-out both;
    animation-delay: calc(.15s + var(--d));
}
.kc-particle--star{
    width: calc(18px * var(--s));
    height: calc(18px * var(--s));
    background: var(--kc-color);
    clip-path: polygon(50% 0, 61% 38%, 100% 38%, 68% 61%, 80% 100%, 50% 76%, 20% 100%, 32% 61%, 0 38%, 39% 38%);
    animation: kc-burst 1.4s ease-out both;
    animation-delay: calc(.1s + var(--d));
}
@keyframes kc-burst{
    0%{ transform: translate(-50%, -50%) scale(0) rotate(0); opacity: 1; }
    15%{ opacity: 1; }
    100%{ transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1) rotate(var(--r)); opacity: 0; }
}
/* On Fire: Flammenwand am unteren Rand, einzelne Flammen zuengeln hoch */
.kc-particle--flame,
.kc-particle--ember{
    top: auto;
    bottom: -40px;
    left: var(--x);
}
.kc-particle--flame{
    width: calc(56px * var(--s));
    height: calc(56px * var(--s));
    margin-left: calc(-28px * var(--s));
    /* Tropfen mit Spitze nach oben */
    border-radius: 0 50% 50% 50%;
    background: radial-gradient(circle at 65% 65%, #FFF3B0 0%, #F5A524 30%, #F76B15 60%, #E5484D 100%);
    mix-blend-mode: screen;
    animation: kc-flame 1.1s ease-in both;
    animation-delay: calc(var(--d) * 1.6);
}
@keyframes kc-flame{
    0%{ transform: translateY(0) rotate(225deg) scale(.5); opacity: 0; }
    20%{ opacity: 1; }
    100%{ transform: translateY(-34vh) translateX(calc(var(--dx) * .15)) rotate(225deg) scale(.15); opacity: 0; }
}
.kc--on-fire .kc-flash{
    background:
        linear-gradient(0deg, rgba(229, 72, 77, .85) 0%, rgba(247, 107, 21, .55) 14%, rgba(245, 165, 36, .2) 30%, transparent 48%),
        radial-gradient(circle at 50% 50%, rgba(247, 107, 21, .35) 0%, transparent 70%);
}
.kc-particle--ember{
    width: calc(10px * var(--s));
    height: calc(10px * var(--s));
    background: #FFD27A;
    box-shadow: 0 0 10px 3px var(--kc-color);
    animation: kc-rise 2s ease-out both;
    animation-delay: var(--d);
}
@keyframes kc-rise{
    0%{ transform: translateY(0) scale(.6); opacity: 0; }
    15%{ opacity: 1; }
    100%{ transform: translateY(-75vh) translateX(calc(var(--dx) * .3)) scale(1.1); opacity: 0; }
}
/* Konfetti faellt von oben */
.kc-particle--confetti{
    top: -20px;
    left: var(--x);
    width: calc(9px * var(--s) + 4px);
    height: calc(14px * var(--s) + 4px);
    background: hsl(var(--h) 85% 58%);
    animation: kc-fall 2.2s linear both;
    animation-delay: var(--d);
}
@keyframes kc-fall{
    0%{ transform: translateY(0) rotate(0); opacity: 1; }
    100%{ transform: translateY(105vh) translateX(var(--dx)) rotate(var(--r)); opacity: .8; }
}

/* ─── Baelle ─── */
.kc-ball{
    position: absolute;
    left: 50%;
    top: 50%;
    width: 26px;
    height: 26px;
    margin: -13px 0 0 -13px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, white 0%, #F1F1F1 40%, #C8C8C8 100%);
    box-shadow: 0 4px 10px rgba(0, 0, 0, .35);
}
/* Bouncer: Ball springt quer durchs Bild */
.kc-ball--bounce{
    animation: kc-bounce-x 1.5s linear both, kc-bounce-y 1.5s both;
}
@keyframes kc-bounce-x{
    0%{ translate: -60vw 0; }
    100%{ translate: 60vw 0; }
}
@keyframes kc-bounce-y{
    0%{ transform: translateY(-30vh); animation-timing-function: ease-in; }
    25%{ transform: translateY(14vh); animation-timing-function: ease-out; }
    50%{ transform: translateY(-14vh); animation-timing-function: ease-in; }
    75%{ transform: translateY(14vh); animation-timing-function: ease-out; }
    100%{ transform: translateY(-8vh); }
}
/* Balls Back: zwei Baelle kreisen um den Titel */
.kc-ball--orbit{
    animation: kc-orbit 1.6s cubic-bezier(.4, 0, .2, 1) both;
}
.kc-ball--second{
    animation-delay: -.8s;
}
@keyframes kc-orbit{
    0%{ transform: rotate(0) translateX(150px) scale(.4); opacity: 0; }
    15%{ opacity: 1; }
    85%{ opacity: 1; }
    100%{ transform: rotate(720deg) translateX(150px) scale(1); opacity: 0; }
}
/* Trickshot: Ball dreht eine Schleife */
.kc-ball--loop{
    animation: kc-loop 1.4s ease-in-out both;
}
@keyframes kc-loop{
    0%{ transform: translate(-45vw, 25vh); }
    35%{ transform: translate(-5vw, -22vh); }
    55%{ transform: translate(18vw, -6vh); }
    70%{ transform: translate(4vw, 8vh); }
    85%{ transform: translate(-8vw, -4vh); }
    100%{ transform: translate(45vw, -30vh); opacity: 0; }
}

/* Re-Rack: Becher sortieren sich zum Dreieck */
.kc-rack{
    position: absolute;
    left: 50%;
    top: 50%;
}
.kc-rack-cup{
    position: absolute;
    width: 28px;
    height: 28px;
    margin: -14px 0 0 -14px;
    border: 4px solid white;
    border-radius: 50%;
    background: var(--kc-color);
    box-shadow: 0 4px 10px rgba(0, 0, 0, .3);
    animation: kc-rack 1.6s cubic-bezier(.3, 1.4, .5, 1) both;
    animation-delay: var(--d);
}
@keyframes kc-rack{
    0%{ transform: translate(var(--fx), var(--fy)) scale(.4) rotate(-200deg); opacity: 0; }
    20%{ opacity: 1; }
    55%{ transform: translate(var(--tx), calc(var(--ty) - 130px)) scale(1) rotate(0); opacity: 1; }
    85%{ transform: translate(var(--tx), calc(var(--ty) - 130px)) scale(1); opacity: 1; }
    100%{ transform: translate(var(--tx), calc(var(--ty) - 130px)) scale(.6); opacity: 0; }
}

/* ─── Besonderheiten je Aktion ─── */
.kc--bomb .kc-content{
    animation: kc-slam 2.2s cubic-bezier(.2, .9, .3, 1.2) both, kc-shake .5s linear .25s both;
}
@keyframes kc-shake{
    0%, 100%{ translate: 0 0; }
    15%{ translate: -10px 4px; }
    30%{ translate: 9px -6px; }
    45%{ translate: -7px 6px; }
    60%{ translate: 6px -3px; }
    75%{ translate: -3px 2px; }
}
.kc--on-fire .kc-title{
    background: linear-gradient(0deg, #E5484D 0%, #F76B15 35%, #F5A524 65%, #FFF3B0 100%);
    background-size: 100% 200%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: kc-fire-text .6s linear infinite alternate;
}
@keyframes kc-fire-text{
    0%{ background-position: 0 0; }
    100%{ background-position: 0 100%; }
}
.kc--heating-up .kc-title{
    color: #FFE2C7;
}
.kc--deathcup .kc-flash{
    background: radial-gradient(circle at 50% 50%, rgba(0, 0, 0, .55) 0%, rgba(0, 0, 0, .85) 70%);
    animation: kc-flash 2.2s ease-out both, kc-flicker .18s steps(2) .2s 4;
}
@keyframes kc-flicker{
    50%{ background-color: rgba(255, 0, 0, .25); }
}
.kc--deathcup .kc-title{
    color: #FF4D4D;
    -webkit-text-stroke-color: #000;
}
.kc--deathcup .kc-stripe{
    background: #FF4D4D;
}
.kc--deathcup .kc-icon{
    background: #000;
    color: #FF4D4D;
    animation: kc-icon .7s cubic-bezier(.3, 1.6, .5, 1) .1s both, kc-shake .4s linear .8s 2;
}

/* ─── Formationen ─── */
.kc-formation{
    position: relative;
    width: 184px;
    height: 165px;
    margin-bottom: 6px;
}
.kc-fcup{
    position: absolute;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 2.5px dashed rgba(255, 255, 255, .7);
    border-radius: 50%;
    color: rgba(255, 255, 255, .8);
    font-size: 14px;
    font-weight: 800;
    text-shadow: 0 1px 2px rgba(0, 0, 0, .4);
}
.kc-fcup--on{
    border: 4px solid white;
    background: var(--kc-color);
    color: white;
    box-shadow: 0 5px 0 var(--kc-dark), 0 10px 20px rgba(0, 0, 0, .3);
    animation: kc-fcup-pop .45s cubic-bezier(.3, 1.7, .5, 1) both;
    animation-delay: var(--d);
}
@keyframes kc-fcup-pop{
    0%{ transform: scale(0) translateY(-30px); opacity: 0; }
    100%{ transform: scale(1) translateY(0); opacity: 1; }
}
/* Berliner Mauer: Ziegelmauer waechst hinter der hinteren Reihe hoch und bröckelt */
.kc-wall{
    position: absolute;
    left: -10px;
    right: -10px;
    top: -26px;
    height: 70px;
    border-radius: 4px;
    background:
        linear-gradient(90deg, transparent 47%, rgba(0, 0, 0, .35) 47%, rgba(0, 0, 0, .35) 53%, transparent 53%) 0 0 / 34px 17px,
        linear-gradient(90deg, transparent 47%, rgba(0, 0, 0, .35) 47%, rgba(0, 0, 0, .35) 53%, transparent 53%) 17px 17px / 34px 17px,
        repeating-linear-gradient(0deg, #A0522D 0 14px, rgba(0, 0, 0, .35) 14px 17px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, .35);
    transform-origin: bottom;
    animation: kc-wall 1.9s ease-out both;
}
@keyframes kc-wall{
    0%{ transform: scaleY(0); }
    30%{ transform: scaleY(1); }
    70%{ transform: scaleY(1) rotate(0); opacity: 1; }
    78%{ transform: scaleY(1) rotate(-2deg); }
    86%{ transform: scaleY(1) rotate(2deg); }
    100%{ transform: scaleY(.2) translateY(40px); opacity: 0; }
}
/* Ring of Fire: brennender Ring um die Becher */
.kc-fire-ring{
    position: absolute;
    left: 50%;
    top: 46%;
    width: 210px;
    height: 210px;
    margin: -105px 0 0 -105px;
    border-radius: 50%;
    background: conic-gradient(#E5484D, #F5A524, #FFF3B0, #F76B15, #E5484D, #F5A524, #E5484D);
    -webkit-mask: radial-gradient(circle, transparent 58%, black 60%, black 70%, transparent 72%);
    mask: radial-gradient(circle, transparent 58%, black 60%, black 70%, transparent 72%);
    filter: drop-shadow(0 0 10px #F76B15);
    animation: kc-fire-ring 1.2s linear infinite, kc-fire-ring-in .5s ease-out both;
}
@keyframes kc-fire-ring{
    100%{ rotate: 360deg; }
}
@keyframes kc-fire-ring-in{
    0%{ transform: scale(.3); opacity: 0; }
    100%{ transform: scale(1); opacity: 1; }
}
/* Arschlochbecher: das Loch in der Mitte pulsiert, die Becher drumherum wackeln */
.kc-fcup--hole{
    border: none;
    background: radial-gradient(circle, #1F1F1F 0%, #1F1F1F 45%, transparent 72%);
    color: transparent;
    animation: kc-hole .6s ease-in-out .5s 3 alternate both;
}
@keyframes kc-hole{
    0%{ transform: scale(.8); }
    100%{ transform: scale(1.3); }
}
.kc-formation--hole .kc-fcup--on{
    animation: kc-fcup-pop .45s cubic-bezier(.3, 1.7, .5, 1) both, kc-wobble .25s ease-in-out 4 alternate;
    animation-delay: var(--d), 1s;
}
@keyframes kc-wobble{
    0%{ rotate: -8deg; }
    100%{ rotate: 8deg; }
}
/* Twin Towers: zwei Becher wachsen zu Tuermen */
.kc-fcup--tower{
    border-radius: 4px 4px 50% 50% / 4px 4px 20px 20px;
    background:
        repeating-linear-gradient(90deg, transparent 0 6px, rgba(255, 255, 255, .55) 6px 9px),
        repeating-linear-gradient(0deg, var(--kc-color) 0 7px, var(--kc-dark) 7px 9px);
    animation: kc-fcup-pop .45s cubic-bezier(.3, 1.7, .5, 1) both, kc-tower .9s cubic-bezier(.3, 1.3, .5, 1) both;
    animation-delay: var(--d), .7s;
}
@keyframes kc-tower{
    0%{ height: 40px; translate: 0 0; }
    100%{ height: 120px; translate: 0 -80px; }
}
/* Schneise: Strahl fegt durch die Luecke */
.kc-stripe-line{
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
}
.kc-stripe-line line{
    stroke: white;
    stroke-width: 14;
    stroke-linecap: round;
    stroke-dasharray: 400;
    stroke-dashoffset: 400;
    filter: drop-shadow(0 0 8px var(--kc-color));
    animation: kc-stripe-draw .7s ease-out .6s forwards;
}
@keyframes kc-stripe-draw{
    100%{ stroke-dashoffset: 0; }
}

/* Ein- und Ausblenden */
.kc-enter-active,
.kc-leave-active{
    transition: opacity .2s ease;
}
.kc-enter-from,
.kc-leave-to{
    opacity: 0;
}

@media (prefers-reduced-motion: reduce){
    .kc-stripes, .kc-ring, .kc-particle, .kc-ball, .kc-rack, .kc-wall, .kc-fire-ring{ display: none; }
    .kc-fcup{ animation: none !important; }
    .kc-content, .kc-icon, .kc-subtitle, .kc--on-fire .kc-title{ animation: none; }
}
</style>
