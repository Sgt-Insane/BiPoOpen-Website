<template>
    <section
        v-if="!isReady || slides.length"
        class="HomeHero"
        aria-roledescription="carousel"
        @pointerenter="isHovered = $event.pointerType === 'mouse'"
        @pointerleave="isHovered = false"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @click.capture="onClickCapture"
    >
        <!-- Skeleton bis Daten und erstes Bild da sind -->
        <div v-if="!isReady" class="hh-skeleton">
            <Skeleton width="140px" height="12px" />
            <Skeleton width="70%" height="32px" />
            <Skeleton width="100%" height="64px" borderRadius="12px" class="hh-skeleton-box" />
            <Skeleton width="120px" height="36px" borderRadius="999px" />
        </div>

        <template v-else>
            <!-- Hintergrundbild je Slide, Wechsel per Ueberblendung -->
            <div
                v-for="(slide, index) in slides"
                :key="slide.key"
                class="hh-bg"
                :class="{ 'hh-bg--active': index === activeIndex }"
                :style="slidePhotos[slide.key] ? { backgroundImage: `url(${slidePhotos[slide.key]})` } : {}"
            ></div>
            <div class="hh-shade"></div>

            <!-- Fortschritt: aktiver Balken laeuft voll, danach naechster Slide -->
            <div v-if="slides.length > 1" class="hh-progress">
                <button
                    v-for="(slide, index) in slides"
                    :key="slide.key"
                    type="button"
                    class="hh-progress-segment"
                    :aria-label="`Folie ${index + 1}`"
                    @click="goTo(index)"
                >
                    <span class="hh-progress-track">
                        <span
                            class="hh-progress-fill"
                            :class="{
                                'hh-progress-fill--done': index < activeIndex,
                                'hh-progress-fill--active': index === activeIndex,
                                'hh-progress-fill--paused': isPaused,
                            }"
                            :style="{ animationDuration: `${SLIDE_DURATION}ms` }"
                            @animationend="index === activeIndex && next()"
                        ></span>
                    </span>
                </button>
            </div>

            <div class="hh-content">
                <Transition name="hh-content" mode="out-in">
                    <component :is="activeSlide.component" :key="activeSlide.key" v-bind="activeSlide.props" />
                </Transition>
            </div>
        </template>
    </section>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, type Component } from 'vue';
import Skeleton from 'primevue/skeleton';
import { filterLeagueGames } from '@/components/frontend/league/LeagueUtilFunctions';
import { getCupGames } from '@/components/frontend/league/cup/LeagueCupUtilFunctions';
import { CURRENT_SEASON_SLUG, getSeason } from '@/components/frontend/league/LeagueSeasonsData';
import { getTournamentPodium } from '@/util/tournamentFunctions';
import { NEXT_BIPO_OPEN_START, getDriveThumbnail, getLatestOpenGamesMonth, loadAllTournamentPhotos, shuffle } from './homeUtil';
import SlideCountdown from './slides/SlideCountdown.vue';
import SlideLeague from './slides/SlideLeague.vue';
import SlideLeagueCup from './slides/SlideLeagueCup.vue';
import SlideOpenGames from './slides/SlideOpenGames.vue';
import SlideBiPoOpen from './slides/SlideBiPoOpen.vue';
import SlideNackteMeilen from './slides/SlideNackteMeilen.vue';
import { getNackteMeilen } from '@/components/frontend/nackteMeilen/nackteMeilen';

const props = defineProps<{
    openGames: Match[];
    leagueGames: Match[];
    leagueCup: LeagueCup | null;
    lastTournament: Tournament | null;
    lastTournamentYear: string;
    loading: boolean;
}>();

const SLIDE_DURATION = 7000;
const SWIPE_THRESHOLD = 40;

type HeroSlide = {
    key: string;
    component: Component;
    props: Record<string, unknown>;
};

// ─── Slides ───
// Jeder Slide erscheint nur, wenn es etwas zu zeigen gibt. Reihenfolge immer zufaellig.
const buildSlides = (): HeroSlide[] => {
    const slides: HeroSlide[] = [];

    if (NEXT_BIPO_OPEN_START > Date.now())
        slides.push({ key: 'countdown', component: SlideCountdown, props: {} });

    const season = getSeason(CURRENT_SEASON_SLUG);
    season?.divisions.forEach((division) => {
        const games = filterLeagueGames(props.leagueGames, season.slug, division.league);
        if (games.length)
            slides.push({ key: `league-${division.league}`, component: SlideLeague, props: { games, division, seasonSlug: season.slug } });
    });

    if (props.leagueCup?.rounds.length)
        slides.push({ key: 'cup', component: SlideLeagueCup, props: { leagueCup: props.leagueCup, cupGames: getCupGames(props.leagueGames, props.leagueCup) } });

    const openGamesMonth = getLatestOpenGamesMonth(props.openGames);
    if (openGamesMonth)
        slides.push({ key: 'open-games', component: SlideOpenGames, props: openGamesMonth });

    const nackteMeilen = getNackteMeilen([...props.openGames, ...props.leagueGames]);
    if (nackteMeilen.offen.length || nackteMeilen.absolviert.length)
        slides.push({ key: 'nackte-meilen', component: SlideNackteMeilen, props: nackteMeilen });

    const podium = props.lastTournament ? getTournamentPodium(props.lastTournament) : [];
    if (podium.length)
        slides.push({ key: 'bipo-open', component: SlideBiPoOpen, props: { year: props.lastTournamentYear, podium } });

    return shuffle(slides);
};

const slides = shallowRef<HeroSlide[]>([]);
const activeIndex = ref(0);
const activeSlide = computed(() => slides.value[activeIndex.value]);
const isReady = ref(false);

