<template>
    <!-- Lobby-Spiel: "Wer faengt an?" als Popup ueber dem Spielfeld - Team waehlen oder Schnick-Schnack-Schnuck (Zufall).
         Danach geht es sofort los. -->
    <div class="KnechtRpsPopup" role="dialog" aria-live="polite">
        <div class="kr-card">
            <template v-if="phase === 'choose'">
                <div class="kr-title">Wer fängt an?</div>
                <button v-for="teamIndex in [0, 1]" :key="teamIndex" type="button" class="kr-option" :style="{ '--kr-team-color': getTeamColor(match, teamIndex) }" @click="choose(teamIndex)">
                    <Avatar :name="getTeamName(match, teamIndex)" :avatarImage="getTeam(match, teamIndex).logo" :shape="getTeam(match, teamIndex).logo ? 'square' : 'circle'" class="kr-option-avatar" />
                    <span class="kr-option-text">
                        <span class="kr-option-team">{{ getTeamName(match, teamIndex) }}</span>
                        <span v-if="playerLine(teamIndex) !== getTeamName(match, teamIndex)" class="kr-option-players" v-fit-text>{{ playerLine(teamIndex) }}</span>
                    </span>
                    <span class="kr-option-go">beginnt</span>
                </button>
                <button type="button" class="kr-rps-button" @click="startRps">✊ Schnick-Schnack-Schnuck (Zufall) ✌️</button>
                <button type="button" class="kr-back" @click="$emit('back')">Zurück zur Lobby</button>
            </template>

            <template v-else>
            <div class="kr-title">{{ phase === 'rps' ? 'Schnick-Schnack-Schnuck!' : 'Los geht’s!' }}</div>
            <div v-if="phase === 'rps'" class="kr-status">{{ status }}</div>
            <div v-if="phase === 'rps'" class="kr-hands">
                <div v-for="teamIndex in [0, 1]" :key="teamIndex" class="kr-team" :style="{ '--kr-team-color': getTeamColor(match, teamIndex) }">
                    <span class="kr-name" v-fit-text>{{ getTeamName(match, teamIndex) }}</span>
                    <span class="kr-hand" :class="{ 'kr-hand--shaking': shaking, 'kr-hand--winner': winner === teamIndex }">{{ hands[teamIndex] }}</span>
                </div>
            </div>
            <div class="kr-result" :class="{ 'kr-result--hidden': winner === null }">🏆 {{ winner === null ? '' : getTeamName(match, winner) }} beginnt!</div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import { getTeam, getTeamColor, getTeamName } from './KnechtUtilFunctions';
import { RPS_HANDS, playSeededRps } from './knechtRps';

// seed: gleich auf allen Handys (Kennung des Live-Spiels) -> gleiche Haende, gleicher Gewinner.
// startedTeam: ein anderes Handy hat schon entschieden (dann nur noch kurz zeigen, wer anfaengt).
const props = defineProps<{ match: Match; seed: string; startedTeam?: number | null }>();
const emit = defineEmits<{ decided: [teamIndex: number]; done: []; back: [] }>();

const rounds = playSeededRps(props.seed);
const phase = ref<'choose' | 'rps' | 'result'>('choose');
const playerLine = (teamIndex: number) => getTeam(props.match, teamIndex).players.map(player => player.name).join(' & ');
const hands = ref(['✊', '✊']);
const shaking = ref(false);
const status = ref('');
const winner = ref<number | null>(null);

const timers: ReturnType<typeof setTimeout>[] = [];
const later = (callback: () => void, delay: number) => timers.push(setTimeout(callback, delay));

