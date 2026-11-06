<template>
    <div class="KnechtOwnCup">
        <div class="kn-own-label">Wer hat eigene Becher runtergeworfen?</div>
        <div class="kn-own-players">
            <button v-for="option in players" :key="`${option.teamIndex}-${option.playerIndex}`"
                type="button"
                class="kn-own-player"
                :class="{ 'kn-own-player--active': selected?.teamIndex === option.teamIndex && selected?.playerIndex === option.playerIndex }"
                :style="{ '--kn-team-color': TEAM_COLORS[option.teamIndex] }"
                @click="select(option)"
            >{{ option.name }}</button>
        </div>

        <template v-if="selected">
            <div class="kn-own-label">Welche Becher? ({{ cups.length }} gewählt)</div>
            <div class="kn-own-pyramid">
                <div v-for="(row, rowIndex) in CUP_ROWS" :key="rowIndex" class="kn-own-row">
                    <button v-for="cup in row" :key="cup"
                        type="button"
                        class="kn-own-cup"
                        :class="{ 'kn-own-cup--active': cups.includes(cup) }"
                        :style="{ '--kn-team-color': TEAM_COLORS[selected.teamIndex] }"
                        :disabled="!standing.includes(cup)"
                        @click="toggle(cup)"
                    ></button>
                </div>
            </div>
            <div class="kn-own-hint">
                Die Becher zählen als Treffer für {{ getTeamName(game.match, 1 - selected.teamIndex) }}.
                <template v-if="cups.length && cups.length === standing.length"><strong> Letzter Becher runter = Spiel verloren!</strong></template>
            </div>
        </template>

        <button type="button" class="kn-own-confirm" :disabled="!selected || !cups.length" @click="confirm">Eintragen</button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CUP_ROWS, getStandingCups } from './knechtEngine';
import { TEAM_COLORS, getTeamName } from './KnechtUtilFunctions';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const props = defineProps<{ game: BiPoKnechtGame }>();
const emit = defineEmits<{ done: [] }>();

type Option = { teamIndex: number; playerIndex: number; name: string };

const players = computed<Option[]>(() => [props.game.match.team1, props.game.match.team2]
    .flatMap((team, teamIndex) => team.players.map((player, playerIndex) => ({ teamIndex, playerIndex, name: player.name }))));

const selected = ref<Option | null>(null);
const cups = ref<number[]>([]);
const standing = computed(() => selected.value ? getStandingCups(props.game.state.value.racks[selected.value.teamIndex]) : []);

const select = (option: Option) => {
    selected.value = option;
    cups.value = [];
};

const toggle = (cup: number) => {
    cups.value = cups.value.includes(cup) ? cups.value.filter(other => other !== cup) : [...cups.value, cup];
};

const confirm = () => {
    if (!selected.value || !cups.value.length) return;
    if (props.game.ownCup(selected.value.teamIndex, selected.value.playerIndex, cups.value)) emit('done');
};
</script>

<style scoped>
.KnechtOwnCup{
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.kn-own-label{
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: #555B63;
}
.kn-own-players{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.kn-own-player{
    padding: 8px 12px;
    border: 1.5px solid #E6E8EB;
    border-left: 4px solid var(--kn-team-color);
    border-radius: 10px;
    background: white;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}
.kn-own-player--active{
    border-color: var(--kn-team-color);
    background: color-mix(in srgb, var(--kn-team-color) 10%, white);
}
.kn-own-pyramid{
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 6px;
}
.kn-own-row{
    display: flex;
    gap: 6px;
}
.kn-own-cup{
    width: 36px;
    height: 36px;
    border: 3px solid var(--kn-team-color);
    border-radius: 50%;
    background: white;
    cursor: pointer;
}
.kn-own-cup--active{
    background: #1F2328;
    border-color: #1F2328;
}
.kn-own-cup:disabled{
    border-color: #E6E8EB;
    background: #F1F2F4;
    cursor: default;
}
.kn-own-hint{
    font-size: 13px;
    color: #6B7079;
}
.kn-own-confirm{
    height: 50px;
    border: none;
    border-radius: 14px;
    background: var(--main-color);
    color: white;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
}
.kn-own-confirm:disabled{
    background: #CDD0D6;
    cursor: default;
}
</style>
