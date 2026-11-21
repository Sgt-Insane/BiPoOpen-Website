<template>
    <div class="BiPoKnecht" :class="[`kn--${mode}`, { 'kn--rotate': rotateBoard }]">
        <div class="kn-board">
            <!-- Schwebendes Menue (drei Punkte), das Spielfeld bleibt in voller Breite -->
            <KnechtSideBar
                v-if="game.isStarted.value"
                :canUndo="undoEnabled"
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
                    <KnechtRack :game="game" :teamIndex="topTeam" direction="up" :isTarget="isTarget(topTeam) && !waitingForOther" :pro="proActive" :owners="cupOwners.racks[topTeam]" :showDrinkers="!twoPhone">
                        <template #front><KnechtControls v-if="(isTarget(topTeam) && !waitingForOther)" :game="game" :trickshotActive="sheet === 'trickshot'" :pro="proActive" :catchReady="catchWindow?.team === 1 - topTeam" @trickshot="openTrickshot" /></template>
                    </KnechtRack>
                </div>
                <div class="kn-end" :class="{ 'kn-end--target': isTarget(bottomTeam), 'kn-end--own': twoPhone }">
                    <!-- Mehrere Handys, man ist selbst dran: Hinweis ueber den eigenen Bechern, nie ueber Becher oder Knoepfen des Gegners -->
                    <transition name="kn-myturn">
                        <div v-if="showMyTurn" class="kn-myturn">🎯 Du bist dran!</div>
                    </transition>
                    <KnechtRack :game="game" :teamIndex="bottomTeam" :direction="isTarget(bottomTeam) && !twoPhone ? 'up' : 'down'" :isTarget="isTarget(bottomTeam) && !waitingForOther" :rotated="isTarget(bottomTeam) && !twoPhone" :pro="proActive" :owners="cupOwners.racks[bottomTeam]" showDrinkers>
                        <template #front><KnechtControls v-if="(isTarget(bottomTeam) && !waitingForOther)" :game="game" :trickshotActive="sheet === 'trickshot'" :pro="proActive" :catchReady="catchWindow?.team === 1 - bottomTeam" @trickshot="openTrickshot" /></template>
                    </KnechtRack>
                </div>
                <KnechtPlayers :game="game" :teamIndex="bottomTeam" :compact="!isThrowing(bottomTeam)" />
                <!-- Zwei Handys, das andere Team ist dran: Feld sichtbar, aber nicht bedienbar -->
                <!-- Getroffenes Team: wer den Becher trinken muss -->
                <transition name="kn-drink">
                    <div v-if="drinkNotice" :key="drinkNotice.id" class="kn-drink" :class="{ 'kn-drink--me': drinkNotice.me }">{{ drinkNotice.text }}</div>
                </transition>
                <div v-if="waitingForOther" class="kn-wait">
                    <div class="kn-wait-pill">{{ waitText }}</div>
                </div>
            </div>

            <!-- Schiedsrichter: Tisch von der Seite, quer -->
            <div v-else class="kn-field kn-field--referee">
                <div v-for="teamIndex in [leftTeam, rightTeam]" :key="teamIndex" class="kn-end" :class="{ 'kn-end--target': isTarget(teamIndex) }">
                    <div class="kn-end-rack">
                        <KnechtRack :game="game" :teamIndex="teamIndex" :direction="teamIndex === leftTeam ? 'left' : 'right'" :isTarget="isTarget(teamIndex)" :pro="proActive" :owners="cupOwners.racks[teamIndex]" showDrinkers>
                            <template #front><KnechtControls v-if="isTarget(teamIndex)" :game="game" :trickshotActive="sheet === 'trickshot'" :pro="proActive" :catchReady="catchWindow?.team === 1 - teamIndex" @trickshot="openTrickshot" /></template>
                        </KnechtRack>
                    </div>
                    <KnechtPlayers :game="game" :teamIndex="teamIndex" :compact="!isThrowing(teamIndex)" />
                </div>
            </div>

            <!-- Animation nach besonderen Aktionen (wie beim Bowling) -->
            <KnechtCelebration :celebration="game.celebration.value" :flipped="celebrationFlipped" />

            <!-- Knecht Pro: Zug erst starten, wenn die Werfer die Baelle haben (misst die Wurfzeit ohne Baelleholen) -->
            <!-- Knecht Pro: der letzte Ball des Zugs war ein Nullwurf - erst entscheiden, ob er gefangen wurde (Trickshot) -->
            <div v-if="roundEndPending && !paused && !confirmDialog && !edgePrompt && sheet !== 'trickshot'" class="kn-overlay">
                <div class="kn-pause-card" :style="{ transform: roundEndFlipped ? 'rotate(180deg)' : undefined }">
                    <div class="kn-pause-title">Nullwurf · Zug vorbei?</div>
                    <div class="kn-pause-by">Ball gefangen? Dann Trickshot, sonst Zug beenden.</div>
                    <button type="button" class="kn-menu-button" @click="openTrickshot"><KnechtIcon name="trickshot" /> Gefangen – Trickshot</button>
                    <button type="button" class="kn-menu-button kn-menu-button--primary" @click="endRound">Zug beenden</button>
                </div>
            </div>

            <div v-if="proActive && game.waitingForTurnStart.value && !roundEndPending && !paused && !confirmDialog" class="kn-overlay kn-turn-lock" @click.self="game.startTurn()">
                <button type="button" class="kn-turn-start" :style="{ '--kn-team-color': getTeamColor(game.match, state.activeTeamIndex) }" @click="game.startTurn()">
                    <span class="kn-turn-start-icon">▶</span>
                    <span class="kn-turn-start-text">
                        <span class="kn-turn-start-title">Zug starten</span>
                        <span class="kn-turn-start-team">{{ getTeamName(game.match, state.activeTeamIndex) }} hat die Bälle in der Hand – ab jetzt läuft die Wurfzeit</span>
                    </span>
                </button>
            </div>

            <!-- Knecht Pro: Details zur Kante, freiwillig, verschwindet von selbst -->
            <transition name="kn-edge">
                <div v-if="edgePrompt" class="kn-edge-overlay" @click.self="edgePrompt = null">
                    <KnechtEdgeZoom :edge="edgePrompt.edge" :standing="edgePrompt.standing" :canHit="edgeCanHit" :style="{ transform: edgePrompt.flipped ? 'rotate(180deg)' : undefined }"
                        @update="setEdge" @inside="edgeIntoCup" @activity="restartEdgeTimer" @close="edgePrompt = null" />
                </div>
            </transition>

            <!-- Airball-Shots: je 3 Airballs eines Teams trinkt jede Person dieses Teams einen Shot -->
            <transition name="kn-confirm">
                <div v-if="shotTeam !== null && showsShot(shotTeam) && !game.isOver.value" class="kn-overlay kn-confirm kn-shot">
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

            <!-- Lobby-Spiel: Feld steht schon, "Wer faengt an?" als Popup (Team waehlen oder Schnick-Schnack-Schnuck, gleiches Ergebnis auf allen Handys) -->
            <KnechtRpsPopup v-if="rpsVisible" :match="game.match" :seed="live?.id ?? ''" :startedTeam="game.startTeamIndex.value" @decided="onRpsDecided" @done="onRpsDone" @back="$emit('lobby')" />

            <!-- Wer faengt an? -->
            <div v-if="!game.isStarted.value && !lobbyStart" class="kn-overlay">
                <button v-if="live" type="button" class="kn-live-chip" @click="sheet = 'live'">
                    <span class="kn-live-dot" :class="{ 'kn-live-dot--off': live.status !== 'live' }"></span>
                    <template v-if="live.status === 'off'">Live &amp; mehrere Handys</template>
                    <template v-else-if="live.code">Live · PIN {{ live.code }} für weitere Handys</template>
                    <template v-else>Live</template>
                </button>
                <!-- Handy gehoert einem Spieler/Tischende (Lobby oder per PIN beigetreten): Farben sind schon gewaehlt -->
                <KnechtStartTeam :match="game.match" :skipColors="typeof live?.team === 'number'" @start="startGame" @cancel="fromLobby ? $emit('lobby') : multiDevice ? confirmAbort() : $emit('exit')" />
            </div>

            <!-- Pause -->
            <!-- Pause: ein Handy - Tippen irgendwo geht weiter. Mehrere Handys: weiter erst, wenn alle bereit sind. -->
            <div v-if="paused" class="kn-overlay" :class="{ 'kn-pause-tap': !multiDevice }" @click="!multiDevice && resumeGame()">
                <div class="kn-pause-card">
                    <div class="kn-pause-title">⏸ Pause</div>
                    <div v-if="multiDevice && pausedBy" class="kn-pause-by">{{ pausedBy }} hat pausiert</div>
                    <div class="kn-pause-score">{{ getTeamName(game.match, 0) }} {{ formatPoints(teamPoints[0]) }} : {{ formatPoints(teamPoints[1]) }} {{ getTeamName(game.match, 1) }}</div>
                    <template v-if="multiDevice">
                        <button v-if="!iAmPauseReady" type="button" class="kn-menu-button kn-menu-button--primary" @click="setPauseReady(true)">Bereit</button>
                        <button v-else type="button" class="kn-menu-button" @click="setPauseReady(false)">Doch nicht bereit</button>
                        <div class="kn-pause-by">{{ pauseWaitText }}</div>
                    </template>
                    <div v-else class="kn-pause-hint">Tippen zum Weiterspielen</div>
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

            <KnechtSheet :visible="sheet === 'live'" title="Live & mehrere Handys" :flipped="sheetFlipped" @update:visible="sheet = null">
                <KnechtLivePanel :live="live ?? null" :match="game.match" :referee="mode === 'referee'" @action="onLiveAction" />
            </KnechtSheet>

            <KnechtSheet :visible="sheet === 'menu'" title="Einstellungen & Sonderfälle" :flipped="sheetFlipped" @update:visible="sheet = null">
                <div class="kn-menu-list">
                    <!-- Einheitlich: Auswahl als Segmente, An/Aus als Schalter (Zustand immer sichtbar), Aktionen als Knoepfe -->
                    <div class="kn-menu-label">Modus</div>
                    <SelectButton :modelValue="twoPhone ? 'player' : modeSetting" :options="MODE_OPTIONS" optionLabel="label" optionValue="value" :allowEmpty="false" :disabled="twoPhone" fluid @update:modelValue="setMode" />
                    <div v-if="twoPhone" class="kn-menu-hint">Mit mehreren Handys immer Spieler-Modus – außer dieses Handy trägt für alle ein (unten)</div>
                    <div v-else-if="modeSetting === 'auto'" class="kn-menu-hint">Hochkant = Spieler, quer = Schiedsrichter</div>

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
                    <!-- Wie dieses Handy das Spiel zeigt und trackt: je Modus eingestellt, unabhaengig von anderen Handys -->
                    <div class="kn-menu-label">{{ mode === 'player' ? 'Spieler' : 'Schiri' }}-Modus · nur dieses Handy</div>
                    <div class="kn-menu-sublabel">Animationen</div>
                    <SelectButton :modelValue="animationLevel" :options="ANIMATION_OPTIONS" optionLabel="label" optionValue="value" :allowEmpty="false" fluid @update:modelValue="setAnimationLevel" />
                    <div class="kn-menu-hint">{{ animationLevel === 'all' ? 'Bei jeder Aktion' : animationLevel === 'special' ? 'Nur Bombe, Bouncer, Trickshot, Balls Back, Heaten Up, On Fire & Formationen' : 'Keine großen Animationen' }}</div>
                    <button v-if="proAvailable" type="button" role="switch" class="kn-menu-toggle" :aria-checked="proEnabled" @click="toggleProMode">
                        <KnechtIcon name="miss" />
                        <span class="kn-menu-toggle-text">Knecht Pro <small>„Zug starten“ = Bälle in der Hand, ab da läuft die Wurfzeit · Finger halten: Lupe, Ball genau auf Kante, Becher oder Tisch ablegen. Mehrere Bälle zeigen den Weg (z. B. Kante, dann Becher), „Eintragen“ – es zählt der letzte Ball</small></span>
                        <span class="kn-menu-switch" aria-hidden="true"></span>
                    </button>

                    <div class="kn-menu-label">Tisch</div>
                    <!-- Becherfarben gehoeren zum Spiel: gelten auf allen Handys -->
                    <button type="button" class="kn-menu-button" @click="swapColors">
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

                    <!-- Fuer alle eintragen: dieses Handy uebernimmt den ganzen Tisch (auch Schiri-Modus), die anderen sehen das -->
                    <template v-if="multiDevice">
                        <div class="kn-menu-label">Mehrere Handys</div>
                        <button type="button" role="switch" class="kn-menu-toggle" :aria-checked="tracksAll" :disabled="!!otherTracker" @click="toggleTrackAll">
                            <i class="pi pi-lock-open"></i>
                            <span class="kn-menu-toggle-text">Für alle eintragen <small>{{ otherTracker ? `${deviceName(otherTracker)} trägt schon für alle ein` : 'Ein Handy für den ganzen Tisch, auch Schiri-Modus. Die anderen Handys schauen nur zu.' }}</small></span>
                            <span class="kn-menu-switch" aria-hidden="true"></span>
                        </button>
                    </template>

                    <div class="kn-menu-label">Spiel</div>
                    <button v-if="live" type="button" class="kn-menu-button" @click="sheet = 'live'">
                        <span class="kn-live-dot" :class="{ 'kn-live-dot--off': live.status !== 'live' }"></span>
                        {{ live.status === 'off' ? 'Live & mehrere Handys' : live.code ? `Live · PIN ${live.code}` : 'Live' }}<DevBadge :feature="['live', 'anstossen']" />
                    </button>
                    <button type="button" class="kn-menu-button" @click="pause">
                        <i class="pi pi-pause"></i> Pause
                    </button>
                    <button type="button" class="kn-menu-button" @click="$emit('leave')">
                        <i class="pi pi-sign-out"></i> Zur Webseite (Spiel bleibt gespeichert)
                    </button>
                    <button v-if="multiDevice" type="button" class="kn-menu-button" @click="emit('live', { type: 'leave' })">
                        <i class="pi pi-sign-out"></i> Dieses Handy abmelden (Spiel läuft auf den anderen weiter)
                    </button>
                    <button type="button" class="kn-menu-button kn-menu-button--danger" @click="confirmAbort">
                        <i class="pi pi-times"></i> Spiel abbrechen{{ multiDevice ? ' (für alle)' : '' }}
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
            :style="{ left: `${game.ballMark.value.x}px`, top: `${game.ballMark.value.y}px`, '--kn-ball-size': `${game.ballMark.value.size}px` }"
        ></span>

        <!-- Spielende -->
        <KnechtGameOver v-if="game.isOver.value" :game="game" :refereeUsed="refereeUsed" :undoAllowed="lastEntryIsMine" :saveHandler="saveHandler" :lockedText="savingText" @saved="(result, rematch) => $emit('saved', result, rematch)" />
    </div>
