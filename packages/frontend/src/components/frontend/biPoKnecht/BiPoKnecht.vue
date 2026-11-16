<template>
    <div class="BiPoKnecht" :class="[`kn--${mode}`, { 'kn--rotate': rotateBoard }]">
        <div class="kn-board">
            <!-- Schwebendes Menue (drei Punkte), das Spielfeld bleibt in voller Breite -->
            <KnechtSideBar
                v-if="game.isStarted.value"
                :canUndo="game.canUndo.value"
                @undo="game.undo()"
                @scoreboard="sheet = 'scoreboard'"
                @timeline="sheet = 'timeline'"
                @menu="sheet = 'menu'"
            />

            <!-- Spielermodus: Handy liegt auf dem Tisch, jedes Team tippt an seinem Tischende.
                 Zwei Handys: gleiche Ansicht, das eigene Team immer unten und nichts gedreht (jedes Handy liest nur
                 ein Team). Ist das andere Team dran, sieht man den Stand, die Eingabe ist aber gesperrt. -->
            <div v-if="mode === 'player'" class="kn-field kn-field--player">
                <KnechtPlayers :game="game" :teamIndex="topTeam" :rotated="!twoPhone" :compact="!isThrowing(topTeam)" />
                <div class="kn-end" :class="{ 'kn-end--target': isTarget(topTeam) }">
                    <KnechtRack :game="game" :teamIndex="topTeam" direction="up" :isTarget="isTarget(topTeam)">
                        <template #front><KnechtControls v-if="isTarget(topTeam)" :game="game" :trickshotActive="sheet === 'trickshot'" @trickshot="openTrickshot" /></template>
                    </KnechtRack>
                </div>
                <div class="kn-end" :class="{ 'kn-end--target': isTarget(bottomTeam) }">
                    <KnechtRack :game="game" :teamIndex="bottomTeam" :direction="isTarget(bottomTeam) && !twoPhone ? 'up' : 'down'" :isTarget="isTarget(bottomTeam)" :rotated="isTarget(bottomTeam) && !twoPhone">
                        <template #front><KnechtControls v-if="isTarget(bottomTeam) && !waitingForOther" :game="game" :trickshotActive="sheet === 'trickshot'" @trickshot="openTrickshot" /></template>
                    </KnechtRack>
                </div>
                <KnechtPlayers :game="game" :teamIndex="bottomTeam" :compact="!isThrowing(bottomTeam)" />
                <!-- Zwei Handys, das andere Team ist dran: Feld sichtbar, aber nicht bedienbar -->
                <div v-if="waitingForOther" class="kn-wait">
                    <div class="kn-wait-pill">{{ getTeamName(game.match, opponentSide) }} ist dran · Eingabe am anderen Handy</div>
                </div>
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

            <!-- Animation nach besonderen Aktionen (wie beim Bowling) -->
            <KnechtCelebration :celebration="game.celebration.value" :flipped="celebrationFlipped" />

            <!-- Knecht Pro: Zug erst starten, wenn die Werfer die Baelle haben (misst die Wurfzeit ohne Baelleholen) -->
            <div v-if="proActive && game.waitingForTurnStart.value && !paused && !confirmDialog" class="kn-overlay kn-turn-lock" @click.self="game.startTurn()">
                <button type="button" class="kn-turn-start" :style="{ '--kn-team-color': getTeamColor(game.match, state.activeTeamIndex) }" @click="game.startTurn()">
                    <span class="kn-turn-start-icon">▶</span>
                    <span class="kn-turn-start-text">
                        <span class="kn-turn-start-title">Zug starten</span>
                        <span class="kn-turn-start-team">{{ getTeamName(game.match, state.activeTeamIndex) }} hat die Bälle</span>
                    </span>
                </button>
            </div>

            <!-- Knecht Pro: Details zur Kante, freiwillig, verschwindet von selbst -->
            <transition name="kn-edge">
                <div v-if="edgePrompt" class="kn-edge-overlay" @click.self="edgePrompt = null">
                    <KnechtEdgeZoom :edge="edgePrompt.edge" :standing="edgePrompt.standing" @update="setEdge" @activity="restartEdgeTimer" @close="edgePrompt = null" />
                </div>
            </transition>

            <!-- Airball-Shots: je 3 Airballs eines Teams trinkt jede Person dieses Teams einen Shot -->
            <transition name="kn-confirm">
                <div v-if="shotTeam !== null && !game.isOver.value" class="kn-overlay kn-confirm kn-shot">
                    <div class="kn-confirm-card" :style="{ transform: !twoPhone && mode === 'player' && shotTeam === topTeam ? 'rotate(180deg)' : undefined }">
                        <div class="kn-confirm-icon kn-shot-icon">🥃</div>
                        <div class="kn-confirm-title">Shot-Zeit!</div>
                        <div class="kn-confirm-text">
                            {{ airballs[shotTeam] }} Airballs von {{ getTeamName(game.match, shotTeam) }} –
                            {{ getTeam(game.match, shotTeam).players.length > 1 ? 'jede Person aus dem Team trinkt' : `${getTeam(game.match, shotTeam).players[0].name} trinkt` }} einen Shot.
                        </div>
                        <div class="kn-shot-actions">
                            <button type="button" class="kn-menu-button kn-shot-button" @click="postponeShot(shotTeam)">
                                <i class="pi pi-clock"></i> Später
                            </button>
                            <button type="button" class="kn-menu-button kn-menu-button--primary kn-shot-button" @click="confirmShot(shotTeam)">
                                <i class="pi pi-check"></i> Getrunken
                            </button>
                        </div>
                        <div class="kn-shot-hint">„Später“ setzt den Shot auf die Liste „Offene Shots“ auf der Webseite.</div>
                    </div>
                </div>
            </transition>

            <!-- Wer faengt an? -->
            <div v-if="!game.isStarted.value" class="kn-overlay">
                <button v-if="live" type="button" class="kn-live-chip" @click="sheet = 'live'">
                    <span class="kn-live-dot" :class="{ 'kn-live-dot--off': live.status !== 'live' }"></span>
                    <template v-if="live.status === 'off'">Live &amp; zweites Handy</template>
                    <template v-else-if="live.code">Live · Code {{ live.code }} fürs zweite Handy</template>
                    <template v-else>Live</template>
                </button>
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

            <KnechtSheet :visible="sheet === 'timeline'" title="Spielverlauf" subtitle="Neueste Würfe oben · antippen zum Korrigieren" :flipped="sheetFlipped" @update:visible="sheet = null">
                <KnechtTimeline :match="game.match" :state="game.state.value" newestFirst editable @edit="openTurnEditor" />
            </KnechtSheet>

            <!-- Eintrag korrigieren, auch waehrend des Spiels -->
            <KnechtSheet :visible="sheet === 'edit'" title="Eintrag korrigieren" subtitle="Spätere Würfe werden wenn nötig angepasst" :flipped="sheetFlipped" @update:visible="sheet = editTurn = null">
                <KnechtTurnEditor v-if="editTurn !== null" :game="game" :turnIndex="editTurn" @done="sheet = 'timeline'; editTurn = null" />
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'trickshot'" title="Trickshot" :subtitle="`${throwerName} hat verfehlt – wer hat den Ball gefangen?`" :flipped="sheetFlipped" @update:visible="sheet = null">
                <div class="kn-menu-list">
                    <button v-for="(player, playerIndex) in activeTeam.players" :key="playerIndex" type="button" class="kn-menu-button" @click="catchTrickshot(playerIndex)">
                        <KnechtIcon name="trickshot" /> {{ player.name }} hat gefangen
                    </button>
                </div>
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'elbow'" title="Ellenbogen-Call" subtitle="Wer war mit dem Ellenbogen über der Tischkante?" :flipped="sheetFlipped" @update:visible="sheet = null">
                <KnechtElbow :game="game" @done="sheet = null" />
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'ownCup'" title="Eigene Becher runter" :flipped="sheetFlipped" @update:visible="sheet = null">
                <KnechtOwnCup :game="game" @done="sheet = null" />
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'live'" title="Live & zweites Handy" :flipped="sheetFlipped" @update:visible="sheet = null">
                <KnechtLivePanel :live="live ?? null" :referee="mode === 'referee'" @start="emit('live', 'start')" @stop="emit('live', 'stop'); sheet = null" @leave="emit('live', 'leave')" @kick="emit('live', 'kick')" />
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'menu'" title="Einstellungen & Sonderfälle" :flipped="sheetFlipped" @update:visible="sheet = null">
                <div class="kn-menu-list">
                    <!-- Einheitlich: Auswahl als Segmente, An/Aus als Schalter (Zustand immer sichtbar), Aktionen als Knoepfe -->
                    <div class="kn-menu-label">Modus</div>
                    <SelectButton :modelValue="twoPhone ? 'player' : modeSetting" :options="MODE_OPTIONS" optionLabel="label" optionValue="value" :allowEmpty="false" :disabled="twoPhone" fluid @update:modelValue="setMode" />
                    <div v-if="twoPhone" class="kn-menu-hint">Mit zwei Handys immer Spieler-Modus</div>
                    <div v-else-if="modeSetting === 'auto'" class="kn-menu-hint">Hochkant = Spieler, quer = Schiedsrichter</div>
                    <button v-if="mode === 'referee'" type="button" role="switch" class="kn-menu-toggle" :aria-checked="proEnabled" @click="toggleProMode">
                        <KnechtIcon name="miss" />
                        <span class="kn-menu-toggle-text">Knecht Pro <small>Wurfzeiten und Kanten erfassen – Kante: Fehlwurf knapp neben den Becher tippen</small></span>
                        <span class="kn-menu-switch" aria-hidden="true"></span>
                    </button>

                    <div class="kn-menu-label">Anzeige & Rückmeldung</div>
                    <button v-if="fullscreenSupported" type="button" role="switch" class="kn-menu-toggle" :aria-checked="fullscreen" @click="toggleFullscreen">
                        <i class="pi pi-window-maximize"></i>
                        <span class="kn-menu-toggle-text">Vollbild</span>
                        <span class="kn-menu-switch" aria-hidden="true"></span>
                    </button>
                    <button type="button" role="switch" class="kn-menu-toggle" :aria-checked="!game.sound.isMuted.value" @click="game.sound.toggleMute()">
                        <i class="pi pi-volume-up"></i>
                        <span class="kn-menu-toggle-text">Ton</span>
                        <span class="kn-menu-switch" aria-hidden="true"></span>
                    </button>
                    <button v-if="vibrationSupported" type="button" role="switch" class="kn-menu-toggle" :aria-checked="vibrationEnabled" @click="toggleVibration">
                        <i class="pi pi-mobile"></i>
                        <span class="kn-menu-toggle-text">Vibration</span>
                        <span class="kn-menu-switch" aria-hidden="true"></span>
                    </button>
                    <div class="kn-menu-label">Animationen im {{ mode === 'player' ? 'Spieler' : 'Schiri' }}-Modus</div>
                    <SelectButton :modelValue="animationLevel" :options="ANIMATION_OPTIONS" optionLabel="label" optionValue="value" :allowEmpty="false" fluid @update:modelValue="setAnimationLevel" />
                    <div class="kn-menu-hint">{{ animationLevel === 'all' ? 'Auch bei jedem Treffer' : animationLevel === 'special' ? 'Nur Bombe, On Fire, Formationen & Co.' : 'Keine großen Animationen' }}</div>

                    <div class="kn-menu-label">Tisch</div>
                    <!-- Gemeinsame Einstellungen des Spiels: nur am ersten Handy (das zweite zaehlt nur mit) -->
                    <button v-if="!isGuest" type="button" class="kn-menu-button" @click="swapColors">
                        <i class="pi pi-palette"></i> Becherfarben tauschen
                    </button>
                    <button v-if="!twoPhone" type="button" class="kn-menu-button" @click="swapSides">
                        <i class="pi pi-sync"></i> Seiten tauschen
                    </button>
                    <div v-if="!twoPhone" class="kn-menu-hint">{{ mode === 'player' ? 'Oder einfach das Handy auf dem Tisch umdrehen' : 'Oder das Handy umdrehen, wenn du auf die andere Tischseite gehst' }}</div>

                    <div class="kn-menu-label">Sonderfälle</div>
                    <button type="button" class="kn-menu-button" @click="sheet = 'ownCup'"><KnechtIcon name="owncup" /> Eigene Becher runtergeworfen</button>
                    <button v-if="mode === 'referee'" type="button" class="kn-menu-button" @click="sheet = 'elbow'"><KnechtIcon name="penalty" /> Ellenbogen-Call</button>
                    <button type="button" class="kn-menu-button kn-menu-button--danger" @click="confirmDeathcup"><KnechtIcon name="deathcup" /> Deathcup von {{ throwerName }}</button>

                    <div class="kn-menu-label">Spiel</div>
                    <button v-if="live" type="button" class="kn-menu-button" @click="sheet = 'live'">
                        <span class="kn-live-dot" :class="{ 'kn-live-dot--off': live.status !== 'live' }"></span>
                        {{ live.status === 'off' ? 'Live & zweites Handy' : live.code ? `Live · Code ${live.code}` : 'Live' }}
                    </button>
                    <button type="button" class="kn-menu-button" @click="pause">
                        <i class="pi pi-pause"></i> Pause
                    </button>
                    <button type="button" class="kn-menu-button" @click="$emit('leave')">
                        <i class="pi pi-sign-out"></i> Zur Webseite (Spiel bleibt gespeichert)
                    </button>
                    <button v-if="!isGuest" type="button" class="kn-menu-button kn-menu-button--danger" @click="confirmAbort">
                        <i class="pi pi-times"></i> Spiel abbrechen
                    </button>
                    <button v-else type="button" class="kn-menu-button kn-menu-button--danger" @click="emit('live', 'leave')">
                        <i class="pi pi-sign-out"></i> Dieses Handy abmelden (Spiel läuft am anderen weiter)
                    </button>
                    <div v-if="isGuest" class="kn-menu-hint">Becherfarben, Abbrechen und Speichern macht das erste Handy.</div>
                </div>
            </KnechtSheet>
        </div>

        <!-- Wo der Ball gelandet ist (Bildschirmkoordinaten, ausserhalb des gedrehten Feldes) -->
        <span
            v-if="game.ballMark.value"
            :key="game.ballMark.value.id"
            class="kn-ball"
            :class="`kn-ball--${game.ballMark.value.kind}`"
            :style="{ left: `${game.ballMark.value.x}px`, top: `${game.ballMark.value.y}px`, '--kn-ball-size': `${game.ballMark.value.size}px` }"
        ></span>

        <!-- Spielende -->
        <KnechtGameOver v-if="game.isOver.value" :game="game" :refereeUsed="refereeUsed" :canSave="live?.role !== 'guest'" @saved="(result, rematch) => $emit('saved', result, rematch)" />
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
import KnechtTurnEditor from './KnechtTurnEditor.vue';
import KnechtLivePanel, { type KnechtLiveInfo } from './KnechtLivePanel.vue';
import type { LiveProgress } from './knechtLive';
import KnechtCelebration from './KnechtCelebration.vue';
import KnechtOwnCup from './KnechtOwnCup.vue';
import KnechtElbow from './KnechtElbow.vue';
import KnechtStartTeam from './KnechtStartTeam.vue';
import KnechtGameOver from './KnechtGameOver.vue';
import KnechtIcon from './KnechtIcon.vue';
import type { KnechtIconName } from './knechtIcons';
import { getTeamPoints, type KnechtAction } from './knechtEngine';
import { formatPoints, getPlayerName, getTeam, getTeamColor, getTeamName, swapCupColors } from './KnechtUtilFunctions';
import { useBiPoKnecht, type KnechtMode } from './useBiPoKnecht';
import KnechtEdgeZoom from './KnechtEdgeZoom.vue';
import { addShots } from '@/components/frontend/shots/shots';
import { isVibrationSupported, toggleVibration, vibrationEnabled } from './knechtHaptics';
import { ANIMATION_OPTIONS, animationLevel, animationMode, setAnimationLevel } from './knechtAnimations';
import { enterFullscreen, exitFullscreen, isFullscreen, isFullscreenSupported, lockLandscape, releaseWakeLock, requestWakeLock, unlockOrientation } from './knechtScreen';

