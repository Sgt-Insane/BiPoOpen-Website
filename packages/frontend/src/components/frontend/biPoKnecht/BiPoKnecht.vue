<template>
    <div class="BiPoKnecht" :class="[`kn--${mode}`, { 'kn--rotate': rotateBoard }]">
        <div class="kn-board" :class="`kn-board--bar-${barSide}`">
            <KnechtSideBar
                v-if="game.isStarted.value"
                :side="barSide"
                :canUndo="game.canUndo.value"
                @undo="game.undo()"
                @scoreboard="sheet = 'scoreboard'"
                @timeline="sheet = 'timeline'"
                @menu="sheet = 'menu'"
                @move="moveBar"
            />

            <!-- Spielermodus: Handy liegt auf dem Tisch, jedes Team tippt an seinem Tischende -->
            <div v-if="mode === 'player'" class="kn-field kn-field--player">
                <KnechtPlayers :game="game" :teamIndex="topTeam" rotated :compact="!isThrowing(topTeam)" />
                <div class="kn-end" :class="{ 'kn-end--target': isTarget(topTeam) }">
                    <KnechtRack :game="game" :teamIndex="topTeam" direction="up" :isTarget="isTarget(topTeam)">
                        <template #front><KnechtControls v-if="isTarget(topTeam)" :game="game" :trickshotActive="sheet === 'trickshot'" @trickshot="openTrickshot" /></template>
                    </KnechtRack>
                </div>
                <div class="kn-end" :class="{ 'kn-end--target': isTarget(bottomTeam) }">
                    <KnechtRack :game="game" :teamIndex="bottomTeam" :direction="isTarget(bottomTeam) ? 'up' : 'down'" :isTarget="isTarget(bottomTeam)" :rotated="isTarget(bottomTeam)">
                        <template #front><KnechtControls v-if="isTarget(bottomTeam)" :game="game" :trickshotActive="sheet === 'trickshot'" @trickshot="openTrickshot" /></template>
                    </KnechtRack>
                </div>
                <KnechtPlayers :game="game" :teamIndex="bottomTeam" :compact="!isThrowing(bottomTeam)" />
            </div>

            <!-- Schiedsrichter: Tisch von der Seite, quer -->
            <div v-else class="kn-field kn-field--referee">
                <div v-for="teamIndex in [leftTeam, rightTeam]" :key="teamIndex" class="kn-end" :class="{ 'kn-end--target': isTarget(teamIndex) }">
                    <div class="kn-end-rack">
                        <KnechtRack :game="game" :teamIndex="teamIndex" :direction="teamIndex === leftTeam ? 'left' : 'right'" :isTarget="isTarget(teamIndex)">
                            <template #front><KnechtControls v-if="isTarget(teamIndex)" :game="game" :trickshotActive="sheet === 'trickshot'" @trickshot="openTrickshot" /></template>
                        </KnechtRack>
                    </div>
                    <KnechtPlayers :game="game" :teamIndex="teamIndex" :compact="!isThrowing(teamIndex)" />
                </div>
            </div>

            <!-- Aktions-Banner -->
            <transition name="kn-banner">
                <div v-if="game.banner.value && BANNERS[game.banner.value]" class="kn-banner" :class="`kn-banner--${game.banner.value}`" :style="{ transform: bannerTransform }">
                    <KnechtIcon :name="BANNERS[game.banner.value]!.icon" />
                    {{ BANNERS[game.banner.value]!.text }}
                </div>
            </transition>

            <!-- Wer faengt an? -->
            <div v-if="!game.isStarted.value" class="kn-overlay">
                <KnechtStartTeam :match="game.match" @start="startGame" @cancel="$emit('exit')" />
            </div>

            <!-- Pause -->
            <div v-if="paused" class="kn-overlay">
                <div class="kn-pause-card">
                    <div class="kn-pause-title">⏸ Pause</div>
                    <div class="kn-pause-score">{{ getTeamName(game.match, 0) }} {{ formatPoints(teamPoints[0]) }} : {{ formatPoints(teamPoints[1]) }} {{ getTeamName(game.match, 1) }}</div>
                    <button type="button" class="kn-menu-button kn-menu-button--primary" @click="paused = false">Weiterspielen</button>
                </div>
            </div>

            <!-- Sicherheitsabfrage (Spiel abbrechen, Deathcup) -->
            <transition name="kn-confirm">
                <div v-if="confirmDialog" class="kn-overlay kn-confirm" @click.self="confirmDialog = null">
                    <div class="kn-confirm-card" :style="{ transform: sheetFlipped ? 'rotate(180deg)' : undefined }">
                        <div class="kn-confirm-icon"><KnechtIcon :name="confirmDialog.icon" /></div>
                        <div class="kn-confirm-title">{{ confirmDialog.title }}</div>
                        <div class="kn-confirm-text">{{ confirmDialog.text }}</div>
                        <div class="kn-confirm-actions">
                            <button type="button" class="kn-menu-button" @click="confirmDialog = null">Zurück</button>
                            <button type="button" class="kn-menu-button kn-menu-button--primary" @click="confirmDialog.action(); confirmDialog = null">{{ confirmDialog.confirmLabel }}</button>
                        </div>
                    </div>
                </div>
            </transition>

            <!-- Sheets -->
            <KnechtSheet :visible="sheet === 'scoreboard'" title="Punktestand" :flipped="sheetFlipped" @update:visible="sheet = null">
                <KnechtScoreboard :match="game.match" :state="game.state.value" />
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'timeline'" title="Spielverlauf" subtitle="Neueste Würfe oben" :flipped="sheetFlipped" @update:visible="sheet = null">
                <KnechtTimeline :match="game.match" :state="game.state.value" newestFirst />
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'trickshot'" title="Trickshot" :subtitle="`${throwerName} hat verfehlt – wer hat den Ball gefangen?`" :flipped="sheetFlipped" @update:visible="sheet = null">
                <div class="kn-menu-list">
                    <button v-for="(player, playerIndex) in activeTeam.players" :key="playerIndex" type="button" class="kn-menu-button" @click="catchTrickshot(playerIndex)">
                        <KnechtIcon name="trickshot" /> {{ player.name }} wirft den Trickshot
                    </button>
                </div>
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'ownCup'" title="Eigene Becher runter" :flipped="sheetFlipped" @update:visible="sheet = null">
                <KnechtOwnCup :game="game" @done="sheet = null" />
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'menu'" title="Menü" :flipped="sheetFlipped" @update:visible="sheet = null">
                <div class="kn-menu-list">
                    <div class="kn-menu-label">Modus</div>
                    <SelectButton :modelValue="mode" :options="MODE_OPTIONS" optionLabel="label" optionValue="value" :allowEmpty="false" fluid @update:modelValue="setMode" />
                    <button type="button" class="kn-menu-button" @click="swapSides">
                        <i class="pi pi-sync"></i> Seiten tauschen
                    </button>
                    <button type="button" class="kn-menu-button" @click="game.sound.toggleMute()">
                        <i :class="game.sound.isMuted.value ? 'pi pi-volume-off' : 'pi pi-volume-up'"></i>
                        Ton {{ game.sound.isMuted.value ? 'einschalten' : 'ausschalten' }}
                    </button>

                    <div class="kn-menu-label">Sonderfälle</div>
                    <button type="button" class="kn-menu-button" @click="sheet = 'ownCup'"><KnechtIcon name="owncup" /> Eigene Becher runtergeworfen</button>
                    <button type="button" class="kn-menu-button kn-menu-button--danger" @click="confirmDeathcup"><KnechtIcon name="deathcup" /> Deathcup von {{ throwerName }}</button>

                    <div class="kn-menu-label">Spiel</div>
                    <button type="button" class="kn-menu-button" @click="pause">
                        <i class="pi pi-pause"></i> Pause
                    </button>
                    <button type="button" class="kn-menu-button" @click="$emit('leave')">
                        <i class="pi pi-sign-out"></i> Zur Webseite (Spiel bleibt gespeichert)
                    </button>
                    <button type="button" class="kn-menu-button kn-menu-button--danger" @click="confirmAbort">
                        <i class="pi pi-times"></i> Spiel abbrechen
                    </button>
                </div>
            </KnechtSheet>
        </div>

        <!-- Wo der Ball gelandet ist (Bildschirmkoordinaten, ausserhalb des gedrehten Feldes) -->
        <span
            v-if="game.ballMark.value"
            :key="game.ballMark.value.id"
            class="kn-ball"
            :class="`kn-ball--${game.ballMark.value.kind}`"
            :style="{ left: `${game.ballMark.value.x}px`, top: `${game.ballMark.value.y}px` }"
        ></span>

        <!-- Spielende -->
        <KnechtGameOver v-if="game.isOver.value" :game="game" :refereeUsed="refereeUsed" @saved="(result, rematch) => $emit('saved', result, rematch)" />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import SelectButton from 'primevue/selectbutton';