</template>

<script setup lang="ts">
import DevBadge from '@/components/shared/DevBadge.vue';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
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
import { getCupOwners } from './knechtCupOwners';
import KnechtLivePanel, { type KnechtLiveAction, type KnechtLiveInfo } from './KnechtLivePanel.vue';
import { canDeviceEnter, getTeamDevice, getTrackerDevice, type LiveDeviceBinding } from './liveDevices';
import { deviceName } from './useKnechtLiveSync';
import type { LiveProgress } from './knechtLive';
import KnechtCelebration from './KnechtCelebration.vue';
import KnechtOwnCup from './KnechtOwnCup.vue';
import KnechtElbow from './KnechtElbow.vue';
import KnechtStartTeam from './KnechtStartTeam.vue';
import KnechtRpsPopup from './KnechtRpsPopup.vue';
import { useProfile } from '../multiplayer/useProfile';
import KnechtGameOver from './KnechtGameOver.vue';
import KnechtIcon from './KnechtIcon.vue';
import type { KnechtIconName } from './knechtIcons';
import { getHittableCups, getTeamPoints, type KnechtAction } from './knechtEngine';
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
    live?: KnechtLiveInfo | null;       // Live-Ticker / mehrere Handys (null = ausgeschaltet)
    saveHandler?: (result: Match, rematch: boolean) => Promise<boolean>;    // mehrere Handys: nur eines traegt ein
    savingText?: string;                // ein anderes Handy traegt gerade ein
    fromLobby?: boolean;                // aus der Anstoss-Lobby gestartet: Zurueck fuehrt dorthin
    initialPaused?: boolean;            // pausiert verlassen: beim Fortsetzen erst nach einem Tipp weiter
}>();