const playRound = (index: number) => {
    const round = rounds[index];
    hands.value = ['✊', '✊'];
    shaking.value = true;
    status.value = 'Schnick …';
    later(() => { status.value = 'Schnack …'; }, 450);
    later(() => { status.value = 'SCHNUCK!'; }, 900);
    later(() => {
        shaking.value = false;
        // Ein anderes Handy hat inzwischen per Hand gewaehlt: das gilt
        const decided = props.startedTeam;
        if (decided !== null && decided !== undefined && round.winner !== null && decided !== round.winner) return showResult(decided);
        hands.value = round.hands.map(hand => RPS_HANDS[hand]);
        if (round.winner === null) {
            status.value = 'Unentschieden! Nochmal …';
            later(() => playRound(index + 1), 900);
            return;
        }
        winner.value = round.winner;
        status.value = 'Entscheidung gefallen!';
        // Ab jetzt laeuft die Spielzeit; das Popup bleibt kurz stehen, damit jeder sieht, wer anfaengt
        emit('decided', round.winner);
        later(() => emit('done'), 1400);
    }, 1300);
};

const startRps = () => {
    phase.value = 'rps';
    playRound(0);
};

// Selbst gewaehlt oder von einem anderen Handy entschieden: kurz zeigen, wer anfaengt, dann los
const showResult = (teamIndex: number) => {
    phase.value = 'result';
    winner.value = teamIndex;
    later(() => emit('done'), 1100);
};
const choose = (teamIndex: number) => {
    emit('decided', teamIndex);
    showResult(teamIndex);
};
watch(() => props.startedTeam, (team) => {
    if (team !== null && team !== undefined && phase.value === 'choose') showResult(team);
}, { immediate: true });
onBeforeUnmount(() => timers.splice(0).forEach(clearTimeout));
</script>

<style scoped>
.KnechtRpsPopup{
    position: absolute;
    inset: 0;
    z-index: 26;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(31, 35, 40, .35);
}
.kr-card{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: min(380px, 100%);
    padding: 20px 16px 14px;
    border-radius: 20px;
    background: var(--bp-surface);
    box-shadow: 0 12px 40px rgba(0, 0, 0, .18);
    animation: kr-in .25s ease-out both;
}
@keyframes kr-in{ from{ transform: scale(.92); opacity: 0; } }
.kr-title{
    font-size: 22px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.kr-status{
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--bp-text-subtle);
}
.kr-hands{
    display: flex;
    justify-content: space-around;
    width: 100%;
}
.kr-team{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    max-width: 45%;
}
.kr-name{
    overflow: hidden;
    max-width: 100%;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--kr-team-color);
}
.kr-hand{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 76px;
    height: 76px;
    border: 2px solid var(--kr-team-color);
    border-radius: 18px;
    background: color-mix(in srgb, var(--kr-team-color) 8%, var(--bp-surface));
    font-size: 38px;
    transition: transform .2s ease, box-shadow .2s ease;
}
.kr-hand--shaking{ animation: kr-shake .45s ease-in-out infinite; }
.kr-hand--winner{
    transform: scale(1.1);
    box-shadow: 0 0 0 4px var(--kr-team-color);
}
@keyframes kr-shake{
    0%, 100%{ transform: translateY(0); }
    50%{ transform: translateY(-10px); }
}
.kr-result{
    min-height: 22px;
    font-size: 16px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.kr-result--hidden{ visibility: hidden; }
.kr-option{
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    border: 1.5px solid var(--kr-team-color);
    border-radius: 16px;
    background: color-mix(in srgb, var(--kr-team-color) 8%, var(--bp-surface));
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.kr-option-avatar{
    width: 40px !important;
    height: 40px !important;
    min-width: 40px;
}
.kr-option-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}
.kr-option-team{
    font-size: 15px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.kr-option-players{
    overflow: hidden;
    white-space: nowrap;
    font-size: 13px;
    color: var(--bp-text-muted);
}
.kr-option-go{
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--kr-team-color);
}
.kr-rps-button{
    width: 100%;
    padding: 12px;
    border: 1.5px dashed var(--bp-border-strong, var(--bp-border));
    border-radius: 14px;
    background: none;
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
}
.kr-back{
    height: 40px;
    border: none;
    background: none;
    color: var(--bp-text-muted);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}
@media (prefers-reduced-motion: reduce){ .kr-hand--shaking{ animation: none; } }
</style>