const props = defineProps<{
    match: Match;
    startTeamIndex: number | null;
    actions: KnechtAction[];
    refereeUsed: boolean;
    live?: KnechtLiveInfo | null;       // Live-Ticker / zweites Handy (null = ausgeschaltet)
    phoneSide?: number | null;          // zwei Handys: Tischende dieses Handys (Teamindex), sonst null
}>();

const emit = defineEmits<{
    exit: [];                                       // abbrechen, Spiel verwerfen
    leave: [];                                      // zur Webseite, Spiel bleibt gespeichert
    saved: [match: Match, rematch: boolean];
    change: [progress: { startTeamIndex: number | null; actions: KnechtAction[]; refereeUsed: boolean }];
    live: [action: 'start' | 'stop' | 'leave' | 'kick'];
}>();

const game = useBiPoKnecht(props.match, props.startTeamIndex, props.actions);
const toast = useToast();

// ─── Einstellungen (bleiben fuer das naechste Spiel erhalten) ───
const MODE_KEY = 'bipo_knecht_mode';
const MODE_OPTIONS = [{ label: 'Auto', value: 'auto' }, { label: 'Spieler', value: 'player' }, { label: 'Schiri', value: 'referee' }];

// Auto: der Modus folgt der Bildschirm-Orientierung (hochkant = Spieler, quer = Schiedsrichter)
type ModeSetting = KnechtMode | 'auto';
const storedMode = localStorage.getItem(MODE_KEY);
const modeSetting = ref<ModeSetting>(storedMode === 'referee' || storedMode === 'player' ? storedMode : 'auto');
const swapped = ref(false);
// Zwei Handys (nur Spielermodus): dieses Handy liegt bei phoneSide und zeigt die Becher des Gegners
const twoPhone = computed(() => props.phoneSide === 0 || props.phoneSide === 1);
const opponentSide = computed(() => 1 - (props.phoneSide ?? 0));
// Zweites Handy: zaehlt nur mit, gemeinsame Einstellungen (Farben, Abbrechen, Speichern) macht das erste
const isGuest = computed(() => props.live?.role === 'guest');
const refereeUsed = ref(props.refereeUsed);
const paused = ref(false);
const sheet = ref<'scoreboard' | 'timeline' | 'edit' | 'live' | 'menu' | 'trickshot' | 'ownCup' | 'elbow' | null>(null);
const editTurn = ref<number | null>(null);
const openTurnEditor = (turnIndex: number) => {
    editTurn.value = turnIndex;
    sheet.value = 'edit';
};