const emit = defineEmits<{
    exit: [];                                       // abbrechen, Spiel verwerfen
    lobby: [];                                      // vor dem Start zurueck in die Anstoss-Lobby (fuer alle)
    leave: [];                                      // zur Webseite, Spiel bleibt gespeichert
    saved: [match: Match, rematch: boolean];
    change: [progress: { startTeamIndex: number | null; actions: KnechtAction[]; refereeUsed: boolean; paused: boolean }];
    live: [action: KnechtLiveAction];
}>();

const game = useBiPoKnecht(props.match, props.startTeamIndex, props.actions);
const toast = useToast();

// ─── Einstellungen (bleiben fuer das naechste Spiel erhalten) ───
// v2: einmalig alle auf Auto zuruecksetzen (fruehere Versionen haben jede Wahl dauerhaft gespeichert)
const MODE_KEY = 'bipo_knecht_mode_v2';
const MODE_OPTIONS = [{ label: 'Auto', value: 'auto' }, { label: 'Spieler', value: 'player' }, { label: 'Schiri', value: 'referee' }];

// Auto: der Modus folgt der Bildschirm-Orientierung (hochkant = Spieler, quer = Schiedsrichter)
type ModeSetting = KnechtMode | 'auto';
const storedMode = localStorage.getItem(MODE_KEY);
const modeSetting = ref<ModeSetting>(storedMode === 'referee' || storedMode === 'player' ? storedMode : 'auto');
const swapped = ref(false);
// Mehrere Handys (siehe liveDevices.ts): jedes traegt fuer einen Spieler oder ein Tischende ein
const devices = computed(() => props.live?.devices ?? []);
const myDevice = computed(() => devices.value.find(device => device.id === props.live?.deviceId) ?? null);
const multiDevice = computed(() => devices.value.length > 1 && !!myDevice.value);
// Nur Spielermodus: dieses Handy liegt am Tischende phoneSide und zeigt die Becher des Gegners
const phoneSide = computed(() => multiDevice.value ? myDevice.value!.team : null);
const myPlayer = computed(() => multiDevice.value ? myDevice.value!.player : null);
const twoPhone = computed(() => phoneSide.value === 0 || phoneSide.value === 1);
const refereeUsed = ref(props.refereeUsed);
const paused = ref(!!props.initialPaused && props.startTeamIndex !== null);
const pauseReady = ref<string[]>([]);       // mehrere Handys: wer nach der Pause bereit ist
const pausedBy = ref<string | null>(null);    // mehrere Handys: wer pausiert hat
const { profileName } = useProfile();
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
    emit('change', { startTeamIndex: game.startTeamIndex.value, actions: game.actions.value, refereeUsed: refereeUsed.value, paused: paused.value });
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
    pausedBy.value = profileName.value ?? props.live?.devices?.find(device => device.id === props.live?.deviceId)?.name ?? null;
    paused.value = true;
    pauseReady.value = [];
    sheet.value = null;
};