// ─── Hintergrundbilder ───
// Jeder Slide bekommt ein eigenes zufaelliges Foto aus allen Turnieren.
// Laedt ein Foto nicht, wird das naechste aus dem Pool versucht.
const MAX_PHOTO_ATTEMPTS = 4;

const photoPoolPromise = loadAllTournamentPhotos()
    .then(photos => photos.map(photo => getDriveThumbnail(photo.img_id, 1600)));
let photoPool: string[] = [];

// Slide-Key -> geladenes Foto
const slidePhotos = ref<Record<string, string>>({});

const loadImage = (url: string) => new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
});

const assignPhoto = async (slideKey: string) => {
    for (let attempt = 0; attempt < MAX_PHOTO_ATTEMPTS && photoPool.length; attempt++) {
        const url = photoPool.shift()!;
        if (await loadImage(url)) {
            slidePhotos.value[slideKey] = url;
            return;
        }
    }
};

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

watch(() => props.loading, async (loading) => {
    if (loading || isReady.value) return;

    photoPool = await photoPoolPromise;
    const builtSlides = buildSlides();

    // Auf das erste Bild warten, damit der Slider nicht ohne Hintergrund startet
    if (builtSlides.length)
        await Promise.race([assignPhoto(builtSlides[0].key), wait(4000)]);

    slides.value = builtSlides;
    isReady.value = true;
    builtSlides.slice(1).forEach(slide => assignPhoto(slide.key));
}, { immediate: true });

// ─── Navigation ───
const goTo = (index: number) => {
    const count = slides.value.length;
    activeIndex.value = (index + count) % count;
};
const next = () => goTo(activeIndex.value + 1);
const prev = () => goTo(activeIndex.value - 1);

// Pausiert bei Maus ueber dem Slider und solange der Finger draufliegt
const isHovered = ref(false);
const isHolding = ref(false);
const isPaused = computed(() => isHovered.value || isHolding.value);

// ─── Wischen ───
let pointerStart: { x: number; y: number } | null = null;
let suppressClick = false;

const onPointerDown = (event: PointerEvent) => {
    pointerStart = { x: event.clientX, y: event.clientY };
    isHolding.value = true;
};

const onPointerUp = (event: PointerEvent) => {
    isHolding.value = false;
    if (!pointerStart || slides.value.length < 2) return;

    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;

    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        suppressClick = true;
        if (dx < 0) next();
        else prev();
    }
};

const onPointerCancel = () => {
    isHolding.value = false;
    pointerStart = null;
};

// Nach dem Wischen keinen Button/Link im Slide ausloesen
const onClickCapture = (event: MouseEvent) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
};
</script>

<style scoped>
.HomeHero{
    position: relative;
    height: 460px;
    border-radius: 20px;
    overflow: hidden;
    background: #24272c;
    color: white;
    user-select: none;
    touch-action: pan-y;
    isolation: isolate;
}

/* ─── Hintergrund ─── */
.hh-bg{
    position: absolute;
    inset: 0;
    background-image: linear-gradient(135deg, #4a2a31 0%, #1f3a44 100%);
    background-size: cover;
    background-position: center;
    filter: blur(1px);
    transform: scale(1.03);
    opacity: 0;
    transition: opacity 0.8s ease;
}
.hh-bg--active{
    opacity: 1;
}
.hh-shade{
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg,
        rgba(0, 0, 0, 0.45) 0%,
        rgba(0, 0, 0, 0.1) 25%,
        rgba(0, 0, 0, 0.35) 55%,
        rgba(0, 0, 0, 0.85) 100%);
}

/* ─── Fortschritt ─── */
.hh-progress{
    position: absolute;
    top: 10px;
    left: 16px;
    right: 16px;
    z-index: 2;
    display: flex;
    gap: 6px;
}
.hh-progress-segment{
    flex: 1;
    padding: 6px 0;
    background: none;
    border: 0;
    cursor: pointer;
}
.hh-progress-track{
    display: block;
    height: 3px;
    background: rgba(255, 255, 255, 0.35);
    border-radius: 999px;
    overflow: hidden;
}
.hh-progress-fill{
    display: block;
    height: 100%;
    background: var(--bp-surface);
    border-radius: 999px;
    transform: scaleX(0);
    transform-origin: left;
}
.hh-progress-fill--done{
    transform: scaleX(1);
}
.hh-progress-fill--active{
    animation-name: hh-progress;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
}
.hh-progress-fill--paused{
    animation-play-state: paused;
}
@keyframes hh-progress{
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
}

/* ─── Inhalt ─── */
.hh-content{
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    padding: 32px 36px;
    max-width: 680px;
}
.hh-content-enter-active,
.hh-content-leave-active{
    transition: opacity 0.35s ease, transform 0.35s ease;
}
.hh-content-enter-from{
    opacity: 0;
    transform: translateY(10px);
}
.hh-content-leave-to{
    opacity: 0;
    transform: translateY(-6px);
}

/* ─── Skeleton ─── */
.hh-skeleton{
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 32px 36px;
    max-width: 520px;
}
.hh-skeleton :deep(.p-skeleton){
    background: rgba(255, 255, 255, 0.12);
}

@media (prefers-reduced-motion: reduce){
    .hh-bg,
    .hh-content-enter-active,
    .hh-content-leave-active{
        transition: none;
    }
}

/* MOBILE */
@media (width <= 900px){
    .HomeHero{
        height: 400px;
        border-radius: 18px;
    }
    .hh-content,
    .hh-skeleton{
        padding: 20px 16px;
    }
}
</style>