const setMode = (value: ModeSetting) => {
    modeSetting.value = value;
    localStorage.setItem(MODE_KEY, value);
    // Fest Schiedsrichter: Querformat sperren. Auto darf nicht sperren, sonst kaeme man nicht mehr zurueck.
    if (value === 'referee') lockLandscape();
    else unlockOrientation();
    // Menue bleibt offen: Schalter wie Knecht Pro (nur Schiri) erscheinen sofort sichtbar
};

// ─── Vollbild (z.B. zwischendurch verlassen, um Nachrichten zu schreiben) ───
const fullscreenSupported = isFullscreenSupported();
const fullscreen = ref(isFullscreen());
const onFullscreenChange = () => { fullscreen.value = isFullscreen(); };
const toggleFullscreen = () => {
    if (fullscreen.value) exitFullscreen();
    else enterFullscreen(true);
    sheet.value = null;
};

const swapSides = () => {
    swapped.value = !swapped.value;
    sheet.value = null;
};

const swapColors = () => {
    swapCupColors(game.match);
    sheet.value = null;
    // Speichern und ans andere Handy/den Ticker schicken (Farben gehoeren zum Spiel)
    emit('change', { startTeamIndex: game.startTeamIndex.value, actions: game.actions.value, refereeUsed: refereeUsed.value });
};

