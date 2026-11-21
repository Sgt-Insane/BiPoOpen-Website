<template>
    <div
        class="KnechtPlayers"
        :class="{ 'kn-players--active': isActive, 'kn-players--rotated': rotated, 'kn-players--compact': compact }"
        :style="{ '--kn-team-color': getTeamColor(game.match, teamIndex) }"
    >
        <div class="kn-players-header">
            <Avatar v-if="team.logo" :name="teamName" :avatarImage="team.logo" shape="square" class="kn-team-logo" />
            <span class="kn-team-name" v-fit-text>{{ teamName }}</span>
            <span v-if="isActive" class="kn-turn-badge"><GlossaryWord v-if="turnBadge === 'Nachwurf'" term="gentleman">Nachwurf</GlossaryWord><template v-else>{{ turnBadge }}</template></span>
            <!-- Airballs bis zum naechsten Shot -->
            <span v-if="airballsTowardsShot > 0" class="kn-shot-pill" v-hint="`${airballsTowardsShot} von 3 Airballs bis zum Shot`">🥃 {{ airballsTowardsShot }}/3</span>
            <!-- Serie auch sichtbar, wenn das Team gerade nicht wirft (Liste eingeklappt) -->
            <span v-for="hot in hotPlayers" :key="hot.playerIndex" class="kn-fire-pill" :class="`kn-fire-pill--${hot.fire}`" v-hint="`${hot.name}: ${hot.fire === 'on-fire' ? 'On Fire' : 'Heaten Up'}`">
                <KnechtIcon :name="hot.fire === 'on-fire' ? 'onfire' : 'heating'" />
                <span>{{ hot.name }}</span>
            </span>
            <span class="kn-team-score">{{ formatPoints(teamPoints) }} <small><GlossaryWord term="getroffen">getroffen</GlossaryWord></small></span>
        </div>

        <div class="kn-player-list" :class="{ 'kn-player-list--single': team.players.length === 1 }">
            <button
                v-for="(player, playerIndex) in team.players"
                :key="playerIndex"
                type="button"
                class="kn-player"
                :class="getPlayerClass(playerIndex)"
                :disabled="!isActive || !game.allowedThrowers.value.includes(playerIndex)"
                @click="choosePlayer(playerIndex)"
            >
                <Avatar :name="player.name" :avatarImage="team.players.length === 1 ? team.logo : undefined" class="kn-player-avatar" />
                <span class="kn-player-text">
                    <span class="kn-player-name" v-fit-text>
                        {{ player.name }}
                        <span v-if="getFire(playerIndex) === 'on-fire'" class="kn-fire" v-hint="'On Fire'"><KnechtIcon name="onfire" /><KnechtIcon name="onfire" /></span>
                        <span v-else-if="getFire(playerIndex) === 'heating-up'" class="kn-fire" v-hint="'Heaten Up'"><KnechtIcon name="heating" /></span>
                    </span>
                    <span class="kn-player-stats" v-fit-text>{{ getPlayerLine(playerIndex) }}</span>
                </span>
            </button>
        </div>
        <!-- Nutzertest: Neulinge merken nicht, dass man den Werfer umschalten kann. Hinweis, bis einmal umgeschaltet wurde. -->
        <div v-if="showThrowerHint" class="kn-thrower-hint">Wirft jemand anderes? Namen antippen.</div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import GlossaryWord from '@/components/shared/GlossaryWord.vue';
import KnechtIcon from './KnechtIcon.vue';
import { getBallNumber, getFinalPlayerPoints, getTeamPoints, isOnFireEnabled } from './knechtEngine';
import { getTeamColor, formatPoints, getTeam, getTeamName } from './KnechtUtilFunctions';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const props = defineProps<{
    game: BiPoKnechtGame;
    teamIndex: number;
    rotated?: boolean;
    compact?: boolean;
}>();

const state = computed(() => props.game.state.value);
const team = computed(() => getTeam(props.game.match, props.teamIndex));
const teamName = computed(() => getTeamName(props.game.match, props.teamIndex));
const isActive = computed(() => props.game.isStarted.value && state.value.status === 'playing' && state.value.activeTeamIndex === props.teamIndex);
const teamPoints = computed(() => getTeamPoints(state.value)[props.teamIndex]);
const playerPoints = computed(() => getFinalPlayerPoints(state.value)[props.teamIndex]);

