<template>
    <Modal class="start-player-modal">
        <template #title>Wer fängt an?</template>

        <template #template>
            <div class="flex flex-col gap-3 my-4">
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
            </div>
        </template>

        <!-- Button 1 -->
        <template #cancle>
            <div @click="cancel">Abbrechen</div>
        </template>

        <!-- Button 2 -->
        <template #confirm>
            <div @click="startGame(startTeamIndex)">Spiel starten</div>
        </template>
    </Modal>
</template>

<script setup lang="ts">
import { PropType, ref } from "vue";
import Modal from '@/components/shared/Modal.vue';
import router from '@/router.js';

defineProps({
    match: { type: Object as PropType<Match>, required: true },
    startGame: { type: Function as PropType<(startTeamIndex: number) => void>, required: true }
});

let startTeamIndex = ref(0);

const cancel = () => {
    router.go(-1);
};

function getPlayerNames(players: Player[]) {
  const uniqueNames = [...new Set(players.map(p => p.name))];
  return uniqueNames.join(', ');
}
</script>
