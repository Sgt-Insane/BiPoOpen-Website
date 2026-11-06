<template>
    <div class="KnechtStartTeam">
        <div class="kn-start-title">{{ rps.playing ? 'Schnick-Schnack-Schnuck!' : 'Wer fängt an?' }}</div>

        <!-- Schnick-Schnack-Schnuck -->
        <div v-if="rps.playing" class="kn-rps">
            <div class="kn-rps-status">{{ rps.status }}</div>
            <div class="kn-rps-hands">
                <div v-for="teamIndex in [0, 1]" :key="teamIndex" class="kn-rps-team" :style="{ '--kn-team-color': TEAM_COLORS[teamIndex] }">
                    <span class="kn-rps-name">{{ getTeamName(match, teamIndex) }}</span>
                    <span class="kn-rps-hand" :class="{ 'kn-rps-hand--shaking': rps.shaking, 'kn-rps-hand--winner': rps.winner === teamIndex }">
                        {{ rps.hands[teamIndex] }}
                    </span>
                </div>
            </div>
            <div v-if="rps.winner !== null" class="kn-rps-result">🏆 {{ getTeamName(match, rps.winner) }} beginnt!</div>
        </div>

        <!-- Team waehlen -->
        <template v-else>
            <button v-for="teamIndex in [0, 1]" :key="teamIndex"
                type="button"
                class="kn-start-option"
                :class="{ 'kn-start-option--active': selected === teamIndex }"
                :style="{ '--kn-team-color': TEAM_COLORS[teamIndex] }"
                @click="selected = teamIndex"
            >
                <Avatar :name="getTeamName(match, teamIndex)" :avatarImage="getTeam(match, teamIndex).logo" :shape="getTeam(match, teamIndex).logo ? 'square' : 'circle'" class="kn-start-avatar" />
                <span class="kn-start-text">
                    <span class="kn-start-team">{{ getTeamName(match, teamIndex) }}</span>
                    <span v-if="getPlayerLine(teamIndex) !== getTeamName(match, teamIndex)" class="kn-start-players">{{ getPlayerLine(teamIndex) }}</span>
                </span>
                <span class="kn-start-check"><i v-if="selected === teamIndex" class="pi pi-check"></i></span>
            </button>

            <button type="button" class="kn-start-rps" @click="playRps">✊ Schnick-Schnack-Schnuck (Zufall) ✌️</button>
        </template>

        <div class="kn-start-footer">
            <button type="button" class="kn-start-button kn-start-button-cancel" @click="rps.playing ? stopRps() : $emit('cancel')">
                {{ rps.playing ? 'Zurück' : 'Abbrechen' }}
            </button>
            <button type="button" class="kn-start-button kn-start-button-start" :disabled="rps.playing" @click="$emit('start', selected)">
                Spiel starten
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import { TEAM_COLORS, getTeam, getTeamName } from './KnechtUtilFunctions';

const props = defineProps<{ match: Match }>();
const emit = defineEmits<{ start: [teamIndex: number]; cancel: [] }>();

const selected = ref(0);

const getPlayerLine = (teamIndex: number) => getTeam(props.match, teamIndex).players.map(player => player.name).join(' & ');

// ─── Schnick-Schnack-Schnuck ───
const HANDS = ['✊', '✋', '✌️'];
const rps = reactive({ playing: false, shaking: false, status: '', hands: ['✊', '✊'], winner: null as number | null });
const timers: ReturnType<typeof setTimeout>[] = [];
const later = (callback: () => void, delay: number) => timers.push(setTimeout(callback, delay));

const stopRps = () => {
    timers.splice(0).forEach(clearTimeout);
    Object.assign(rps, { playing: false, shaking: false, winner: null });
};