const turnBadge = computed(() => {
    if (state.value.nachwurfTeamIndex === props.teamIndex) return 'Nachwurf';
    // Letzter Becher getroffen, der Zug laeuft noch: der naechste Ball darf nur noch in diesen Becher (beide drin = Sofortsieg)
    if (state.value.decider?.teamIndex === props.teamIndex) return 'Letzter Becher · 2. Ball auch rein = Sofortsieg';
    if (state.value.round.ballsBack) return `Balls Back · Ball ${getBallNumber(state.value)}/2`;
    return `Am Zug · Ball ${getBallNumber(state.value)}/2`;
});

// ─── Hinweis zum Werfer-Wechsel ───
// Bleibt auf diesem Geraet, bis jemand einmal einen anderen Werfer gewaehlt hat oder ein Spiel zu Ende ist.
const HINT_KEY = 'knechtThrowerHintSeen';
const readHintSeen = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };
const hintSeen = ref(readHintSeen());
const markHintSeen = () => {
    hintSeen.value = true;
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* privater Modus: Hinweis kommt beim naechsten Mal wieder */ }
};
const showThrowerHint = computed(() => !hintSeen.value && isActive.value && props.game.allowedThrowers.value.length > 1);
watch(() => props.game.isOver.value, over => { if (over) markHintSeen(); });

const choosePlayer = (playerIndex: number) => {
    if (playerIndex !== props.game.selectedPlayer.value && props.game.allowedThrowers.value.includes(playerIndex)) markHintSeen();
    props.game.selectPlayer(playerIndex);
};

const getFire = (playerIndex: number) => {
    if (!isOnFireEnabled(state.value, props.teamIndex)) return 'normal';
    const streak = state.value.streaks[props.teamIndex][playerIndex] ?? 0;
    return streak >= 3 ? 'on-fire' : streak === 2 ? 'heating-up' : 'normal';
};

const airballsTowardsShot = computed(() => state.value.turns.filter(turn => turn.type === 'airball' && turn.teamIndex === props.teamIndex).length % 3);

const hotPlayers = computed(() => team.value.players
    .map((player, playerIndex) => ({ playerIndex, name: player.name, fire: getFire(playerIndex) }))
    .filter(entry => entry.fire !== 'normal'));

const getPlayerClass = (playerIndex: number) => {
    const allowed = props.game.allowedThrowers.value.includes(playerIndex);
    return {
        'kn-player--selected': isActive.value && props.game.selectedPlayer.value === playerIndex,
        'kn-player--done': isActive.value && props.game.playersDone.value.includes(playerIndex),
        'kn-player--locked': isActive.value && !allowed,
        'kn-player--heating-up': getFire(playerIndex) === 'heating-up',
        'kn-player--on-fire': getFire(playerIndex) === 'on-fire',
    };
};

const getPlayerLine = (playerIndex: number) => {
    const points = formatPoints(playerPoints.value[playerIndex] ?? 0);
    const streak = state.value.streaks[props.teamIndex][playerIndex] ?? 0;
    const parts = [`${points} getroffen`];
    if (streak > 0) parts.push(`Serie ${streak}`);
    if (isActive.value && props.game.playersDone.value.includes(playerIndex)) parts.push('hat geworfen');
    else if (isActive.value && props.game.selectedPlayer.value === playerIndex) parts.push('wirft');
    return parts.join(' · ');
};
</script>

<style scoped>
.KnechtPlayers{
    display: flex;
    flex-direction: column;
    gap: 6px;
    container-type: inline-size;
    padding: 8px 10px 10px;
    background: var(--bp-surface);
    transition: opacity .25s ease, filter .25s ease;
}
.kn-players--rotated{ transform: rotate(180deg); }
.KnechtPlayers:not(.kn-players--active) .kn-players-header > :not(.kn-fire-pill):not(.kn-shot-pill),
.KnechtPlayers:not(.kn-players--active) .kn-player-list{
    opacity: .5;
    filter: grayscale(.8);
}