// Weiter nach der Pause. Mehrere Handys: jedes drueckt "Bereit", sind alle bereit, geht es fuer alle weiter.
const resumeGame = () => {
    paused.value = false;
    pauseReady.value = [];
};
const myLiveId = computed(() => props.live?.deviceId ?? null);
const iAmPauseReady = computed(() => !!myLiveId.value && pauseReady.value.includes(myLiveId.value));
const setPauseReady = (ready: boolean) => {
    const id = myLiveId.value;
    if (!id) return;
    pauseReady.value = ready ? [...new Set([...pauseReady.value, id])] : pauseReady.value.filter(entry => entry !== id);
};
const pauseWaitText = computed(() => {
    const waiting = devices.value.filter(device => !pauseReady.value.includes(device.id));
    if (!waiting.length) return 'Alle bereit – weiter geht’s';
    const names = waiting.map(device => device.id === myLiveId.value ? 'dich' : deviceName(device));
    return `Warte auf ${names.join(', ')}`;
});
watch([pauseReady, devices, paused], () => {
    if (!paused.value || !multiDevice.value || !devices.value.length) return;
    if (devices.value.every(device => pauseReady.value.includes(device.id))) resumeGame();
});

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
const bottomTeam = computed(() => twoPhone.value ? phoneSide.value! : swapped.value ? 1 : 0);
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
// Mehrere Handys: eintragen nur fuer die eigenen Spieler (und Spieler, die kein Handy abdeckt).
// Traegt ein Handy fuer alle ein (Bindung "ganzer Tisch"), ist es wie ein einzelnes Handy, die anderen schauen zu.
const tracker = computed(() => getTrackerDevice(devices.value));
const tracksAll = computed(() => multiDevice.value && myDevice.value?.team === null);
const otherTracker = computed(() => tracker.value && tracker.value.id !== myDevice.value?.id ? tracker.value : null);
const canEnter = (team: number, player: number) => !twoPhone.value || canDeviceEnter(devices.value, props.live?.deviceId ?? null, team, player);
const isMyThrow = computed(() => game.allowedThrowers.value.some(player => canEnter(state.value.activeTeamIndex, player)));
const waitingForOther = computed(() => twoPhone.value && game.isStarted.value && state.value.status === 'playing' && !isMyThrow.value);
const waitText = computed(() => {
    if (otherTracker.value) return `🎯 ${deviceName(otherTracker.value)} trägt gerade für alle ein`;
    const team = state.value.activeTeamIndex;
    const names = game.allowedThrowers.value.map(player => getTeam(game.match, team).players[player]?.name).filter(Boolean);
    const who = names.length && getTeam(game.match, team).players.length > 1 ? names.join(' & ') : getTeamName(game.match, team);
    return `${who} ${names.length > 1 ? 'sind' : 'ist'} dran · Eingabe an einem anderen Handy`;
});
// Werfer auswaehlen nur unter den Spielern, fuer die dieses Handy eintraegt
watch(() => [twoPhone.value, devices.value] as const, () => {
    game.setInputFilter(twoPhone.value ? canEnter : null);
}, { immediate: true });
// Rueckgaengig nur fuer eigene Eintraege (sonst nimmt man den Wurf eines anderen Handys zurueck)
const lastEntryIsMine = computed(() => {
    const actions = game.actions.value;
    const last = actions.at(-1);
    if (!twoPhone.value || !last) return true;
    const before = game.getStateAfter(actions.length - 1);
    const team = 'team' in last ? last.team : before.activeTeamIndex;
    const players = 'player' in last ? [last.player] : getTeam(game.match, team).players.map((_, index) => index);
    return players.some(player => canEnter(team, player));
});
const undoEnabled = computed(() => game.canUndo.value && (lastEntryIsMine.value || !!game.pick.value));
// Kurz vibrieren und Hinweis zeigen, wenn man selbst dran ist (verschwindet nach kurzer Zeit)
const showMyTurn = ref(false);
let myTurnTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => twoPhone.value && isMyThrow.value && game.isStarted.value && state.value.status === 'playing', (mine, before) => {
    if (myTurnTimer) clearTimeout(myTurnTimer);
    showMyTurn.value = mine;
    if (!mine) return;
    if (!before && myPlayer.value !== null) navigator.vibrate?.(80);
    myTurnTimer = setTimeout(() => { showMyTurn.value = false; }, 2500);
});
// ─── Mehrere Handys: Werfer auf den getroffenen Bechern, Trinker fuer das getroffene Team ───
// Alle Modi: Werfer auf dem Becherplatz, darunter wer trinkt. Den Hinweis "... trinkt" gibt es nur mit mehreren
// Handys (auf einem gemeinsamen Handy wuerde er die Becher verdecken, auf die gerade geworfen wird).
const cupOwners = computed(() => getCupOwners(state.value));
const drinkNotice = ref<{ id: number; text: string; me: boolean } | null>(null);
let drinkTimer: ReturnType<typeof setTimeout> | null = null;
let knownRemovals = cupOwners.value.removals.length;
watch(() => cupOwners.value.removals, (removals) => {
    if (!twoPhone.value) { knownRemovals = removals.length; return; }
    const fresh = removals.slice(knownRemovals).filter(removal => removal.rackTeam === phoneSide.value);
    knownRemovals = removals.length;
    if (!fresh.length || !game.isStarted.value) return;
    const team = getTeam(game.match, phoneSide.value!);
    const me = myPlayer.value !== null && fresh.some(removal => removal.drinker === myPlayer.value);
    const names = [...new Set(fresh.map(removal => removal.drinker === myPlayer.value ? 'Du' : team.players[removal.drinker]?.name ?? ''))];
    const cups = fresh.length === 1 ? 'den Becher' : `${fresh.length} Becher`;
    drinkNotice.value = { id: Date.now(), me, text: `🍺 ${names.join(' & ')} ${names.length === 1 && names[0] === 'Du' ? 'trinkst' : names.length > 1 ? 'trinken' : 'trinkt'} ${cups}` };
    if (me) navigator.vibrate?.([120, 60, 120]);
    if (drinkTimer) clearTimeout(drinkTimer);
    drinkTimer = setTimeout(() => { drinkNotice.value = null; }, 4500);
});