const playRound = () => {
    Object.assign(rps, { shaking: true, hands: ['✊', '✊'], winner: null, status: 'Schnick …' });
    later(() => { rps.status = 'Schnack …'; }, 500);
    later(() => { rps.status = 'SCHNUCK!'; }, 1000);
    later(() => {
        const choices = [0, 1].map(() => Math.floor(Math.random() * HANDS.length));
        rps.shaking = false;
        rps.hands = choices.map(choice => HANDS[choice]);
        if (choices[0] === choices[1]) {
            rps.status = 'Unentschieden! Nochmal …';
            later(playRound, 1000);
            return;
        }
        // Stein > Schere > Papier > Stein
        const winner = (choices[0] - choices[1] + 3) % 3 === 1 ? 0 : 1;
        rps.winner = winner;
        selected.value = winner;
        rps.status = 'Entscheidung gefallen!';
        later(() => emit('start', winner), 1500);
    }, 1400);
};

const playRps = () => {
    rps.playing = true;
    playRound();
};

onBeforeUnmount(stopRps);
</script>

<style scoped>
.KnechtStartTeam{
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(420px, 100%);
    padding: 20px 16px 16px;
    border-radius: 20px;
    background: white;
    box-shadow: 0 12px 40px rgba(0, 0, 0, .18);
}
.kn-start-title{
    margin-bottom: 4px;
    font-size: 22px;
    font-weight: 700;
    color: #1F2328;
}
.kn-start-option{
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1.5px solid #E6E8EB;
    border-radius: 16px;
    background: white;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color .2s ease, background .2s ease;
}
.kn-start-option--active{
    border-color: var(--kn-team-color);
    background: color-mix(in srgb, var(--kn-team-color) 8%, white);
    box-shadow: 0 0 0 1px var(--kn-team-color);
}
.kn-start-avatar{
    width: 40px !important;
    height: 40px !important;
    min-width: 40px;
}
.kn-start-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}
.kn-start-team{
    font-size: 15px;
    font-weight: 700;
    color: #1F2328;
}
.kn-start-players{
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: #6B7079;
}
.kn-start-check{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 2px solid #D3D6DB;
    border-radius: 50%;
    color: white;
    font-size: 11px;
}
.kn-start-option--active .kn-start-check{
    border-color: var(--kn-team-color);
    background: var(--kn-team-color);
}
.kn-start-rps{
    height: 44px;
    border: 1px dashed #D3D6DB;
    border-radius: 12px;
    background: transparent;
    color: #3A3F46;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
}

/* ─── Schnick-Schnack-Schnuck ─── */
.kn-rps{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
}
.kn-rps-status{
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #8A9099;
}
.kn-rps-hands{
    display: flex;
    justify-content: space-around;
    width: 100%;
}
.kn-rps-team{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    max-width: 45%;
}
.kn-rps-name{
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--kn-team-color);
}
.kn-rps-hand{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 76px;
    height: 76px;
    border: 2px solid var(--kn-team-color);
    border-radius: 18px;
    background: color-mix(in srgb, var(--kn-team-color) 8%, white);
    font-size: 38px;
    transition: transform .2s ease, box-shadow .2s ease;
}
.kn-rps-hand--shaking{
    animation: kn-shake .5s ease-in-out infinite;
}
.kn-rps-hand--winner{
    transform: scale(1.1);
    box-shadow: 0 0 0 4px var(--kn-team-color);
}
.kn-rps-result{
    font-size: 16px;
    font-weight: 800;
    color: #1F2328;
}
@keyframes kn-shake{
    0%, 100%{ transform: translateY(0); }
    50%{ transform: translateY(-10px); }
}

.kn-start-footer{
    display: flex;
    gap: 8px;
    margin-top: 6px;
}
.kn-start-button{
    flex: 1;
    height: 52px;
    border: none;
    border-radius: 14px;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
}
.kn-start-button-cancel{
    border: 1px solid #E6E8EB;
    background: white;
    color: #3A3F46;
}
.kn-start-button-start{
    background: var(--main-color);
    color: white;
}
.kn-start-button-start:disabled{
    background: #CDD0D6;
    cursor: default;
}
</style>