import { useToast } from 'primevue/usetoast';
import KnechtRack from './KnechtRack.vue';
import KnechtPlayers from './KnechtPlayers.vue';
import KnechtControls from './KnechtControls.vue';
import KnechtSideBar from './KnechtSideBar.vue';
import KnechtSheet from './KnechtSheet.vue';
import KnechtScoreboard from './KnechtScoreboard.vue';
import KnechtTimeline from './KnechtTimeline.vue';
import KnechtOwnCup from './KnechtOwnCup.vue';
import KnechtStartTeam from './KnechtStartTeam.vue';
import KnechtGameOver from './KnechtGameOver.vue';
import KnechtIcon from './KnechtIcon.vue';
import type { KnechtIconName } from './knechtIcons';
import { getTeamPoints, type BannerEvent, type KnechtAction } from './knechtEngine';
import { formatPoints, getPlayerName, getTeam, getTeamName } from './KnechtUtilFunctions';
import { useBiPoKnecht, type KnechtMode } from './useBiPoKnecht';
import { enterFullscreen, exitFullscreen, lockLandscape, releaseWakeLock, requestWakeLock, unlockOrientation } from './knechtScreen';

const props = defineProps<{
    match: Match;
    startTeamIndex: number | null;
    actions: KnechtAction[];
    refereeUsed: boolean;
}>();

