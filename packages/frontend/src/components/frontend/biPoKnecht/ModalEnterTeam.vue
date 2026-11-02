<template>
    <Modal class="team-entry-modal">
        <template #title>
            <div class="flex flex-col gap-2 w-full">
                <div class="flex items-center justify-between w-full px-1">
                    <span class="font-bold text-gray-900">Spielmodus wählen</span>
                    <!-- Spieltyp-Umschalter: Offen vs. Liga -->
                    <div class="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl text-xs font-bold">
                        <button
                            type="button"
                            @click="gameMode = 'open'"
                            class="px-2.5 py-1 rounded-lg transition-all"
                            :class="gameMode === 'open' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-700'"
                        >
                            🍺 Offen
                        </button>
                        <button
                            type="button"
                            @click="gameMode = 'league'"
                            class="px-2.5 py-1 rounded-lg transition-all"
                            :class="gameMode === 'league' ? 'bg-[#EA5160] text-white shadow-xs' : 'text-gray-500 hover:text-gray-700'"
                        >
                            🏆 Liga
                        </button>
                    </div>
                </div>

                <!-- 1v1 / 2v2 Toggle (nur im offenen Modus) -->
                <div v-if="gameMode === 'open'" class="flex items-center justify-end px-1">
                    <div class="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-[11px] font-bold">
                        <button
                            type="button"
                            @click="setMode('1v1')"
                            class="px-2 py-0.5 rounded-md transition-all"
                            :class="is1v1 ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-700'"
                        >
                            1 vs 1
                        </button>
                        <button
                            type="button"
                            @click="setMode('2v2')"
                            class="px-2 py-0.5 rounded-md transition-all"
                            :class="!is1v1 ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500 hover:text-gray-700'"
                        >
                            2 vs 2
                        </button>
                    </div>
                </div>

                <!-- Liga-Auswahl (nur im Liga-Modus) -->
                <div v-else class="flex items-center justify-between px-1 bg-red-50/70 p-2 rounded-xl border border-red-100">
                    <span class="text-xs font-bold text-[#EA5160]">Saison {{ currentSeasonLabel }}</span>
                    <div class="flex items-center gap-1 text-xs font-bold">
                        <button
                            v-for="div in currentDivisions"
                            :key="div.league"
                            type="button"
                            @click="selectedLeague = div.league"
                            class="px-2.5 py-1 rounded-lg border transition-all"
                            :class="selectedLeague === div.league ? 'bg-[#EA5160] text-white border-[#EA5160]' : 'bg-white text-gray-600 border-gray-200'"
                        >
                            {{ div.label }}
                        </button>
                    </div>
                </div>
            </div>
        </template>

        <template #template>
            <!-- LIGA-MODUS: Schnellauswahl der offiziellen Liga-Teams -->
            <div v-if="gameMode === 'league'" class="grid grid-cols-2 gap-3 my-2 overflow-visible">
                <!-- Team 1 (Rot) -->
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-1.5 px-1 pb-1 border-b-2 border-[#EA5160]">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#EA5160]" />
                        <span class="text-xs font-black uppercase tracking-wider text-[#EA5160]">Team 1 (Rot)</span>
                    </div>

                    <select
                        v-model="selectedLeagueTeam1"
                        class="w-full h-11 px-3 text-xs sm:text-sm font-semibold rounded-xl border border-gray-300 bg-white focus:border-[#EA5160] focus:ring-1 focus:ring-[#EA5160] outline-none"
                    >
                        <option value="" disabled>Team auswählen...</option>
                        <option
                            v-for="team in availableLeagueTeams"
                            :key="team.teamName"
                            :value="team.teamName"
                            :disabled="team.teamName === selectedLeagueTeam2"
                        >
                            {{ team.teamName }} ({{ team.playerName }})
                        </option>
                    </select>

                    <div v-if="team1LeagueDetails" class="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200">
                        <img :src="team1LeagueDetails.logo" class="w-8 h-8 rounded-full object-cover shrink-0" />
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs font-bold text-gray-900 truncate">{{ team1LeagueDetails.teamName }}</span>
                            <span class="text-[11px] text-gray-500 truncate">{{ team1LeagueDetails.playerName }}</span>
                        </div>
                    </div>
                </div>

                <!-- Team 2 (Blau) -->
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-1.5 px-1 pb-1 border-b-2 border-[#61C3D9]">
                        <span class="w-2.5 h-2.5 rounded-full bg-[#61C3D9]" />
                        <span class="text-xs font-black uppercase tracking-wider text-[#61C3D9]">Team 2 (Blau)</span>
                    </div>

                    <select
                        v-model="selectedLeagueTeam2"
                        class="w-full h-11 px-3 text-xs sm:text-sm font-semibold rounded-xl border border-gray-300 bg-white focus:border-[#61C3D9] focus:ring-1 focus:ring-[#61C3D9] outline-none"
                    >
                        <option value="" disabled>Team auswählen...</option>
                        <option
                            v-for="team in availableLeagueTeams"
                            :key="team.teamName"
                            :value="team.teamName"
                            :disabled="team.teamName === selectedLeagueTeam1"
                        >
                            {{ team.teamName }} ({{ team.playerName }})
                        </option>
                    </select>

                    <div v-if="team2LeagueDetails" class="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200">
                        <img :src="team2LeagueDetails.logo" class="w-8 h-8 rounded-full object-cover shrink-0" />
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs font-bold text-gray-900 truncate">{{ team2LeagueDetails.teamName }}</span>
                            <span class="text-[11px] text-gray-500 truncate">{{ team2LeagueDetails.playerName }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- OFFENER MODUS: Freie Spieler-Eingabe -->
            <div v-else class="grid grid-cols-2 gap-3 my-2 overflow-visible">
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
import { CURRENT_SEASON_SLUG, LEAGUE_SEASONS, type LeagueTeam } from '../league/LeagueSeasonsData';

const props = defineProps({
    setMatch: { type: Function as PropType<(match: Match, isLeague?: boolean) => void>, required: true }
});

const gameMode = ref<'open' | 'league'>('open');
const is1v1 = ref(false);
const ammountOfPlayersTeam1 = ref(2);
const ammountOfPlayersTeam2 = ref(2);

// Liga-Modus State
const selectedLeague = ref<number>(1);
const selectedLeagueTeam1 = ref<string>('');
const selectedLeagueTeam2 = ref<string>('');

const currentSeason = computed(() => LEAGUE_SEASONS.find(s => s.slug === CURRENT_SEASON_SLUG) || LEAGUE_SEASONS[0]);
const currentSeasonLabel = computed(() => currentSeason.value.label);
const currentDivisions = computed(() => currentSeason.value.divisions);

const availableLeagueTeams = computed(() => {
    const div = currentDivisions.value.find(d => d.league === selectedLeague.value);
    return div ? div.teams : [];
});

const team1LeagueDetails = computed<LeagueTeam | undefined>(() => {
    return availableLeagueTeams.value.find(t => t.teamName === selectedLeagueTeam1.value);
});

const team2LeagueDetails = computed<LeagueTeam | undefined>(() => {
    return availableLeagueTeams.value.find(t => t.teamName === selectedLeagueTeam2.value);
});

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
    if (players.length === 1) {
        players.push({ ...players[0] });
    }
    return players;
};

const handleConfirm = () => {
    if (gameMode.value === 'league') {
        if (!selectedLeagueTeam1.value || !selectedLeagueTeam2.value) {
            window.alert('Bitte wähle beide Liga-Teams aus!');
            return;
        }

        const t1 = team1LeagueDetails.value!;
        const t2 = team2LeagueDetails.value!;

        // Liga-Spiele sind 1v1 Matches
        const p1: Player = { _id: 'placeholder', name: t1.playerName, score: 0 };
        const p2: Player = { _id: 'placeholder', name: t2.playerName, score: 0 };

        props.setMatch({
            _id: 'placeholder',
            team1: { _id: 'placeholder', name: t1.teamName, players: [p1, { ...p1 }], logo: t1.logo },
            team2: { _id: 'placeholder', name: t2.teamName, players: [p2, { ...p2 }], logo: t2.logo },
            season: CURRENT_SEASON_SLUG,
            league: selectedLeague.value,
        }, true);
    } else {
        props.setMatch({
            _id: 'placeholder',
            team1: { _id: 'placeholder', players: toPlayers(playerNames.team1) },
            team2: { _id: 'placeholder', players: toPlayers(playerNames.team2) }
        }, false);
    }
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
        transform: translateY(-5vh);
    }
}
</style>
