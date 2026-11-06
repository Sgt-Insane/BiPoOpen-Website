<template>
    <div class="KnechtScoreboard">
        <div v-for="teamIndex in [0, 1]" :key="teamIndex"
            class="kn-score-team"
            :class="{ 'kn-score-team--winner': state.winnerTeamIndex === teamIndex }"
            :style="{ '--kn-team-color': TEAM_COLORS[teamIndex] }"
        >
            <div class="kn-score-header">
                <Avatar :name="getTeamName(match, teamIndex)" :avatarImage="getTeam(match, teamIndex).logo" :shape="getTeam(match, teamIndex).logo ? 'square' : 'circle'" class="kn-score-logo" />
                <span class="kn-score-name">{{ getTeamName(match, teamIndex) }}</span>
                <span v-if="state.winnerTeamIndex === teamIndex" class="kn-win-badge">Sieg</span>
                <span class="kn-score-total">{{ formatPoints(teamPoints[teamIndex]) }}</span>
            </div>

            <div v-for="stats in statsOf(teamIndex)" :key="stats.playerIndex" class="kn-score-player">
                <div class="kn-score-player-head">
                    <span class="kn-score-player-name">{{ stats.name }}</span>
                    <span class="kn-score-player-points">{{ formatPoints(stats.points) }} <small>Becher</small></span>
                </div>
                <div class="kn-score-line">
                    {{ stats.hits }}/{{ stats.throws }} Treffer · {{ getAccuracy(stats) }} % · beste Serie {{ stats.bestStreak }}
                </div>
                <div v-if="getSpecials(stats).length" class="kn-score-specials">
                    <span v-for="special in getSpecials(stats)" :key="special.text" class="kn-score-special"><KnechtIcon :name="special.icon" /> {{ special.text }}</span>
                </div>
            </div>

            <div class="kn-score-footer">
                Re-Racks übrig: {{ state.reRacksLeft[teamIndex] }}
                <template v-if="state.nachwurfTeamIndex === teamIndex"> · Nachwurf läuft</template>
            </div>
        </div>

        <div v-if="state.overtimeCount" class="kn-score-note"><KnechtIcon name="overtime" /> {{ state.overtimeCount }}. Verlängerung (2×3 Becher)</div>
        <div v-if="state.victoryBonus" class="kn-score-note"><KnechtIcon name="win" /> Siegpunkt: Gleichstand aufgelöst (+{{ formatPoints(state.victoryBonus) }})</div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import KnechtIcon from './KnechtIcon.vue';
import type { KnechtIconName } from './knechtIcons';
import { getTeamPoints, type KnechtState } from './knechtEngine';
import { TEAM_COLORS, formatPoints, getAccuracy, getPlayerStats, getTeam, getTeamName, type KnechtPlayerStats } from './KnechtUtilFunctions';

const props = defineProps<{ match: Match; state: KnechtState }>();

const teamPoints = computed(() => getTeamPoints(props.state));
const stats = computed(() => getPlayerStats(props.match, props.state));
const statsOf = (teamIndex: number) => stats.value.filter(entry => entry.teamIndex === teamIndex);

const getSpecials = (stats: KnechtPlayerStats) => ([
    stats.bombs && { icon: 'bomb', text: `${stats.bombs} Bombe${stats.bombs > 1 ? 'n' : ''}` },
    stats.bouncers && { icon: 'bouncer', text: `${stats.bouncers} Bouncer` },
    stats.ballsBacks && { icon: 'ballsback', text: `${stats.ballsBacks} Balls Back` },
    stats.onFires && { icon: 'onfire', text: `${stats.onFires}× On Fire` },
    stats.trickshotHits && { icon: 'trickshot', text: `${stats.trickshotHits} Trickshot` },
    stats.airballs && { icon: 'airball', text: `${stats.airballs} Airball${stats.airballs > 1 ? 's' : ''}` },
    stats.lastCups && { icon: 'lastCup', text: 'Letzter Becher' },
    stats.deathcups && { icon: 'deathcup', text: 'Deathcup' },
    stats.ownCups && { icon: 'owncup', text: `${stats.ownCups} eigene${stats.ownCups > 1 ? '' : 'r'} Becher` },
] as const).filter((entry): entry is { icon: KnechtIconName; text: string } => !!entry);
</script>

<style scoped>
.KnechtScoreboard{
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.kn-score-team{
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border: 1px solid #E6E8EB;
    border-top: 4px solid var(--kn-team-color);
    border-radius: 16px;
    background: white;
}
.kn-score-team--winner{
    background: #FFF7F8;
    box-shadow: 0 0 0 1px var(--main-color);
}
.kn-score-header{
    display: flex;
    align-items: center;
    gap: 8px;
}
.kn-score-logo{
    width: 32px !important;
    height: 32px !important;
    min-width: 32px;
    font-size: 12px !important;
}
.kn-score-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 700;
    color: #1F2328;
}
.kn-win-badge{
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--main-color);
    color: white;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
}
.kn-score-total{
    font-size: 24px;
    font-weight: 800;
    color: #1F2328;
}
.kn-score-player{
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 10px;
    border-top: 1px dashed #E6E8EB;
}
.kn-score-player-head{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}
.kn-score-player-name{
    font-size: 14px;
    font-weight: 700;
    color: #1F2328;
}
.kn-score-player-points{
    font-size: 16px;
    font-weight: 800;
    color: #1F2328;
}
.kn-score-player-points small{
    font-size: 11px;
    font-weight: 600;
    color: #6B7079;
}
.kn-score-line{
    font-size: 12px;
    color: #6B7079;
}
.kn-score-specials{
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.kn-score-special{
    padding: 2px 8px;
    border-radius: 999px;
    background: #F1F2F4;
    color: #3A3F46;
    font-size: 11px;
    font-weight: 600;
}
.kn-score-footer{
    font-size: 11px;
    color: #8A9099;
}
.kn-score-note{
    padding: 10px 12px;
    border-radius: 12px;
    background: #F6F7F9;
    color: #3A3F46;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
}
</style>