const emit = defineEmits<{
    exit: [];                                       // abbrechen, Spiel verwerfen
    leave: [];                                      // zur Webseite, Spiel bleibt gespeichert
    saved: [match: Match, rematch: boolean];
    change: [progress: { startTeamIndex: number | null; actions: KnechtAction[]; refereeUsed: boolean }];
}>();

const game = useBiPoKnecht(props.match, props.startTeamIndex, props.actions);
const toast = useToast();

// ─── Einstellungen (bleiben fuer das naechste Spiel erhalten) ───
const MODE_KEY = 'bipo_knecht_mode';
const BAR_KEY = 'bipo_knecht_bar';
const MODE_OPTIONS = [{ label: 'Spieler', value: 'player' }, { label: 'Schiedsrichter', value: 'referee' }];

const mode = ref<KnechtMode>(localStorage.getItem(MODE_KEY) === 'referee' ? 'referee' : 'player');
const barSide = ref<'left' | 'right'>(localStorage.getItem(BAR_KEY) === 'left' ? 'left' : 'right');
const swapped = ref(false);
const refereeUsed = ref(props.refereeUsed || mode.value === 'referee');
const paused = ref(false);
const sheet = ref<'scoreboard' | 'timeline' | 'menu' | 'trickshot' | 'ownCup' | null>(null);

const setMode = (value: KnechtMode) => {
    mode.value = value;
    localStorage.setItem(MODE_KEY, value);
    if (value === 'referee') {
        refereeUsed.value = true;
        lockLandscape();
    } else {
        unlockOrientation();
    }
    sheet.value = null;
};

const moveBar = () => {
    barSide.value = barSide.value === 'right' ? 'left' : 'right';
    localStorage.setItem(BAR_KEY, barSide.value);
};

const swapSides = () => {
    swapped.value = !swapped.value;
    sheet.value = null;
};

const pause = () => {
    paused.value = true;
    sheet.value = null;
};