// Seiten durch Drehen:
// - Spielermodus: das Handy liegt flach, Umdrehen bringt die Seiten von selbst zum richtigen Team.
//   Kein automatischer Tausch (der hat das Umdrehen wieder rueckgaengig gemacht, Nutzertest).
// - Schiri-Modus: der Schiri haelt das Handy quer. Geht er auf die andere Tischseite und dreht das Handy,
//   dreht das System das Bild mit (Querformat links <-> rechts) - links und rechts muessen dann tauschen.
const onScreenTurn = () => {
    const type = screen.orientation?.type ?? '';
    if (!type.startsWith('landscape') || mode.value !== 'referee' || !game.isStarted.value || game.isOver.value) {
        lastLandscape = type.startsWith('landscape') ? type : lastLandscape;
        return;
    }
    if (lastLandscape && lastLandscape !== type) {
        swapSides();
        toast.add({ severity: 'info', summary: 'Seiten getauscht', life: 1500 });
    }
    lastLandscape = type;
};
let lastLandscape: string | null = screen.orientation?.type?.startsWith('landscape') ? screen.orientation.type : null;

const pause = () => {
    paused.value = true;
    sheet.value = null;
};

// Schiedsrichter haelt das Handy quer. Dreht der Browser nicht mit, dreht der Knecht das Feld selbst.
const orientationQuery = window.matchMedia('(orientation: portrait)');
const isPortrait = ref(orientationQuery.matches);
const onOrientationChange = (event: MediaQueryListEvent) => { isPortrait.value = event.matches; };
// Zwei Handys gehen nur im Spielermodus (jedes Handy liegt an einem Tischende)
const mode = computed<KnechtMode>(() => twoPhone.value ? 'player' : modeSetting.value === 'auto' ? (isPortrait.value ? 'player' : 'referee') : modeSetting.value);
// Animationen sind je Modus eingestellt (Spieler: alle, Schiri: nur besondere)
watch(mode, value => { animationMode.value = value; }, { immediate: true });
const rotateBoard = computed(() => mode.value === 'referee' && isPortrait.value);
// Schiedsrichter-Modus genutzt: am Ende nach dem Namen fragen
watch(mode, value => { if (value === 'referee') refereeUsed.value = true; }, { immediate: true });

