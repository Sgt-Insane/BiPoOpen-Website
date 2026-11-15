<template>
    <!-- Grosse, animierte Version eines Piktogramms fuer die Bowling-Animationen. Gleiche Formen wie
         KnechtIcon, aber jedes benannte Teil (part) bewegt sich je nach Aktion anders. -->
    <svg class="KnechtCelebrationIcon" :class="`kci--${kind}`" viewBox="-2 -2 28 28" aria-hidden="true">
        <template v-for="(shape, index) in shapes" :key="index">
            <!-- Ball, der eine Flugbahn entlangfliegt (Bouncer, Trickshot) -->
            <!-- Chrome bewegt den Ball nur mit Startverzoegerung (begin); bis dahin ist er ausgeblendet -->
            <circle v-if="'r' in shape && shape.part === 'ball' && motion" cx="0" cy="0" :r="shape.r" :class="classes(shape)" class="kci-moving">
                <animateMotion :path="motion.path" :dur="motion.dur" begin=".25s" fill="freeze" />
            </circle>
            <circle v-else-if="'r' in shape" :cx="shape.cx" :cy="shape.cy" :r="shape.r" :class="classes(shape)" />
            <path v-else :d="shape.d" :class="classes(shape)" />
        </template>
    </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { KNECHT_ICONS, type KnechtIconName, type KnechtIconShape } from './knechtIcons';

const props = defineProps<{ name: KnechtIconName; kind: string }>();

const shapes = computed<KnechtIconShape[]>(() => KNECHT_ICONS[props.name]);

// Flugbahn des Balls: die gestrichelte Linie des Symbols, danach in den Becher bzw. davon
const MOTIONS: Partial<Record<KnechtIconName, { path: string; dur: string }>> = {
    bouncer: { path: 'M2.5 3.5L7 20.5l4.5-9Q15.5 6 18.2 16.5', dur: '1s' },
    trickshot: { path: 'M2 19c4 0 8-2 9-6s-3-5-4-2 3 5 7 2 5-6 5-8', dur: '1s' },
};
const motion = computed(() => MOTIONS[props.name] ?? null);

const classes = (shape: KnechtIconShape) => [
    shape.part ? `kci-${shape.part}` : null,
    {
        'kci-fill': shape.fill,
        'kci-soft': shape.soft,
        'kci-ball': 'ball' in shape && shape.ball,
        'kci-dashed': 'dashed' in shape && shape.dashed,
    },
];
</script>