// Schiedsrichter haelt das Handy quer. Dreht der Browser nicht mit, dreht der Knecht das Feld selbst.
const orientationQuery = window.matchMedia('(orientation: portrait)');
const isPortrait = ref(orientationQuery.matches);
const onOrientationChange = (event: MediaQueryListEvent) => { isPortrait.value = event.matches; };
const rotateBoard = computed(() => mode.value === 'referee' && isPortrait.value);

// ─── Feld ───
const state = computed(() => game.state.value);
const teamPoints = computed(() => getTeamPoints(state.value));

// Spielermodus: Team 1 (rot) steht unten, getauscht oben. Schiedsrichter: Team 1 wirft von links.
// Am Tischende eines Teams stehen dessen Becher und (im Spielermodus) dessen Spieler.
const bottomTeam = computed(() => swapped.value ? 1 : 0);
const topTeam = computed(() => 1 - bottomTeam.value);
const leftTeam = computed(() => swapped.value ? 1 : 0);
const rightTeam = computed(() => 1 - leftTeam.value);

const isThrowing = (teamIndex: number) => game.isStarted.value && state.value.status === 'playing' && state.value.activeTeamIndex === teamIndex;
const isTarget = (teamIndex: number) => game.isStarted.value && state.value.status === 'playing' && state.value.activeTeamIndex !== teamIndex;

const activeTeam = computed(() => getTeam(game.match, state.value.activeTeamIndex));
const throwerName = computed(() => getPlayerName(game.match, state.value.activeTeamIndex, game.selectedPlayer.value));

// Sheets und Banner zeigen zum werfenden Team (Spielermodus, Team am oberen Tischende)
const sheetFlipped = computed(() => mode.value === 'player' && state.value.activeTeamIndex === topTeam.value);
const bannerTransform = computed(() => `translate(-50%, -50%)${sheetFlipped.value ? ' rotate(180deg)' : ''}`);

const BANNERS: Partial<Record<NonNullable<BannerEvent>, { icon: KnechtIconName; text: string }>> = {
    'heating-up': { icon: 'heating', text: 'Heating Up!' },
    'on-fire': { icon: 'onfire', text: 'On Fire!' },
    bomb: { icon: 'bomb', text: 'Bombe! Balls Back!' },
    ballsback: { icon: 'ballsback', text: 'Balls Back!' },
    nachwurf: { icon: 'nachwurf', text: "Gentleman's Rule – Nachwurf!" },
    overtime: { icon: 'overtime', text: 'Verlängerung (2×3)!' },
    deathcup: { icon: 'deathcup', text: 'Deathcup!' },
};

// ─── Sicherheitsabfrage ───
type ConfirmDialog = { icon: KnechtIconName; title: string; text: string; confirmLabel: string; action: () => void };
const confirmDialog = ref<ConfirmDialog | null>(null);

// ─── Aktionen ───
const openTrickshot = () => {
    // Umschalter: ein noch nicht geworfener Trickshot wird beim erneuten Tippen zurueckgenommen
    if (game.trickshotPending.value) return game.undo();
    // Im 1 gegen 1 faengt nur einer: kein Auswahl-Sheet
    if (activeTeam.value.players.length === 1) game.trickshot(0);
    else sheet.value = 'trickshot';
};

const catchTrickshot = (catcher: number) => {
    game.trickshot(catcher);
    sheet.value = null;
};

const confirmDeathcup = () => {
    sheet.value = null;
    confirmDialog.value = {
        icon: 'deathcup',
        title: 'Deathcup?',
        text: `Hat ${throwerName.value} wirklich in einen getroffenen, noch nicht ausgetrunkenen Becher getroffen? Das Spiel endet sofort.`,
        confirmLabel: 'Ja, Deathcup',
        action: () => game.deathcup(),
    };
};

const confirmAbort = () => {
    sheet.value = null;
    confirmDialog.value = {
        icon: 'miss',
        title: 'Spiel wirklich beenden?',
        text: 'Das Spiel wird abgebrochen und nicht gespeichert.',
        confirmLabel: 'Ja, abbrechen',
        action: () => emit('exit'),
    };
};

