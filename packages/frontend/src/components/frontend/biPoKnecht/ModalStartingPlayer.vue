<template>
    <Modal class="start-player-modal">
        <template #title>
            <span>{{ isRpsPlaying ? 'Schnick-Schnack-Schnuck!' : 'Wer fängt an?' }}</span>
        </template>

        <template #template>
            <!-- SCHERE-STEIN-PAPIER ANIMATION -->
            <div v-if="isRpsPlaying" class="flex flex-col items-center justify-center my-4 py-2">
                <div class="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
                    {{ rpsStatusText }}
                </div>

                <div class="flex items-center justify-around w-full max-w-[320px] my-2">
                    <!-- Team 1 Hand -->
                    <div class="flex flex-col items-center gap-1">
                        <span class="text-xs font-black uppercase text-[#EA5160]">
                            {{ match.team1.name || 'Team 1' }}
                        </span>
                        <div
                            class="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-md border-2 border-[#EA5160] transition-all bg-red-50"
                            :class="{ 'animate-bounce': isRpsShaking, 'scale-110 shadow-lg ring-4 ring-[#EA5160]': rpsWinner === 0 }"
                        >
                            {{ rpsHandTeam1 }}
                        </div>
                    </div>

                    <span class="text-xl font-black text-gray-300">VS</span>

                    <!-- Team 2 Hand -->
                    <div class="flex flex-col items-center gap-1">
                        <span class="text-xs font-black uppercase text-[#61C3D9]">
                            {{ match.team2.name || 'Team 2' }}
                        </span>
                        <div
                            class="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-md border-2 border-[#61C3D9] transition-all bg-cyan-50"
                            :class="{ 'animate-bounce': isRpsShaking, 'scale-110 shadow-lg ring-4 ring-[#61C3D9]': rpsWinner === 1 }"
                        >
                            {{ rpsHandTeam2 }}
                        </div>
                    </div>
                </div>

                <div v-if="rpsWinner !== null" class="mt-4 text-center font-black text-base animate-pulse" :style="{ color: rpsWinner === 0 ? 'var(--main-color)' : 'var(--secondary-color)' }">
                    🏆 {{ rpsWinner === 0 ? (match.team1.name || 'Team 1') : (match.team2.name || 'Team 2') }} beginnt!
                </div>
            </div>

            <!-- NORMALE TEAM-AUSWAHL -->
            <div v-else class="flex flex-col gap-3 my-4">
                <!-- Team 1 Card -->
                <div
                    @click="startTeamIndex = 0"
                    class="cursor-pointer rounded-2xl p-4 border-2 transition-all duration-200 flex items-center justify-between shadow-xs select-none"
                    :class="startTeamIndex === 0 ? 'bg-[#EA5160]/10 border-[#EA5160] shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-90'"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs"
                            :style="{ backgroundColor: 'var(--main-color)' }"
                        >
                            1
                        </div>
                        <div class="flex flex-col">
                            <span class="text-xs uppercase font-extrabold tracking-wider" :style="{ color: 'var(--main-color)' }">
                                {{ match.team1.name || 'Team 1 (Rot)' }}
                            </span>
                            <span class="text-base font-bold text-gray-900">
                                {{ getPlayerNames(match.team1.players) }}
                            </span>
                        </div>
                    </div>
                    <div
                        class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                        :class="startTeamIndex === 0 ? 'border-[#EA5160] bg-[#EA5160]' : 'border-gray-300'"
                    >
                        <i v-if="startTeamIndex === 0" class="pi pi-check text-xs text-white" />
                    </div>
                </div>

                <!-- Team 2 Card -->
                <div
                    @click="startTeamIndex = 1"
                    class="cursor-pointer rounded-2xl p-4 border-2 transition-all duration-200 flex items-center justify-between shadow-xs select-none"
                    :class="startTeamIndex === 1 ? 'bg-[#61C3D9]/10 border-[#61C3D9] shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-90'"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs"
                            :style="{ backgroundColor: 'var(--secondary-color)' }"
                        >
                            2
                        </div>
                        <div class="flex flex-col">
                            <span class="text-xs uppercase font-extrabold tracking-wider" :style="{ color: 'var(--secondary-color)' }">
                                {{ match.team2.name || 'Team 2 (Blau)' }}
                            </span>
                            <span class="text-base font-bold text-gray-900">
                                {{ getPlayerNames(match.team2.players) }}
                            </span>
                        </div>
                    </div>
                    <div
                        class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                        :class="startTeamIndex === 1 ? 'border-[#61C3D9] bg-[#61C3D9]' : 'border-gray-300'"
                    >
                        <i v-if="startTeamIndex === 1" class="pi pi-check text-xs text-white" />
                    </div>
                </div>

                <!-- Random Button mit Schnick-Schnack-Schnuck Animation -->
                <button
                    type="button"
                    @click="startRpsBattle"
                    class="mt-2 py-3 px-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <span>✊</span>
                    <span>Schnick-Schnack-Schnuck (Zufall)</span>
                    <span>✌️</span>
                </button>
            </div>
        </template>

        <!-- Button 1 -->
        <template #cancle>
            <div @click="cancel">{{ isRpsPlaying ? 'Zurück' : 'Abbrechen' }}</div>
        </template>

        <!-- Button 2 -->
        <template #confirm>
            <div v-if="!isRpsPlaying" @click="startGame(startTeamIndex)">Spiel starten</div>
            <div v-else class="opacity-50 pointer-events-none">Wird ermittelt...</div>
        </template>
    </Modal>