// ─── Feld ───
const state = computed(() => game.state.value);
const teamPoints = computed(() => getTeamPoints(state.value));

// Spielermodus: Team 1 (rot) steht unten, getauscht oben. Schiedsrichter: Team 1 wirft von links.
// Am Tischende eines Teams stehen dessen Becher und (im Spielermodus) dessen Spieler.
// Zwei Handys: das eigene Team liegt unten
const bottomTeam = computed(() => twoPhone.value ? props.phoneSide! : swapped.value ? 1 : 0);
const topTeam = computed(() => 1 - bottomTeam.value);
const leftTeam = computed(() => swapped.value ? 1 : 0);
const rightTeam = computed(() => 1 - leftTeam.value);

const isThrowing = (teamIndex: number) => game.isStarted.value && state.value.status === 'playing' && state.value.activeTeamIndex === teamIndex;
const isTarget = (teamIndex: number) => game.isStarted.value && state.value.status === 'playing' && state.value.activeTeamIndex !== teamIndex;

const activeTeam = computed(() => getTeam(game.match, state.value.activeTeamIndex));
const throwerName = computed(() => getPlayerName(game.match, state.value.activeTeamIndex, game.selectedPlayer.value));

// Sheets und Banner zeigen zum werfenden Team (Spielermodus, Team am oberen Tischende)
const sheetFlipped = computed(() => !twoPhone.value && mode.value === 'player' && state.value.activeTeamIndex === topTeam.value);
// Animation zum Team, das geworfen hat (nicht zum Team, das danach dran ist)
const celebrationFlipped = computed(() => !twoPhone.value && mode.value === 'player' && game.celebration.value?.teamIndex === topTeam.value);
// Zwei Handys: das andere Team wirft gerade, dieses Handy wartet
const waitingForOther = computed(() => twoPhone.value && game.isStarted.value && state.value.status === 'playing' && state.value.activeTeamIndex !== props.phoneSide);