<style scoped>
.KnechtCelebrationIcon{
    width: 100%;
    height: 100%;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.KnechtCelebrationIcon *{
    transform-box: view-box;
}
.kci-fill{ fill: currentColor; stroke: none; }
.kci-soft{ fill: color-mix(in srgb, currentColor 28%, transparent); }
.kci-ball{ fill: white; stroke: var(--kc-dark, #333); }
.kci-dashed{ stroke-dasharray: 2.2 2.2; }
.kci-moving{ animation: kci-appear .01s linear .25s both; }
@keyframes kci-appear{
    0%{ opacity: 0; }
    100%{ opacity: 1; }
}

/* ─── Bombe: Becher landet, Explosion platzt heraus, Kern flackert ─── */
.kci--bomb .kci-cup{ transform-origin: 12px 22px; animation: kci-land .35s cubic-bezier(.3, 1.5, .5, 1) .1s both; }
.kci--bomb .kci-burst{ transform-origin: 12px 13.8px; animation: kci-burst .5s cubic-bezier(.2, 1.6, .4, 1) .4s both, kci-throb .28s ease-in-out .9s 4 alternate; }
.kci--bomb .kci-core{ transform-origin: 12px 13.8px; animation: kci-burst .4s cubic-bezier(.2, 1.6, .4, 1) .5s both, kci-flicker .12s steps(2) .9s 8; }
@keyframes kci-land{
    0%{ transform: translateY(-14px) scale(.6); opacity: 0; }
    100%{ transform: none; opacity: 1; }
}
@keyframes kci-burst{
    0%{ transform: scale(0); }
    100%{ transform: scale(1); }
}
@keyframes kci-throb{
    100%{ transform: scale(1.12); }
}
@keyframes kci-flicker{
    50%{ opacity: .45; }
}

/* ─── Balls Back: die Pfeile drehen sich um den Ball, der Ball springt zurueck ─── */
.kci--ballsback .kci-arrows{ transform-origin: 12px 12px; animation: kci-spin 1.3s cubic-bezier(.5, 0, .2, 1) .15s both; }
.kci--ballsback .kci-ball{ transform-origin: 12px 12px; animation: kci-pop .45s cubic-bezier(.3, 1.8, .5, 1) 1.2s both; }
@keyframes kci-spin{
    0%{ transform: rotate(-200deg) scale(.6); opacity: 0; }
    20%{ opacity: 1; }
    100%{ transform: rotate(360deg) scale(1); }
}
@keyframes kci-pop{
    0%{ transform: scale(1); }
    50%{ transform: scale(1.7); }
    100%{ transform: scale(1); }
}

/* ─── On Fire: Flamme lodert ─── */
.kci--on-fire .kci-flame{ transform-origin: 12px 20px; animation: kci-grow .4s cubic-bezier(.3, 1.6, .5, 1) .1s both, kci-lick .22s ease-in-out .5s infinite alternate; }
.kci--on-fire .kci-core{ transform-origin: 12px 20px; animation: kci-grow .4s cubic-bezier(.3, 1.6, .5, 1) .25s both, kci-lick .18s ease-in-out .6s infinite alternate-reverse; }
@keyframes kci-grow{
    0%{ transform: scaleY(0) scaleX(.5); }
    100%{ transform: none; }
}
@keyframes kci-lick{
    0%{ transform: scaleY(.92) skewX(-5deg); }
    100%{ transform: scaleY(1.08) skewX(5deg); }
}

/* ─── Heaten Up: Thermometer steigt ─── */
.kci--heating-up .kci-mercury{ transform-origin: 12px 17px; animation: kci-rise 1.1s cubic-bezier(.4, 0, .2, 1) .3s both; }
.kci--heating-up .kci-bulb{ transform-origin: 12px 17px; animation: kci-pop .5s ease-out .2s both, kci-pop .5s ease-out 1.4s both; }
@keyframes kci-rise{
    0%{ transform: scaleY(0); }
    100%{ transform: scaleY(1); }
}

/* ─── Letzter Becher: Fahnenmast waechst aus dem Becher, Fahne weht ─── */
.kci--lastcup .kci-cup{ transform-origin: 12px 21px; animation: kci-land .35s cubic-bezier(.3, 1.5, .5, 1) .1s both; }
.kci--lastcup .kci-pole{ transform-origin: 12px 9.5px; animation: kci-grow .4s cubic-bezier(.3, 1.4, .5, 1) .4s both; }
.kci--lastcup .kci-flag{ transform-origin: 12px 4.2px; animation: kci-unfurl .35s ease-out .75s both, kci-wave .3s ease-in-out 1.1s infinite alternate; }
@keyframes kci-unfurl{
    0%{ transform: scaleX(0); }
    100%{ transform: none; }
}
@keyframes kci-wave{
    0%{ transform: skewY(-8deg) scaleX(.95); }
    100%{ transform: skewY(6deg); }
}

/* ─── Deathcup: Schaedel zittert, Augen blinzeln, Kiefer klappert ─── */
.kci--deathcup{ animation: kci-shake .4s linear .3s 3; }
.kci--deathcup .kci-eye{ transform-origin: 12px 10.5px; animation: kci-blink .5s ease-in-out .6s 2; }
.kci--deathcup .kci-jaw{ animation: kci-chatter .12s linear .3s 10 alternate; }
@keyframes kci-shake{
    0%, 100%{ transform: none; }
    25%{ transform: translate(-1.5px, 1px) rotate(-4deg); }
    75%{ transform: translate(1.5px, -1px) rotate(4deg); }
}
@keyframes kci-blink{
    50%{ transform: scaleY(.1); }
}
@keyframes kci-chatter{
    100%{ transform: translateY(1.2px); }
}

/* ─── Nachwurf: Waage pendelt ─── */
.kci--nachwurf .kci-beam{ transform-origin: 12px 7px; animation: kci-balance 1.5s ease-in-out .2s both; }
@keyframes kci-balance{
    0%{ transform: rotate(-18deg); }
    35%{ transform: rotate(14deg); }
    65%{ transform: rotate(-7deg); }
    100%{ transform: rotate(0); }
}

/* ─── Verlaengerung: Sanduhr wird umgedreht ─── */
.kci--overtime .kci-glass{ transform-origin: 12px 12px; animation: kci-flip .8s cubic-bezier(.5, 0, .2, 1.3) .35s both; }
@keyframes kci-flip{
    0%{ transform: rotate(0); }
    100%{ transform: rotate(180deg); }
}

/* ─── Bouncer und Trickshot: Bahn erscheint, Ball fliegt sie entlang ─── */
.kci--bouncer .kci-trail,
.kci--trickshot .kci-trail,
.kci--trickshot-hit .kci-trail{ animation: kci-fade .4s ease-out both; }
.kci--bouncer .kci-cup{ transform-origin: 18.2px 21.3px; animation: kci-bump .3s ease-out 1.3s both; }
.kci--trickshot .kci-plus,
.kci--trickshot-hit .kci-plus{ transform-origin: 18px 17.5px; animation: kci-burst .4s cubic-bezier(.3, 1.8, .5, 1) 1.2s both; }
@keyframes kci-fade{
    0%{ opacity: 0; }
    100%{ opacity: .9; }
}
@keyframes kci-bump{
    50%{ transform: scaleY(.8) scaleX(1.15); }
}

/* ─── Re-Rack: Becher ploppen nacheinander auf ─── */
.kci--rerack .kci-c1,
.kci--rerack .kci-c2,
.kci--rerack .kci-c3{ transform-origin: center; transform-box: fill-box; animation: kci-burst .4s cubic-bezier(.3, 1.8, .5, 1) both; }
.kci--rerack .kci-c1{ animation-delay: .2s; }
.kci--rerack .kci-c2{ animation-delay: .4s; }
.kci--rerack .kci-c3{ animation-delay: .6s; }

/* ─── Karten: werden hochgehalten wie vom Schiri ─── */
.kci--yellow-card .kci-card,
.kci--red-card .kci-card{ transform-origin: 12px 22px; animation: kci-show .5s cubic-bezier(.3, 1.5, .5, 1) .15s both, kci-wiggle .25s ease-in-out .7s 3 alternate; }
/* Karte in echter Farbe (der Kreis dahinter ist dunkel, siehe KnechtCelebration) */
.kci--yellow-card .kci-card.kci-soft{ fill: #F5C518; }
.kci--red-card .kci-card.kci-soft{ fill: #E5484D; }
@keyframes kci-show{
    0%{ transform: translateY(14px) rotate(-30deg); opacity: 0; }
    100%{ transform: rotate(-8deg); opacity: 1; }
}
@keyframes kci-wiggle{
    0%{ transform: rotate(-8deg); }
    100%{ transform: rotate(6deg); }
}

@media (prefers-reduced-motion: reduce){
    .KnechtCelebrationIcon, .KnechtCelebrationIcon *{ animation: none !important; }
}
</style>