</template>

<script setup lang="ts">
import { PropType, ref } from "vue";
import Modal from '@/components/shared/Modal.vue';
import router from '@/router.js';

const props = defineProps({
    match: { type: Object as PropType<Match>, required: true },
    startGame: { type: Function as PropType<(startTeamIndex: number) => void>, required: true }
});

const startTeamIndex = ref(0);

// Schnick-Schnack-Schnuck State
const isRpsPlaying = ref(false);
const isRpsShaking = ref(false);
const rpsStatusText = ref('Schnick...');
const rpsHandTeam1 = ref('✊');
const rpsHandTeam2 = ref('✊');
const rpsWinner = ref<number | null>(null);

const rpsChoices = ['✊', '✋', '✌️'] as const;
type RpsChoice = typeof rpsChoices[number];

const cancel = () => {
    if (isRpsPlaying.value) {
        isRpsPlaying.value = false;
        rpsWinner.value = null;
    } else {
        router.go(-1);
    }
};

const playRpsRound = () => {
    isRpsShaking.value = true;
    rpsHandTeam1.value = '✊';
    rpsHandTeam2.value = '✊';
    rpsWinner.value = null;

    rpsStatusText.value = 'Schnick...';

    setTimeout(() => {
        rpsStatusText.value = 'Schnack...';
    }, 500);

    setTimeout(() => {
        rpsStatusText.value = 'SCHNUCK!';
    }, 1000);

    setTimeout(() => {
        isRpsShaking.value = false;
        const choice1 = rpsChoices[Math.floor(Math.random() * rpsChoices.length)];
        const choice2 = rpsChoices[Math.floor(Math.random() * rpsChoices.length)];
        rpsHandTeam1.value = choice1;
        rpsHandTeam2.value = choice2;

        if (choice1 === choice2) {
            rpsStatusText.value = 'Unentschieden! Nochmal...';
            setTimeout(() => {
                playRpsRound();
            }, 1000);
            return;
        }

        // Stein > Schere, Schere > Papier, Papier > Stein
        const team1Wins =
            (choice1 === '✊' && choice2 === '✌️') ||
            (choice1 === '✌️' && choice2 === '✋') ||
            (choice1 === '✋' && choice2 === '✊');

        const winner = team1Wins ? 0 : 1;
        rpsWinner.value = winner;
        startTeamIndex.value = winner;
        rpsStatusText.value = 'Entscheidung gefallen!';

        // Automatisch nach kurzem Jubel starten
        setTimeout(() => {
            props.startGame(winner);
        }, 1500);
    }, 1400);
};

const startRpsBattle = () => {
    isRpsPlaying.value = true;
    playRpsRound();
};

function getPlayerNames(players: Player[]) {
  const uniqueNames = [...new Set(players.map(p => p.name))];
  return uniqueNames.join(', ');
}
</script>
