<template>
    <div class="KnechtElbow">
        <!-- Schritt 1: Grund -->
        <template v-if="reason === null">
            <div class="kn-elbow-hint">{{ card === 'red' ? 'Strafbier: ein eigener Becher kommt vom Tisch und zählt für den Gegner.' : 'Verwarnung: kostet keinen Becher.' }} Grund?</div>
            <button v-for="option in REASONS[card]" :key="option" type="button" class="kn-menu-button kn-elbow-reason" @click="reason = option">{{ option }}</button>
            <form class="kn-elbow-own" @submit.prevent="ownReason.trim() && (reason = ownReason.trim())">
                <input v-model="ownReason" type="text" maxlength="60" class="kn-elbow-input" placeholder="Eigener Grund …" aria-label="Eigener Grund" />
                <button type="submit" class="kn-menu-button kn-elbow-own-ok" :disabled="!ownReason.trim()">Weiter</button>
            </form>
        </template>

        <!-- Schritt 2: wer? -->
        <template v-else-if="selected === null">
            <div class="kn-elbow-hint">{{ card === 'red' ? 'Strafbier' : 'Verwarnung' }} · {{ reason }}: für wen?</div>
            <div v-for="teamIndex in [0, 1]" :key="teamIndex" class="kn-elbow-team" :style="{ '--kn-team-color': getTeamColor(game.match, teamIndex) }">
                <div class="kn-elbow-team-name">{{ getTeamName(game.match, teamIndex) }}</div>
                <button v-for="(player, playerIndex) in getTeam(game.match, teamIndex).players" :key="playerIndex"
                    type="button" class="kn-elbow-player" @click="choose(teamIndex, playerIndex)">
                    <span class="kn-elbow-name" v-fit-text>{{ player.name }}</span>
                    <!-- Bisherige Karten dieser Person -->
                    <span class="kn-elbow-cards">
                        <span v-for="(color, index) in cards(teamIndex, playerIndex)" :key="index" class="kn-elbow-card" :class="color === 'yellow' ? 'kn-elbow-card--yellow' : 'kn-elbow-card--red'"></span>
                    </span>
                </button>
            </div>
            <button type="button" class="kn-menu-button" @click="reason = null">Zurück</button>
        </template>

        <!-- Schritt 3 (Strafbier): welcher eigene Becher kommt vom Tisch? -->
        <template v-else>
            <div class="kn-elbow-hint">
                Strafbier für {{ getPlayerName(game.match, selected.team, selected.player) }}: welcher Becher von
                {{ getTeamName(game.match, selected.team) }} kommt vom Tisch?
            </div>
            <div class="kn-elbow-pyramid" :style="{ '--kn-team-color': getTeamColor(game.match, selected.team) }">
                <div v-for="(row, rowIndex) in ROWS" :key="rowIndex" class="kn-elbow-row">
                    <button v-for="cup in row" :key="cup" type="button" class="kn-elbow-cup"
                        :class="{ 'kn-elbow-cup--gone': !standing.includes(cup) }"
                        :disabled="!standing.includes(cup)"
                        @click="game.elbow(selected.team, selected.player, [cup], 'red', reason ?? undefined); $emit('done')">{{ cup + 1 }}</button>
                </div>
            </div>
            <button type="button" class="kn-menu-button" @click="selected = null">Zurück</button>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getStandingCups } from './knechtEngine';
import { getPlayerName, getTeam, getTeamColor, getTeamName } from './KnechtUtilFunctions';
import type { BiPoKnechtGame } from './useBiPoKnecht';

// card: Verwarnung (gelb, kein Becher) oder Strafbier (rot, ein eigener Becher)
const props = defineProps<{ game: BiPoKnechtGame; card: 'yellow' | 'red' }>();
const emit = defineEmits<{ done: [] }>();

// Feste Gruende, als letzte Option ein eigener
const REASONS: Record<'yellow' | 'red', string[]> = {
    yellow: ['Ellenbogen-Call'],
    red: ['Ellenbogen-Call', 'Irregulärer Eingriff ins Spiel'],
};

// Becher aus Sicht des Teams, dem sie gehoeren: Spitze unten
const ROWS = [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]];
const state = computed(() => props.game.state.value);
const reason = ref<string | null>(null);
const ownReason = ref('');
const selected = ref<{ team: number; player: number } | null>(null);
const standing = computed(() => selected.value ? getStandingCups(state.value.racks[selected.value.team]) : []);

// Bisherige Karten (gelb/rot) dieser Person im Spiel
const cards = (team: number, player: number) => state.value.turns
    .filter(turn => turn.type === 'penalty' && turn.teamIndex === team && turn.playerIndex === player)
    .map(turn => ((turn.data ?? {}) as { card?: string }).card === 'red' ? 'red' : 'yellow');

const choose = (team: number, player: number) => {
    if (props.card === 'red') {
        selected.value = { team, player };
        return;
    }
    props.game.elbow(team, player, [], 'yellow', reason.value ?? undefined);
    emit('done');
};
</script>

<style scoped>
.kn-elbow-reason{
    justify-content: flex-start;
}
.kn-elbow-own{
    display: flex;
    gap: 6px;
}
.kn-elbow-input{
    flex: 1;
    min-width: 0;
    min-height: 48px;
    padding: 0 12px;
    border: 1px solid var(--bp-border);
    border-radius: 12px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 15px;
}
.kn-elbow-own-ok:disabled{
    opacity: .5;
}
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