// ─── Knecht Pro (nur Schiedsrichter): Doppelkante und Abprallrichtung nach einem Kanten-Nullwurf ───
const PRO_KEY = 'bipo_knecht_pro';
// Im Schiri-Modus standardmaessig an (Kanten, Wurfzeiten), abschaltbar im Menue
const proEnabled = ref(localStorage.getItem(PRO_KEY) !== 'off');
const proActive = computed(() => proEnabled.value && mode.value === 'referee');
const toggleProMode = () => {
    proEnabled.value = !proEnabled.value;
    localStorage.setItem(PRO_KEY, proEnabled.value ? 'on' : 'off');
};
const vibrationSupported = isVibrationSupported();

// Nahansicht bleibt offen, solange getippt wird; ohne Eingabe schliesst sie von selbst
const EDGE_PROMPT_DURATION = 6000;
const edgePrompt = ref<{ index: number; edge: EdgeHit; standing: number[] } | null>(null);
let edgeTimer: ReturnType<typeof setTimeout> | null = null;
const restartEdgeTimer = () => {
    if (edgeTimer) clearTimeout(edgeTimer);
    edgeTimer = setTimeout(() => { edgePrompt.value = null; }, EDGE_PROMPT_DURATION);
};
watch(() => game.actions.value.length, (length, previous) => {
    const last = game.actions.value[length - 1];
    if (!proActive.value || length <= (previous ?? 0) || last?.type !== 'throw' || !last.edge) {
        if (length < (previous ?? 0)) edgePrompt.value = null;
        return;
    }
    // Becher, die zum Zeitpunkt des Wurfs noch standen (Ziel war das Rack des Gegners)
    const before = game.getStateAfter(length - 1);
    const hit = new Set(before.racks[1 - before.activeTeamIndex].hit);
    edgePrompt.value = { index: length - 1, edge: last.edge, standing: Array.from({ length: 10 }, (_, cup) => cup).filter(cup => !hit.has(cup)) };
    restartEdgeTimer();
});
// Genaue Kante aus der Nahansicht in den gespeicherten Wurf uebernehmen
const setEdge = (edge: EdgeHit) => {
    const prompt = edgePrompt.value;
    const action = prompt ? game.actions.value[prompt.index] : undefined;
    if (!prompt || action?.type !== 'throw' || action.outcome !== 'miss') return;
    const actions = [...game.actions.value];
    actions[prompt.index] = { ...action, edge };
    game.replaceActions(actions);
    edgePrompt.value = { ...prompt, edge };
    restartEdgeTimer();
};