const startGame = (teamIndex: number) => {
    game.match.time = new Date().getTime();
    game.start(teamIndex);
    enterFullscreen();
    requestWakeLock();
    if (mode.value === 'referee') lockLandscape();
};

// ─── Fortschritt melden (wird im localStorage gesichert) ───
watch([game.actions, game.startTeamIndex, refereeUsed], () => {
    emit('change', { startTeamIndex: game.startTeamIndex.value, actions: game.actions.value, refereeUsed: refereeUsed.value });
});

watch(game.isOver, (isOver) => {
    sheet.value = null;
    paused.value = false;
    if (isOver) {
        releaseWakeLock();
        exitFullscreen();
        unlockOrientation();
    } else if (game.isStarted.value) {
        requestWakeLock();
    }
});

onMounted(() => {
    orientationQuery.addEventListener('change', onOrientationChange);
    if (game.isStarted.value && !game.isOver.value) requestWakeLock();
    if (game.droppedActions)
        toast.add({ severity: 'warn', summary: `${game.droppedActions} Einträge passten nicht mehr zu den aktuellen Regeln und wurden entfernt`, life: 6000 });
});

onUnmounted(() => {
    orientationQuery.removeEventListener('change', onOrientationChange);
    releaseWakeLock();
    unlockOrientation();
    exitFullscreen();
});
</script>

<style scoped>
.BiPoKnecht{
    position: fixed;
    inset: 0;
    z-index: 1000;
    overflow: hidden;
    background: var(--page-gray);
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
}

.kn-board{
    position: absolute;
    inset: 0;
    display: flex;
}
.kn-board--bar-left{ flex-direction: row; }
.kn-board--bar-right{ flex-direction: row-reverse; }

/* Schiedsrichter im Hochformat: Feld um 90 Grad gedreht */
.kn--rotate .kn-board{
    inset: auto;
    top: 0;
    left: 100dvw;
    width: 100dvh;
    height: 100dvw;
    transform: rotate(90deg);
    transform-origin: top left;
}

.kn-field{
    position: relative;
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
}
.kn-field--player{ flex-direction: column; }
.kn-field--referee{ flex-direction: row; }

.kn-end{
    display: flex;
    flex: 3 1 0;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    transition: flex-grow .35s cubic-bezier(.4, 0, .2, 1);
}
.kn-end--target{
    flex-grow: 7;
}
.kn-end-rack{
    flex: 1;
    min-height: 0;
}
.kn-field--referee .kn-end + .kn-end{
    border-left: 2px solid var(--bp-surface);
}
.kn-field--player .kn-end + .kn-end{
    border-top: 2px solid var(--bp-surface);
}