// Fuer alle eintragen an/aus. Der bisherige Platz wird gemerkt, damit "aus" dorthin zurueckfuehrt.
const PREVIOUS_BINDING_KEY = 'bipo_knecht_previous_binding';
const toggleTrackAll = () => {
    const me = myDevice.value;
    const liveId = props.live?.id;
    if (!me || !liveId || otherTracker.value) return;
    sheet.value = null;
    if (me.team !== null) {
        try { localStorage.setItem(PREVIOUS_BINDING_KEY, JSON.stringify({ liveId, team: me.team, player: me.player })); } catch { /* egal */ }
        emit('live', { type: 'bind', binding: { team: null, player: null } });
        return;
    }
    // Zurueck auf den gemerkten Platz, sonst auf den ersten freien Spieler
    let previous: LiveDeviceBinding | null = null;
    try {
        const stored = JSON.parse(localStorage.getItem(PREVIOUS_BINDING_KEY) ?? 'null');
        if (stored?.liveId === liveId && (stored.team === 0 || stored.team === 1)) previous = { team: stored.team, player: stored.player ?? null };
    } catch { /* egal */ }
    const free = [0, 1].flatMap(team => getTeam(game.match, team).players.map((_, player) => ({ team, player } as LiveDeviceBinding)))
        .filter(binding => !devices.value.some(device => device.id !== me.id && device.team === binding.team && device.player === binding.player));
    const target = previous && free.some(binding => binding.team === previous!.team && binding.player === previous!.player) ? previous : free[0] ?? previous;
    if (target) emit('live', { type: 'bind', binding: target });
};