/* Heaten Up / On Fire: auch beim wartenden Team gut sichtbar */
.kn-shot-pill{
    padding: 2px 7px;
    border-radius: 999px;
    background: #FFF1D6;
    color: #8A5A00;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
}
.kn-fire-pill{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 2px 8px;
    border-radius: 999px;
    color: white;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
}
.kn-fire-pill--heating-up{
    background: #F76B15;
    animation: kn-fire-pulse 1.4s ease-in-out infinite;
}
.kn-fire-pill--on-fire{
    background: linear-gradient(90deg, #E5484D, #F76B15, #F5A524, #F76B15, #E5484D);
    background-size: 200% 100%;
    animation: kn-fire-flow 1.2s linear infinite, kn-fire-pulse 1s ease-in-out infinite;
}
@keyframes kn-fire-pulse{
    0%, 100%{ box-shadow: 0 0 0 0 rgba(247, 107, 21, .55); }
    50%{ box-shadow: 0 0 0 5px rgba(247, 107, 21, 0); }
}
@keyframes kn-fire-flow{
    0%{ background-position: 0 0; }
    100%{ background-position: 200% 0; }
}
.kn-player--heating-up{
    border-color: #F76B15;
    box-shadow: 0 0 0 1px #F76B15, 0 0 12px rgba(247, 107, 21, .35);
}
.kn-player--on-fire{
    border-color: #E5484D;
    animation: kn-player-fire 1s ease-in-out infinite alternate;
}
@keyframes kn-player-fire{
    0%{ box-shadow: 0 0 0 1px #E5484D, 0 0 10px rgba(229, 72, 77, .45); }
    100%{ box-shadow: 0 0 0 2px #F5A524, 0 0 22px rgba(247, 107, 21, .7); }
}
@media (prefers-reduced-motion: reduce){
    .kn-fire-pill, .kn-player--on-fire{ animation: none; }
}

.kn-players-header{
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 22px;
}
.kn-team-logo{
    width: 22px !important;
    height: 22px !important;
    min-width: 22px;
}
.kn-team-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: var(--kn-team-color);
}
.kn-turn-badge{
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--kn-team-color);
    color: white;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
    white-space: nowrap;
}
.kn-team-score{
    font-size: 16px;
    font-weight: 800;
    color: var(--bp-text-strong);
    white-space: nowrap;
}
.kn-team-score small{
    font-size: 10px;
    font-weight: 600;
    color: var(--bp-text-muted);
}

.kn-player-list{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 6px;
}
.kn-player-list--single{
    grid-template-columns: minmax(0, 320px);
    justify-content: center;
}
.kn-player{
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 7px 9px;
    border: 1.5px solid var(--bp-border);
    border-radius: 12px;
    background: var(--bp-surface);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color .2s ease, background .2s ease, opacity .2s ease, box-shadow .2s ease;
}
.kn-player:disabled{
    cursor: default;
}
/* Wer gerade wirft: kraeftig in Teamfarbe, damit man es auch aus der Entfernung am Tisch sieht */
.kn-player--selected{
    border-color: var(--kn-team-color);
    background: color-mix(in srgb, var(--kn-team-color) 16%, var(--bp-surface));
    box-shadow: 0 0 0 2px var(--kn-team-color);
}
.kn-player--selected .kn-player-stats{
    color: var(--kn-team-color);
    font-weight: 700;
}
.kn-thrower-hint{
    font-size: 11px;
    text-align: center;
    color: var(--bp-text-muted);
}
.kn-player--done,
.kn-player--locked{
    opacity: .4;
}
.kn-player-avatar{
    width: 30px !important;
    height: 30px !important;
    min-width: 30px;
    font-size: 11px !important;
}
.kn-player-text{
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.kn-player-name{
    overflow: hidden;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.kn-fire{
    font-size: 13px;
    color: #F76B15;
}
.kn-player-stats{
    overflow: hidden;
    white-space: nowrap;
    font-size: 11px;
    color: var(--bp-text-muted);
}

/* Schmal (z.B. werfendes Team auf dem kleinen Tisch im Schiri-Modus): alles in einer flachen Leiste, damit das
   Spielfeld gross bleibt. Kopf in einer Zeile (Teamname, Am Zug, Punkte), Karten nebeneinander ohne Profilbild.
   Heaten Up / On Fire steht dann an der Karte, nicht doppelt im Kopf. Nichts wird uebereinandergeschoben. */
@container (max-width: 420px){
    .KnechtPlayers{ gap: 4px; padding: 5px 8px 6px; }
    .kn-players-header{ gap: 5px; min-height: 18px; }
    .KnechtPlayers:not(.kn-players--compact) .kn-fire-pill{ display: none; }
    .kn-fire-pill{ max-width: 100%; }
    .kn-fire-pill > span{ white-space: normal; overflow-wrap: anywhere; }
    .kn-turn-badge{ padding: 1px 6px; font-size: 9px; letter-spacing: .02em; }
    .kn-team-score{ font-size: 14px; }
    .kn-team-score small{ display: none; }
    .kn-player-list{ gap: 4px; }
    .kn-player{ padding: 3px 7px; border-radius: 9px; }
    .kn-player-avatar{ display: none !important; }
    .kn-player-name{ font-size: 13px; }
    .kn-player-stats{ font-size: 10px; }
    .kn-thrower-hint{ display: none; }
}

/* Kompakt: wartendes Team im Spielermodus */
.kn-players--compact .kn-player-list{ display: none; }
.kn-players--compact{ padding: 6px 10px; }
</style>