/* ─── Overlays ─── */
.kn-overlay{
    position: absolute;
    inset: 0;
    z-index: 25;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(31, 35, 40, .45);
}
.kn-pause-card{
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(360px, 100%);
    padding: 20px;
    border-radius: 20px;
    background: var(--bp-surface);
    text-align: center;
}
.kn-pause-title{
    font-size: 26px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.kn-pause-score{
    font-size: 14px;
    font-weight: 600;
    color: var(--bp-text-muted);
}

/* ─── Ball ─── */
.kn-ball{
    position: absolute;
    z-index: 24;
    width: 18px;
    height: 18px;
    margin: -9px 0 0 -9px;
    border-radius: 50%;
    background: var(--bp-surface);
    box-shadow: 0 0 0 1px rgba(31, 35, 40, .12), 0 3px 6px rgba(31, 35, 40, .25);
    pointer-events: none;
    animation: kn-ball-drop 1.5s ease-out forwards;
}
.kn-ball--airball{
    animation-name: kn-ball-fly;
}
.kn-ball--hit{
    width: 26px;
    height: 26px;
    margin: -13px 0 0 -13px;
    background: transparent;
    box-shadow: 0 0 0 3px rgba(255, 255, 255, .9);
    animation-name: kn-ball-splash;
    animation-duration: .7s;
}
/* Nullwurf: Ball faellt auf den Tisch, springt nach und bleibt kurz liegen */
@keyframes kn-ball-drop{
    0%{ transform: scale(1.9); opacity: 0; }
    20%{ transform: scale(1); opacity: 1; }
    32%{ transform: scale(1.18); }
    44%{ transform: scale(1); }
    52%{ transform: scale(1.06); }
    60%{ transform: scale(1); }
    80%{ opacity: 1; }
    100%{ transform: scale(1); opacity: 0; }
}
/* Airball: Ball fliegt heran, wird kleiner und verschwindet hinter dem Tisch */
@keyframes kn-ball-fly{
    0%{ transform: scale(2.2); opacity: 0; }
    15%{ opacity: 1; }
    55%{ transform: scale(.9); opacity: 1; }
    100%{ transform: scale(.55); opacity: 0; }
}
/* Treffer: kurzer Spritzer im Becher */
@keyframes kn-ball-splash{
    0%{ transform: scale(.4); opacity: 1; }
    100%{ transform: scale(2.6); opacity: 0; }
}

/* ─── Banner ─── */
.kn-banner{
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 22px;
    border-radius: 18px;
    background: #1F2328;
    color: white;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 12px 30px rgba(0, 0, 0, .25);
}
.kn-banner--bomb{ background: var(--main-color); }
.kn-banner--ballsback{ background: var(--secondary-color); }
.kn-banner--on-fire{ background: linear-gradient(90deg, #E5484D, #F76B15, #F5A524); }
.kn-banner--heating-up{ background: #F76B15; }
.kn-banner--nachwurf{ background: #1F8A70; }
.kn-banner--overtime{ background: #F5A524; color: #1F2328; }
.kn-banner--deathcup{ background: #111; color: #FF6B6B; }
.kn-banner-enter-active,
.kn-banner-leave-active{
    transition: opacity .25s ease;
}
.kn-banner-enter-from,
.kn-banner-leave-to{
    opacity: 0;
}

/* ─── Sicherheitsabfrage ─── */
.kn-confirm{
    z-index: 30;
}
.kn-confirm-card{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: min(340px, 100%);
    padding: 22px 18px 18px;
    border-radius: 20px;
    background: var(--bp-surface);
    text-align: center;
    box-shadow: 0 18px 40px rgba(0, 0, 0, .25);
}
.kn-confirm-icon{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--bp-primary-faint);
    color: var(--main-color);
    font-size: 30px;
}
.kn-confirm-title{
    font-size: 20px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.kn-confirm-text{
    font-size: 14px;
    color: var(--bp-text-muted);
}
.kn-confirm-actions{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
    margin-top: 8px;
}
.kn-confirm-actions .kn-menu-button{
    justify-content: center;
}
.kn-confirm-enter-active,
.kn-confirm-leave-active{
    transition: opacity .2s ease;
}
.kn-confirm-enter-active .kn-confirm-card{
    animation: kn-pop .32s cubic-bezier(.34, 1.56, .64, 1);
}
.kn-confirm-leave-active .kn-confirm-card{
    transition: scale .2s ease;
    scale: .92;
}
.kn-confirm-enter-from,
.kn-confirm-leave-to{
    opacity: 0;
}
.kn-confirm-enter-active .kn-confirm-icon{
    animation: kn-shake .5s ease .15s;
}
@keyframes kn-pop{
    from{ scale: .7; opacity: 0; }
    to{ scale: 1; opacity: 1; }
}
@keyframes kn-shake{
    0%, 100%{ rotate: 0deg; }
    25%{ rotate: -12deg; }
    50%{ rotate: 10deg; }
    75%{ rotate: -6deg; }
}

/* ─── Menue ─── */
.kn-menu-list{
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.kn-menu-label{
    margin-top: 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--bp-text-secondary);
}
.kn-menu-button{
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    border: 1px solid var(--bp-border);
    border-radius: 12px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
}
.kn-menu-button:active{
    background: var(--page-gray);
}
.kn-menu-button--primary{
    justify-content: center;
    border: none;
    background: var(--main-color);
    color: white;
    font-weight: 700;
}
.kn-menu-button--danger{
    border-color: var(--bp-primary-weak);
    background: var(--bp-primary-faint);
    color: var(--main-color);
}
</style>