// Ein anderes Handy traegt jetzt (nicht mehr) fuer alle ein
watch(() => otherTracker.value?.id ?? null, (id, before) => {
    if (id && id !== before) toast.add({ severity: 'info', summary: `${deviceName(otherTracker.value)} trägt jetzt für alle ein`, detail: 'Dieses Handy zeigt nur noch den Spielstand.', life: 4000 });
    else if (!id && before && multiDevice.value) toast.add({ severity: 'info', summary: 'Jedes Handy trägt wieder selbst ein', life: 3000 });
});

// Live-Panel: Handy wechseln/abmelden schliesst das Menue
const onLiveAction = (action: KnechtLiveAction) => {
    if (action.type === 'stop' || action.type === 'leave') sheet.value = null;
    emit('live', action);
};

// "Shot-Zeit" zeigt nur ein Handy je Team (sonst landet "Spaeter" mehrfach auf der Liste)
const showsShot = (team: number) => !multiDevice.value || getTeamDevice(devices.value, team)?.id === myDevice.value?.id;


// ─── Knecht Pro: Wurfzeiten ("Zug starten") und genaue Kanten nach einem Kanten-Nullwurf ───
// Je Modus und Handy eingestellt (wie die Animationen): im Schiri-Modus standardmaessig an, im Spieler-Modus aus.
// Nur wenn dieses Handy den ganzen Tisch eintraegt (ein Handy, oder "fuer alle eintragen").
const PRO_KEYS: Record<KnechtMode, string> = { referee: 'bipo_knecht_pro', player: 'bipo_knecht_pro_player' };
const readPro = (key: string, fallback: boolean) => {
    try {
        const stored = localStorage.getItem(key);
        return stored === null ? fallback : stored === 'on';
    } catch {
        return fallback;
    }
};
// Knecht Pro ist in beiden Modi erst einmal aus (wer ihn eingeschaltet hat, behaelt ihn)
const proSettings = ref<Record<KnechtMode, boolean>>({ referee: readPro(PRO_KEYS.referee, false), player: readPro(PRO_KEYS.player, false) });
const proAvailable = computed(() => !twoPhone.value);
const proEnabled = computed(() => proSettings.value[mode.value]);
const proActive = computed(() => proEnabled.value && proAvailable.value);
const toggleProMode = () => {
    const current = mode.value;
    proSettings.value = { ...proSettings.value, [current]: !proSettings.value[current] };
    try { localStorage.setItem(PRO_KEYS[current], proSettings.value[current] ? 'on' : 'off'); } catch { /* egal */ }
};
const vibrationSupported = isVibrationSupported();

// Nahansicht bleibt offen, solange getippt wird; ohne Eingabe schliesst sie von selbst
const EDGE_PROMPT_DURATION = 6000;
// flipped: Spielermodus, der Werfer steht am oberen Tischende - die Nahansicht zeigt zu ihm
const edgePrompt = ref<{ index: number; edge: EdgeHit; standing: number[]; flipped: boolean } | null>(null);
let edgeTimer: ReturnType<typeof setTimeout> | null = null;
const restartEdgeTimer = () => {
    if (edgeTimer) clearTimeout(edgeTimer);
    edgeTimer = setTimeout(() => { edgePrompt.value = null; }, EDGE_PROMPT_DURATION);
};
watch(() => game.actions.value.length, (length, previous) => {
    const last = game.actions.value[length - 1];
    // Ballweg (Halten mit Lupe) bringt die Kontaktstellen schon mit: dann keine Nahansicht
    if (!proActive.value || length <= (previous ?? 0) || last?.type !== 'throw' || !last.edge || last.edge.contacts?.length) {
        if (length < (previous ?? 0)) edgePrompt.value = null;
        return;
    }
    // Becher, die zum Zeitpunkt des Wurfs noch standen (Ziel war das Rack des Gegners)
    const before = game.getStateAfter(length - 1);
    const hit = new Set(before.racks[1 - before.activeTeamIndex].hit);
    const flipped = !twoPhone.value && mode.value === 'player' && before.activeTeamIndex === topTeam.value;
    edgePrompt.value = { index: length - 1, edge: last.edge, standing: Array.from({ length: 10 }, (_, cup) => cup).filter(cup => !hit.has(cup)), flipped };
    restartEdgeTimer();
});
// Genaue Kante aus der Nahansicht in den gespeicherten Wurf uebernehmen
// Kante als reine Kopie in den Wurf (die Engine klont den Spielstand, reaktive Objekte darin liessen jeden weiteren Wurf scheitern)
const plainEdge = (edge: EdgeHit): EdgeHit => JSON.parse(JSON.stringify(edge));
const setEdge = (value: EdgeHit) => {
    const edge = plainEdge(value);
    const prompt = edgePrompt.value;
    const action = prompt ? game.actions.value[prompt.index] : undefined;
    if (!prompt || action?.type !== 'throw' || action.outcome !== 'miss') return;
    const actions = [...game.actions.value];
    actions[prompt.index] = { ...action, edge };
    game.replaceActions(actions);
    edgePrompt.value = { ...prompt, edge };
    restartEdgeTimer();
};

