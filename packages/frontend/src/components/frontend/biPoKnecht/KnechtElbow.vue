<template>
    <div class="KnechtElbow">
        <!-- Schritt 1: wer war mit dem Ellenbogen ueber der Tischkante? -->
        <template v-if="selected === null">
            <div class="kn-elbow-hint">1. Call je Person: gelbe Karte (Verwarnung). Ab dem 2. Call: rote Karte und ein Strafbecher.</div>
            <div v-for="teamIndex in [0, 1]" :key="teamIndex" class="kn-elbow-team" :style="{ '--kn-team-color': getTeamColor(game.match, teamIndex) }">
                <div class="kn-elbow-team-name">{{ getTeamName(game.match, teamIndex) }}</div>
                <button v-for="(player, playerIndex) in getTeam(game.match, teamIndex).players" :key="playerIndex"
                    type="button" class="kn-elbow-player" @click="choose(teamIndex, playerIndex)">
                    <span class="kn-elbow-name" v-fit-text>{{ player.name }}</span>
                    <span class="kn-elbow-cards">
                        <span v-for="call in calls(teamIndex, playerIndex)" :key="call" class="kn-elbow-card" :class="call === 1 ? 'kn-elbow-card--yellow' : 'kn-elbow-card--red'"></span>
                    </span>
                    <span class="kn-elbow-next" :class="isNextElbowRed(state, teamIndex, playerIndex) ? 'kn-elbow-next--red' : 'kn-elbow-next--yellow'">
                        {{ isNextElbowRed(state, teamIndex, playerIndex) ? 'Rot + Strafbecher' : 'Gelb' }}
                    </span>
                </button>
            </div>
        </template>

        <!-- Schritt 2 (rot): welcher eigene Becher kommt vom Tisch? -->
        <template v-else>
            <div class="kn-elbow-hint">
                Rote Karte für {{ getPlayerName(game.match, selected.team, selected.player) }}: welcher Becher von
                {{ getTeamName(game.match, selected.team) }} kommt vom Tisch?
            </div>
            <div class="kn-elbow-pyramid" :style="{ '--kn-team-color': getTeamColor(game.match, selected.team) }">
                <div v-for="(row, rowIndex) in ROWS" :key="rowIndex" class="kn-elbow-row">
                    <button v-for="cup in row" :key="cup" type="button" class="kn-elbow-cup"
                        :class="{ 'kn-elbow-cup--gone': !standing.includes(cup) }"
                        :disabled="!standing.includes(cup)"
                        @click="game.elbow(selected.team, selected.player, [cup]); $emit('done')">{{ cup + 1 }}</button>
                </div>
            </div>
            <button type="button" class="kn-menu-button" @click="selected = null">Zurück</button>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getStandingCups, isNextElbowRed } from './knechtEngine';
import { getPlayerName, getTeam, getTeamColor, getTeamName } from './KnechtUtilFunctions';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const props = defineProps<{ game: BiPoKnechtGame }>();
const emit = defineEmits<{ done: [] }>();

// Becher aus Sicht des Teams, dem sie gehoeren: Spitze unten
const ROWS = [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]];

const state = computed(() => props.game.state.value);
const selected = ref<{ team: number; player: number } | null>(null);
const standing = computed(() => selected.value ? getStandingCups(state.value.racks[selected.value.team]) : []);
const calls = (team: number, player: number) => Array.from({ length: state.value.elbowCalls[team]?.[player] ?? 0 }, (_, index) => index + 1);

const choose = (team: number, player: number) => {
    if (isNextElbowRed(state.value, team, player)) {
        selected.value = { team, player };
        return;
    }
    props.game.elbow(team, player, []);
    emit('done');
};
</script>

<style scoped>
.KnechtElbow{
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.kn-elbow-hint{
    font-size: 13px;
    color: var(--bp-text-muted);
}
.kn-elbow-team{
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.kn-elbow-team-name{
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: var(--kn-team-color);
}
.kn-elbow-player{
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: 1.5px solid var(--bp-border);
    border-left: 4px solid var(--kn-team-color);
    border-radius: 12px;
    background: var(--bp-surface);
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.kn-elbow-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.kn-elbow-cards{
    display: flex;
    gap: 3px;
}
.kn-elbow-card{
    width: 12px;
    height: 16px;
    border-radius: 2px;
}
.kn-elbow-card--yellow{ background: #F5C518; }
.kn-elbow-card--red{ background: #E5484D; }
.kn-elbow-next{
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
}
.kn-elbow-next--yellow{ background: #FFF4C2; color: #7A5D00; }
.kn-elbow-next--red{ background: #FFE1E2; color: #B4232A; }
.kn-elbow-pyramid{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}
.kn-elbow-row{
    display: flex;
    gap: 6px;
}
.kn-elbow-cup{
    width: 46px;
    height: 46px;
    border: none;
    border-radius: 50%;
    background: color-mix(in srgb, var(--kn-team-color) 18%, var(--bp-surface));
    box-shadow: inset 0 0 0 5px var(--kn-team-color);
    color: var(--kn-team-color);
    font: inherit;
    font-weight: 800;
    cursor: pointer;
}
.kn-elbow-cup--gone{
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--bp-border-strong, #C9CDD2);
    color: var(--bp-text-subtle);
    cursor: default;
}
</style>