// ─── Airball-Shots (nur Anzeige im Spiel, die Bestaetigung merkt sich nur dieses Handy) ───
const SHOT_EVERY_AIRBALLS = 3;
const shotStorageKey = () => `bipo_knecht_shots_${game.match.time ?? 0}`;
const loadShots = (): number[] => {
    try {
        const stored = JSON.parse(localStorage.getItem(shotStorageKey()) ?? '[0,0]');
        return Array.isArray(stored) ? stored : [0, 0];
    } catch {
        return [0, 0];
    }
};
const shotsConfirmed = ref<number[]>(loadShots());
const airballs = computed(() => [0, 1].map(teamIndex => state.value.turns.filter(turn => turn.type === 'airball' && turn.teamIndex === teamIndex).length));
const shotTeam = computed(() => {
    const due = [0, 1].find(teamIndex => Math.floor(airballs.value[teamIndex] / SHOT_EVERY_AIRBALLS) > (shotsConfirmed.value[teamIndex] ?? 0));
    return due ?? null;
});
const confirmShot = (teamIndex: number) => {
    shotsConfirmed.value = shotsConfirmed.value.map((count, index) => index === teamIndex ? Math.floor(airballs.value[teamIndex] / SHOT_EVERY_AIRBALLS) : count);
    try { localStorage.setItem(shotStorageKey(), JSON.stringify(shotsConfirmed.value)); } catch { /* egal */ }
};

// "Später": jede Person des Teams bekommt einen offenen Shot auf der Webseite
const postponeShot = async (teamIndex: number) => {
    const team = getTeam(game.match, teamIndex);
    confirmShot(teamIndex);
    const success = await addShots(team.players.map(player => ({
        name: player.name,
        teamName: getTeamName(game.match, teamIndex),
        opponentName: getTeamName(game.match, 1 - teamIndex),
        gameTime: game.match.time,
    })));
    toast.add(success
        ? { severity: 'info', summary: 'Shot auf die Liste „Offene Shots“ gesetzt', life: 2500 }
        : { severity: 'error', summary: 'Offener Shot konnte nicht gespeichert werden', life: 3500 });
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
    if (modeSetting.value === 'referee') lockLandscape();
};

// ─── Zweites Handy / Live: aktueller Stand und Stand vom anderen Handy uebernehmen ───
const getProgress = (): LiveProgress => ({
    startTeamIndex: game.startTeamIndex.value,
    startedAt: game.startTeamIndex.value !== null ? game.match.time ?? null : null,
    actions: game.actions.value,
    // Becherfarben koennen sich nach dem Anlegen noch aendern (Startdialog, Menue)
    match: game.match,
});

const applyRemote = (remote: LiveProgress): boolean => {
    const colors = remote.match?.cupColors;
    if (colors && JSON.stringify(colors) !== JSON.stringify(game.match.cupColors)) game.match.cupColors = [...colors];
    if (remote.startTeamIndex !== null && game.startTeamIndex.value === null) {
        if (remote.startedAt) game.match.time = remote.startedAt;
        game.startTeamIndex.value = remote.startTeamIndex;
        requestWakeLock();
    }
    if (JSON.stringify(remote.actions) === JSON.stringify(game.actions.value)) return true;
    // syncActions: neue Wuerfe des anderen Handys zeigen ihre Animation auch hier
    return !game.syncActions(remote.actions.map(action => ({ ...action })));
};

defineExpose({ getProgress, applyRemote });

// ─── Fortschritt melden (wird im localStorage gesichert) ───
watch([game.actions, game.startTeamIndex, refereeUsed], () => {
    emit('change', { startTeamIndex: game.startTeamIndex.value, actions: game.actions.value, refereeUsed: refereeUsed.value });
});

watch(game.isOver, (isOver) => {
    sheet.value = null;
    paused.value = false;
    if (isOver) {
        try { localStorage.removeItem(shotStorageKey()); } catch { /* egal */ }
        releaseWakeLock();
        exitFullscreen();
        unlockOrientation();
    } else if (game.isStarted.value) {
        requestWakeLock();
    }
});

onMounted(() => {
    orientationQuery.addEventListener('change', onOrientationChange);
    screen.orientation?.addEventListener('change', onScreenTurn);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    if (game.isStarted.value && !game.isOver.value) requestWakeLock();
    if (game.droppedActions)
        toast.add({ severity: 'warn', summary: `${game.droppedActions} Einträge passten nicht mehr zu den aktuellen Regeln und wurden entfernt`, life: 6000 });
});