// Nach der Kante doch rein: der Fehlwurf wird zum Treffer auf diesen Becher (nur solange er der letzte Eintrag ist).
// Der Treffer laeuft wie ein normales Antippen (Animation, Bombe/Bouncer-Auswahl), die Kante kommt danach dazu.
const edgeCanHit = computed(() => {
    const prompt = edgePrompt.value;
    if (!prompt || prompt.index !== game.actions.value.length - 1 || prompt.edge.spinOut) return false;
    return getHittableCups(game.getStateAfter(prompt.index)).includes(prompt.edge.cup);
});
let pendingHitEdge: { index: number; cup: number; edge: EdgeHit } | null = null;
const edgeIntoCup = async (cup: number) => {
    const prompt = edgePrompt.value;
    const action = prompt ? game.actions.value[prompt.index] : undefined;
    if (!prompt || !edgeCanHit.value || action?.type !== 'throw') return;
    if (!getHittableCups(game.getStateAfter(prompt.index)).includes(cup)) return;
    const { spinOut: _spinOut, ...edge } = plainEdge(prompt.edge);
    edgePrompt.value = null;
    if (edgeTimer) clearTimeout(edgeTimer);
    game.undo();
    await nextTick();
    game.selectPlayer(action.player);
    pendingHitEdge = { index: prompt.index, cup, edge };
    game.tapCup(cup);
};
// Treffer eingetragen (sofort oder nach der Becherauswahl): Kante anhaengen
watch(() => game.actions.value.length, (length) => {
    const pending = pendingHitEdge;
    if (!pending) return;
    const last = game.actions.value[length - 1];
    if (length === pending.index + 1 && last?.type === 'throw' && last.outcome === 'hit' && last.cup === pending.cup) {
        const actions = [...game.actions.value];
        actions[pending.index] = { ...last, edge: pending.edge };
        game.replaceActions(actions);
    }
    pendingHitEdge = null;
});
// Becherauswahl abgebrochen: keine Kante mehr anhaengen
watch(() => game.pick.value, (pick, before) => { if (before && !pick && game.actions.value.length <= (pendingHitEdge?.index ?? -1)) pendingHitEdge = null; });

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
// ─── Knecht Pro: Trickshot erst nach einem Nullwurf ───
// Der Ball ging auf den Tisch (Nullwurf eingetragen), dann wurde er gefangen: der Trickshot-Knopf ist frei, bis etwas
// anderes eingetragen wird. Antippen macht aus dem Nullwurf den Fang. Airball: der Ball ist weg, kein Fang.
// War es der letzte Ball des Zugs, geht es nicht von selbst weiter: "Gefangen – Trickshot" oder "Zug beenden".
const catchWindow = ref<{ index: number; team: number } | null>(null);
watch(() => game.actions.value.length, (length, previous) => {
    catchWindow.value = null;
    const last = game.actions.value[length - 1];
    if (!proActive.value || length <= (previous ?? 0) || last?.type !== 'throw' || last.outcome !== 'miss') return;
    catchWindow.value = { index: length - 1, team: game.getStateAfter(length - 1).activeTeamIndex };
});
const roundEndPending = computed(() => {
    const window = catchWindow.value;
    return !!window && proActive.value && game.state.value.status === 'playing' && game.state.value.activeTeamIndex !== window.team;
});
// Spielermodus: Abfrage zum Team, das gerade geworfen hat
const roundEndFlipped = computed(() => !twoPhone.value && mode.value === 'player' && catchWindow.value?.team === topTeam.value);
const endRound = () => { catchWindow.value = null; };
// Fang-Auswahl abgebrochen: der Nullwurf kommt zurueck
let missBeforeCatch: KnechtAction | null = null;
watch(sheet, (value, before) => {
    if (before !== 'trickshot' || value === 'trickshot' || !missBeforeCatch) return;
    const miss = missBeforeCatch;
    missBeforeCatch = null;
    game.replaceActions([...game.actions.value, miss]);
});

