<template>
    <div
        class="KnechtPlayers"
        :class="{ 'kn-players--active': isActive, 'kn-players--rotated': rotated, 'kn-players--compact': compact }"
        :style="{ '--kn-team-color': TEAM_COLORS[teamIndex] }"
    >
        <div class="kn-players-header">
            <Avatar v-if="team.logo" :name="teamName" :avatarImage="team.logo" shape="square" class="kn-team-logo" />
            <span class="kn-team-name">{{ teamName }}</span>
            <span v-if="isActive" class="kn-turn-badge">{{ turnBadge }}</span>
            <span class="kn-team-score">{{ formatPoints(teamPoints) }} <small>Becher</small></span>
        </div>

        <div class="kn-player-list" :class="{ 'kn-player-list--single': team.players.length === 1 }">
            <button
                v-for="(player, playerIndex) in team.players"
                :key="playerIndex"
                type="button"
                class="kn-player"
                :class="getPlayerClass(playerIndex)"
                :disabled="!isActive || !game.allowedThrowers.value.includes(playerIndex)"
                @click="game.selectPlayer(playerIndex)"
            >
                <Avatar :name="player.name" :avatarImage="team.players.length === 1 ? team.logo : undefined" class="kn-player-avatar" />
                <span class="kn-player-text">
                    <span class="kn-player-name">
                        {{ player.name }}
                        <span v-if="getFire(playerIndex) === 'on-fire'" class="kn-fire" title="On Fire"><KnechtIcon name="onfire" /><KnechtIcon name="onfire" /></span>
                        <span v-else-if="getFire(playerIndex) === 'heating-up'" class="kn-fire" title="Heating Up"><KnechtIcon name="onfire" /></span>
                    </span>
                    <span class="kn-player-stats">{{ getPlayerLine(playerIndex) }}</span>
                </span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import KnechtIcon from './KnechtIcon.vue';
import { getBallNumber, getPlayerPoints, getTeamPoints, isOnFireEnabled } from './knechtEngine';
import { TEAM_COLORS, formatPoints, getTeam, getTeamName } from './KnechtUtilFunctions';
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
const playerPoints = computed(() => getPlayerPoints(state.value)[props.teamIndex]);

const turnBadge = computed(() => {
    if (state.value.nachwurfTeamIndex === props.teamIndex) return 'Nachwurf';
    if (state.value.round.ballsBack) return `Balls Back · Ball ${getBallNumber(state.value)}/2`;
    return `Ball ${getBallNumber(state.value)}/2`;
});

const getFire = (playerIndex: number) => {
    if (!isOnFireEnabled(state.value, props.teamIndex)) return 'normal';
    const streak = state.value.streaks[props.teamIndex][playerIndex] ?? 0;
    return streak >= 3 ? 'on-fire' : streak === 2 ? 'heating-up' : 'normal';
};

const getPlayerClass = (playerIndex: number) => {
    const allowed = props.game.allowedThrowers.value.includes(playerIndex);
    return {
        'kn-player--selected': isActive.value && props.game.selectedPlayer.value === playerIndex,
        'kn-player--done': isActive.value && props.game.playersDone.value.includes(playerIndex),
        'kn-player--locked': isActive.value && !allowed,
    };
};

const getPlayerLine = (playerIndex: number) => {
    const points = formatPoints(playerPoints.value[playerIndex] ?? 0);
    const streak = state.value.streaks[props.teamIndex][playerIndex] ?? 0;
    const parts = [`${points} Becher`];
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
    padding: 8px 10px 10px;
    background: white;
    transition: opacity .25s ease, filter .25s ease;
}
.kn-players--rotated{ transform: rotate(180deg); }
.KnechtPlayers:not(.kn-players--active){
    opacity: .5;
    filter: grayscale(.8);
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
    text-overflow: ellipsis;
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
    color: #1F2328;
    white-space: nowrap;
}
.kn-team-score small{
    font-size: 10px;
    font-weight: 600;
    color: #6B7079;
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
    border: 1.5px solid #E6E8EB;
    border-radius: 12px;
    background: white;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color .2s ease, background .2s ease, opacity .2s ease, box-shadow .2s ease;
}
.kn-player:disabled{
    cursor: default;
}
.kn-player--selected{
    border-color: var(--kn-team-color);
    background: color-mix(in srgb, var(--kn-team-color) 9%, white);
    box-shadow: 0 0 0 1px var(--kn-team-color);
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
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 700;
    color: #1F2328;
}
.kn-fire{
    font-size: 13px;
    color: #F76B15;
}
.kn-player-stats{
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: #6B7079;
}

/* Kompakt: wartendes Team im Spielermodus */
.kn-players--compact .kn-player-list{ display: none; }
.kn-players--compact{ padding: 6px 10px; }
</style>