onUnmounted(() => {
    orientationQuery.removeEventListener('change', onOrientationChange);
    screen.orientation?.removeEventListener('change', onScreenTurn);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
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
/* Zwei Handys, das andere Team ist dran: Stand bleibt lesbar, Eingabe gesperrt */
.kn-field--player{ position: relative; }
.kn-wait{
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(128, 128, 128, .18);
    backdrop-filter: grayscale(.85);
}
.kn-wait-pill{
    max-width: calc(100% - 136px);
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--bp-text-strong);
    color: var(--bp-surface);
    font-size: 13px;
    font-weight: 700;
    text-align: center;
    box-shadow: 0 4px 14px rgba(0, 0, 0, .2);
}

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
    /* Groesse im echten Verhaeltnis zum Becher (siehe KnechtRack.vue) */
    --kn-ball-size: 18px;
    position: absolute;
    z-index: 24;
    width: var(--kn-ball-size);
    height: var(--kn-ball-size);
    margin: calc(var(--kn-ball-size) / -2) 0 0 calc(var(--kn-ball-size) / -2);
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
/* ─── Knecht Pro: Zug starten ─── */
.kn-turn-lock{
    z-index: 24;
    background: rgba(31, 35, 40, .3);
}
/* Schwebendes Menue (Rueckgaengig, Menue) bleibt bei der Sperre bedienbar */
.KnechtSideBar{
    z-index: 25;
}
.kn-turn-start{
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 22px;
    border: none;
    border-radius: 20px;
    background: var(--kn-team-color);
    color: white;
    font: inherit;
    cursor: pointer;
    box-shadow: 0 12px 30px rgba(0, 0, 0, .3);
}
.kn-turn-start:active{
    transform: scale(.97);
}
.kn-turn-start-icon{
    font-size: 30px;
}
.kn-turn-start-text{
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}
.kn-turn-start-title{
    font-size: 22px;
    font-weight: 900;
}
.kn-turn-start-team{
    font-size: 13px;
    font-weight: 700;
    opacity: .9;
}

/* ─── Knecht Pro: Nahansicht der Kante ─── */
.kn-edge-overlay{
    position: absolute;
    inset: 0;
    z-index: 26;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(31, 35, 40, .35);
}
.kn-edge-enter-active,
.kn-edge-leave-active{
    transition: opacity .2s ease;
}
.kn-edge-enter-from,
.kn-edge-leave-to{
    opacity: 0;
}
/* Live-Hinweis auf dem Startbildschirm und im Menue */
.kn-live-chip{
    position: absolute;
    top: 12px;
    left: 50%;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border: 1px solid var(--bp-border);
    border-radius: 999px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .12);
    transform: translateX(-50%);
    cursor: pointer;
}
.kn-live-dot{
    flex-shrink: 0;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #E5484D;
    animation: kn-live-pulse 1.6s infinite;
}
.kn-live-dot--off{
    background: var(--bp-text-faint);
    animation: none;
}
@keyframes kn-live-pulse{
    0%{ box-shadow: 0 0 0 0 rgba(229, 72, 77, .6); }
    70%{ box-shadow: 0 0 0 7px rgba(229, 72, 77, 0); }
    100%{ box-shadow: 0 0 0 0 rgba(229, 72, 77, 0); }
}
.kn-shot{
    z-index: 28;
}
.kn-shot-icon{
    background: #FFF1D6;
    font-size: 30px;
}
.kn-shot-actions{
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 8px;
    width: 100%;
    margin-top: 8px;
}
.kn-shot-button{
    justify-content: center;
}
.kn-shot-hint{
    font-size: 11px;
    color: var(--bp-text-muted);
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
.kn-menu-hint{
    margin-top: -2px;
    font-size: 11px;
    color: var(--bp-text-muted);
    text-align: center;
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
/* An/Aus-Einstellung: gleiche Zeile wie ein Knopf, rechts ein Schalter mit sichtbarem Zustand */
.kn-menu-toggle{
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 6px 14px;
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
.kn-menu-toggle-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}
.kn-menu-toggle-text small{
    font-size: 12px;
    font-weight: 500;
    color: var(--bp-text-muted);
}
.kn-menu-switch{
    position: relative;
    flex-shrink: 0;
    width: 44px;
    height: 26px;
    border-radius: 999px;
    background: var(--bp-fill-strong);
    transition: background .2s ease;
}
.kn-menu-switch::after{
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .25);
    transition: transform .2s ease;
}
.kn-menu-toggle[aria-checked="true"] .kn-menu-switch{
    background: var(--main-color);
}
.kn-menu-toggle[aria-checked="true"] .kn-menu-switch::after{
    transform: translateX(18px);
}
</style>