const openTrickshot = async () => {
    // Umschalter: ein noch nicht geworfener Trickshot wird beim erneuten Tippen zurueckgenommen
    if (game.trickshotPending.value) return game.undo();
    const window = catchWindow.value;
    const miss = window ? game.actions.value[window.index] : undefined;
    if (proActive.value) {
        if (!window || window.index !== game.actions.value.length - 1 || miss?.type !== 'throw') return;
        // Nullwurf zuruecknehmen, der Ball ist gefangen: gleicher Werfer, dann wie bisher
        edgePrompt.value = null;
        game.undo();
        await nextTick();
        game.selectPlayer(miss.player);
        // Ohne Ton: der Nullwurf hatte schon seinen
        if (activeTeam.value.players.length === 1) return game.trickshot(0, true);
        missBeforeCatch = miss;
        sheet.value = 'trickshot';
        return;
    }
    // Im 1 gegen 1 faengt nur einer: kein Auswahl-Sheet
    if (activeTeam.value.players.length === 1) game.trickshot(0);
    else sheet.value = 'trickshot';
};

const catchTrickshot = (catcher: number) => {
    const fromMiss = !!missBeforeCatch;
    missBeforeCatch = null;
    game.trickshot(catcher, fromMiss);
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
        text: multiDevice.value ? 'Das Spiel wird auf allen Handys abgebrochen und nicht gespeichert.' : 'Das Spiel wird abgebrochen und nicht gespeichert.',
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

// ─── Start aus der Anstoss-Lobby: kein "Wer faengt an?", nur Schnick-Schnack-Schnuck als Popup ueber dem Feld ───
// Jedes Handy rechnet dasselbe Ergebnis aus (Startwert = Live-Spiel). Wer zuerst fertig ist, startet; die anderen
// bekommen den Start auch ueber den Abgleich. Die Spielzeit laeuft ab der Entscheidung.
const lobbyStart = computed(() => !!props.fromLobby && !!props.live?.id);
const rpsVisible = ref(lobbyStart.value && !game.isStarted.value);
const onRpsDecided = (teamIndex: number) => {
    if (!game.isStarted.value) startGame(teamIndex);
};
const onRpsDone = () => { rpsVisible.value = false; };

// ─── Zweites Handy / Live: aktueller Stand und Stand vom anderen Handy uebernehmen ───
const getProgress = (): LiveProgress => ({
    startTeamIndex: game.startTeamIndex.value,
    startedAt: game.startTeamIndex.value !== null ? game.match.time ?? null : null,
    actions: game.actions.value,
    // Becherfarben koennen sich nach dem Anlegen noch aendern (Startdialog, Menue)
    match: game.match,
    paused: paused.value,
    pausedBy: paused.value ? pausedBy.value : null,
    pauseReady: paused.value ? pauseReady.value : [],
});

const applyRemote = (remote: LiveProgress): boolean => {
    // Pause gilt fuer beide Handys (sonst wuerde das andere Handy sie beim naechsten Abgleich wieder aufheben)
    if (typeof remote.paused === 'boolean' && remote.paused !== paused.value) paused.value = remote.paused;
    if (remote.paused) pausedBy.value = remote.pausedBy ?? null;
    pauseReady.value = remote.paused ? [...(remote.pauseReady ?? [])] : [];
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
watch([game.actions, game.startTeamIndex, refereeUsed, paused, pauseReady], () => {
    emit('change', { startTeamIndex: game.startTeamIndex.value, actions: game.actions.value, refereeUsed: refereeUsed.value, paused: paused.value });
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
.kn-pause-tap{ cursor: pointer; }
.kn-pause-hint{
    font-size: 13px;
    font-weight: 700;
    color: var(--bp-text-muted);
    animation: kn-pause-blink 1.6s ease-in-out infinite;
}
@keyframes kn-pause-blink{ 50%{ opacity: .45; } }
.kn-pause-by{
    margin-top: -4px;
    font-size: 14px;
    font-weight: 700;
    opacity: .75;
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
.kn-confirm-actions .kn-menu-sublabel{
    margin-bottom: -4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--bp-text-muted);
}
.kn-menu-button{
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
/* Mehrere Handys: selbst dran. Sitzt im eigenen Tischende (dort wird gerade nicht getippt) */
.kn-end--own{ position: relative; }
.kn-myturn{
    position: absolute;
    left: 50%;
    top: 10px;
    z-index: 6;
    transform: translateX(-50%);
    padding: 7px 14px;
    border-radius: 999px;
    background: var(--main-color);
    color: white;
    font-size: 14px;
    font-weight: 800;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 6px 16px rgba(0, 0, 0, .2);
}
.kn-myturn-enter-active, .kn-myturn-leave-active{ transition: opacity .25s ease; }
.kn-myturn-enter-from, .kn-myturn-leave-to{ opacity: 0; }

/* Mehrere Handys: wer trinkt */
.kn-drink{
    position: absolute;
    left: 50%;
    bottom: 22%;
    z-index: 21;    /* ueber der grauen Sperre (kn-wait) */
    transform: translateX(-50%);
    padding: 9px 16px;
    border-radius: 999px;
    background: #F5B82E;
    color: #1F2328;
    font-size: 15px;
    font-weight: 800;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 8px 22px rgba(0, 0, 0, .22);
}
.kn-drink--me{
    font-size: 18px;
    animation: kn-drink-pulse .6s ease-in-out 3;
}
@keyframes kn-drink-pulse{ 50%{ transform: translateX(-50%) scale(1.08); } }
.kn-drink-enter-active, .kn-drink-leave-active{ transition: opacity .25s ease, translate .25s ease; }
.kn-drink-enter-from, .kn-drink-leave-to{ opacity: 0; translate: 0 12px; }

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
