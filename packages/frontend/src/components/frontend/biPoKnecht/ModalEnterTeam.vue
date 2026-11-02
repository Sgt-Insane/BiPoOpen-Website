<template>
    <Modal class="team-entry-modal">
        <template #title>
            <div class="flex items-center justify-between w-full px-1">
                <span>Teams eintragen</span>
                <div class="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-xs font-bold">
                    <button
                        type="button"
                        @click="setMode('1v1')"
                        class="px-2 py-1 rounded-md transition-all"
                        :class="is1v1 ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-700'"
                    >
                        1 vs 1
                    </button>
                    <button
                        type="button"
                        @click="setMode('2v2')"
                        class="px-2 py-1 rounded-md transition-all"
                        :class="!is1v1 ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-700'"
                    >
                        2 vs 2
                    </button>
                </div>
            </div>
        </template>

        <template #template>
            <div class="grid grid-cols-2 gap-3 my-2 overflow-visible">
                <!-- Team 1 (Rot) -->
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-1.5 px-1 pb-1 border-b-2 border-[#EA5160]">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#EA5160]" />
                        <span class="text-xs font-black uppercase tracking-wider text-[#EA5160]">Team 1 (Rot)</span>
                    </div>

                    <div
                        v-for="(_, index) in ammountOfPlayersTeam1"
                        :key="`t1-${index}`"
                        class="flex flex-col"
                    >
                        <PlayerSearchAutoComplete
                            :modelValue="playerNames.team1[index]"
                            @update:modelValue="val => playerNames.team1[index] = val"
                            :placeholder="`Spieler ${index + 1}`"
                            className="team-modal-autocomplete"
                            :maxResults="8"
                        />
                    </div>

                    <button
                        v-if="!is1v1 && ammountOfPlayersTeam1 < 3"
                        type="button"
                        class="text-xs font-bold text-[#EA5160] hover:underline self-start px-1 mt-1"
                        @click="ammountOfPlayersTeam1++; playerNames.team1.push('')"
                    >
                        + Weiterer Spieler
                    </button>
                </div>

                <!-- Team 2 (Blau/Türkis) -->
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-1.5 px-1 pb-1 border-b-2 border-[#61C3D9]">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#61C3D9]" />
                        <span class="text-xs font-black uppercase tracking-wider text-[#61C3D9]">Team 2 (Blau)</span>
                    </div>

                    <div
                        v-for="(_, index) in ammountOfPlayersTeam2"
                        :key="`t2-${index}`"
                        class="flex flex-col"
                    >
                        <PlayerSearchAutoComplete
                            :modelValue="playerNames.team2[index]"
                            @update:modelValue="val => playerNames.team2[index] = val"
                            :placeholder="`Spieler ${index + 1}`"
                            className="team-modal-autocomplete"
                            :maxResults="8"
                        />
                    </div>

                    <button
                        v-if="!is1v1 && ammountOfPlayersTeam2 < 3"
                        type="button"
                        class="text-xs font-bold text-[#61C3D9] hover:underline self-start px-1 mt-1"
                        @click="ammountOfPlayersTeam2++; playerNames.team2.push('')"
                    >
                        + Weiterer Spieler
                    </button>
                </div>
            </div>
        </template>

        <template #cancle>
            <div @click="cancel">Abbrechen</div>
        </template>

        <template #confirm>
            <div @click="handleConfirm">Weiter</div>
        </template>
    </Modal>
</template>

<script setup lang="ts">
import { PropType, reactive, ref, computed } from 'vue';
import Modal from '@/components/shared/Modal.vue';
import PlayerSearchAutoComplete from '@/components/shared/PlayerSearchAutoComplete.vue';
import router from '@/router.js';

const props = defineProps({
    setMatch: { type: Function as PropType<(match: Match) => void>, required: true }
});

const is1v1 = ref(false);
const ammountOfPlayersTeam1 = ref(2);
const ammountOfPlayersTeam2 = ref(2);

const playerNames = reactive<{ team1: string[]; team2: string[] }>({
    team1: ['', ''],
    team2: ['', '']
});

const setMode = (mode: '1v1' | '2v2') => {
    if (mode === '1v1') {
        is1v1.value = true;
        ammountOfPlayersTeam1.value = 1;
        ammountOfPlayersTeam2.value = 1;
        playerNames.team1 = [playerNames.team1[0] || ''];
        playerNames.team2 = [playerNames.team2[0] || ''];
    } else {
        is1v1.value = false;
        ammountOfPlayersTeam1.value = 2;
        ammountOfPlayersTeam2.value = 2;
        while (playerNames.team1.length < 2) playerNames.team1.push('');
        while (playerNames.team2.length < 2) playerNames.team2.push('');
    }
};

const toPlayers = (names: string[]): Player[] => {
    const validNames = names.map(n => n.trim()).filter(Boolean);
    const fallback = validNames.length > 0 ? validNames : ['Spieler 1'];
    const players = fallback.map(name => ({ _id: 'placeholder', name, score: 0 }));
    // Bei 1v1 spielt der Spieler beide Positionen
    if (players.length === 1) {
        players.push({ ...players[0] });
    }
    return players;
};

const handleConfirm = () => {
    props.setMatch({
        _id: 'placeholder',
        team1: { _id: 'placeholder', players: toPlayers(playerNames.team1) },
        team2: { _id: 'placeholder', players: toPlayers(playerNames.team2) }
    });
};

const cancel = () => {
    router.go(-1);
};
</script>

<style scoped>
.team-modal-autocomplete {
    width: 100%;
    position: relative;
}
.team-modal-autocomplete :deep(.p-inputtext) {
    width: 100%;
    height: 44px;
    padding: 0px 14px;
    font-size: 14px;
    border-radius: 10px;
}

@media (width <= 900px) {
    .team-entry-modal :deep(.mo-container) {
        transform: translateY(-8vh);
    }
}
</style>
