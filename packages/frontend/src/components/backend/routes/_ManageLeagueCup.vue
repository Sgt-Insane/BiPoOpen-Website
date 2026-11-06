<template>
    <div class="ManageLeagueCup">

        <h1 class="bp-title">League Cup Backend</h1>

        <div class="mc-filters">
            <Select v-model="selectedSeasonSlug" :options="seasonOptions" optionLabel="label" optionValue="value" class="w-full" />
        </div>

        <div v-if="isLoading" aria-busy="true">
            <div class="bp-skeleton mc-skeleton-panel" style="height: 180px"></div>
            <div class="bp-skeleton mc-skeleton-panel" style="height: 320px"></div>
        </div>

        <!-- ─── Kein Cup: Teilnehmer waehlen und erstellen ─── -->
        <div v-else-if="!leagueCup" class="mc-panel">
            <div class="mc-panel-title">Cup erstellen</div>
            <div v-for="division in season?.divisions ?? []" :key="division.league" class="mc-checkgroup">
                <div class="mc-checkgroup-title">{{ division.label }}</div>
                <label v-for="team in division.teams" :key="team.teamName" class="mc-check">
                    <input type="checkbox" :value="team.teamName" v-model="selectedParticipants">
                    {{ team.teamName }}
                </label>
            </div>
            <div class="bp-button" :class="{ 'mc-disabled': selectedParticipants.length < 2 || isSaving }" @click="createCup()">
                Cup mit {{ selectedParticipants.length }} Teams erstellen
            </div>
        </div>

        <template v-else>
            <!-- ─── Auslosung ─── -->
            <div class="mc-panel">
                <div class="mc-panel-title">{{ leagueCup.name }} – {{ leagueCup.participants.length }} Teams</div>

                <div v-if="cupWinner" class="mc-info">Pokalsieger: <b>{{ cupWinner }}</b></div>

                <template v-else-if="nextRoundName">
                    <div class="mc-info">Nächste Runde: <b>{{ nextRoundName }}</b> ({{ remaining.teams.length }} Teams)</div>

                    <div v-if="!remaining.complete" class="mc-info">
                        In der {{ lastRoundName }} fehlen noch Ergebnisse.
                    </div>

                    <template v-else>
                        <template v-if="byeCount > 0">
                            <div class="mc-info">
                                Freilose wählen: <b>{{ selectedByes.length }} / {{ byeCount }}</b>
                                <span v-for="group in remainingByLeague" :key="group.label"> · {{ group.label }}: {{ group.teams.filter(team => selectedByes.includes(team)).length }}</span>
                            </div>
                            <div v-for="group in remainingByLeague" :key="group.label" class="mc-checkgroup">
                                <div class="mc-checkgroup-title">{{ group.label }}</div>
                                <label v-for="teamName in group.teams" :key="teamName" class="mc-check">
                                    <input type="checkbox" :value="teamName" v-model="selectedByes"
                                        :disabled="!selectedByes.includes(teamName) && selectedByes.length >= byeCount">
                                    {{ teamName }}
                                </label>
                            </div>
                        </template>

                        <div class="mc-checkgroup-title">Begegnungen ({{ filledPairingCount }} / {{ pairingSlots.length }})</div>
                        <div v-for="(slot, index) in pairingSlots" :key="index" class="mc-pairing-row">
                            <span class="mc-pairing-index">{{ index + 1 }}.</span>
                            <Select v-for="side in (['team1', 'team2'] as const)" :key="side"
                                v-model="slot[side]"
                                :options="getTeamOptions(slot[side])"
                                :placeholder="side === 'team1' ? 'Team 1' : 'Team 2'"
                                showClear
                                filter
                                scrollHeight="300px"
                                class="mc-pairing-select"
                                :class="side === 'team2' ? 'order-3' : ''"
                                :pt="{ root: { style: '--p-select-focus-border-color: var(--main-color);' } }"
                            >
                                <template #option="slotProps">
                                    <div class="mc-team-option">
                                        <Avatar :name="slotProps.option" :avatarImage="getLeagueTeamLogo(slotProps.option, selectedSeasonSlug)" shape="square" class="mc-team-option-avatar" />
                                        <span>{{ slotProps.option }}</span>
                                    </div>
                                </template>
                            </Select>
                            <span class="mc-pairing-vs order-2">vs.</span>
                        </div>

                        <div class="bp-button" :class="{ 'mc-disabled': !canSaveRound || isSaving }" @click="saveRound()">
                            {{ nextRoundName }} festlegen
                        </div>
                    </template>
                </template>

                <div v-if="canUndoLastRound" class="bp-button mc-button-secondary" :class="{ 'mc-disabled': isSaving }" @click="undoRound()">
                    {{ lastRoundName }} zurücksetzen
                </div>

                <div v-if="!leagueCup.rounds.length" class="bp-button mc-button-secondary" :class="{ 'mc-disabled': isSaving }" @click="deleteCup()">
                    Cup löschen
                </div>
            </div>

            <!-- ─── Runden (neueste zuerst) ─── -->
            <div v-for="roundEntry in roundsNewestFirst" :key="roundEntry.index" class="mc-round">
                <div class="mc-round-title">
                    {{ roundNames[roundEntry.index] }}
                    <span v-if="roundEntry.round.bestOf > 1" class="mc-round-tag">Best-of-{{ roundEntry.round.bestOf }}</span>
                </div>

                <div v-if="roundEntry.round.byes.length" class="mc-info">
                    Freilose: {{ roundEntry.round.byes.join(', ') }}
                </div>

                <div v-if="roundEntry.index === leagueCup.rounds.length - 1 && roundEntry.hasOpenPairings" class="bp-button" @click="openAddGame(roundEntry.index)">
                    Spiel eintragen
                </div>

                <div v-for="pairingEntry in roundEntry.pairings" :key="pairingEntry.pairing.team1 + pairingEntry.pairing.team2" class="mc-pairing">
                    <div class="mc-pairing-title">
                        {{ pairingEntry.pairing.team1 }} – {{ pairingEntry.pairing.team2 }}
                        <span v-if="roundEntry.round.bestOf > 1"> ({{ pairingEntry.result.team1Wins }}:{{ pairingEntry.result.team2Wins }})</span>
                        <span class="mc-pairing-status">{{ pairingEntry.result.winner ? `Weiter: ${pairingEntry.result.winner}` : 'offen' }}</span>
                    </div>
                    <MatchElement v-for="match in pairingEntry.result.games" :key="match._id"
                        :match="withLeagueTeamLogos(match)" :isBackend="true" :avatarShape="'square'" @edit="openEditGame(match)"
                    />
                </div>
            </div>

            <!-- Ein Drawer fuer Neu (Paarung waehlen) und Bearbeiten (Paarung steht fest) -->
            <GameEntryDrawer
                v-model:visible="gameDrawerVisible"
                :title="editingMatch ? 'Spiel bearbeiten' : 'Spiel eintragen'"
                :subtitle="`League Cup · ${roundNames[drawerRoundIndex] ?? ''}`"
                :initialSides="editSides"
                :sideLabels="['Team 1', 'Team 2']"
                lockedNames
                :allowDraw="false"
                avatarShape="square"
                incompleteLabel="Paarung wählen"
                :save="saveGame"
                :remove="editingMatch ? deleteMatch : undefined"
            >
                <template v-if="!editingMatch" #top="{ setTeams }">
                    <CupPairingSelect :leagueCup="leagueCup" :roundIndex="drawerRoundIndex" :cupGames="cupGames" @select="setTeams"/>
                </template>
            </GameEntryDrawer>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import Avatar from '@/components/shared/Avatar.vue';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import GameEntryDrawer from '@/components/shared/GameEntry/GameEntryDrawer.vue';
import CupPairingSelect from '@/components/frontend/league/cup/CupPairingSelect.vue';
import { applySidesToMatch, matchToSides, sidesToNewMatch, type GameEntrySide } from '@/components/shared/GameEntry/gameEntry';
import { getLeagueTeamLogo, withLeagueTeamLogos } from '@/components/frontend/league/LeaguePlayersData';
import { addLeagueGame, getAllLeagueGames, updateLeagueGame, deleteLeagueGame } from '@/components/frontend/league/LeagueUtilFunctions';
import { CURRENT_SEASON_SLUG, LEAGUE_SEASONS, getSeason } from '@/components/frontend/league/LeagueSeasonsData';
import {
    addLeagueCupRound,
    createLeagueCup,
    deleteLeagueCup,
    getByeCount,
    getCupErrorMessage,
    getCupGames,
    getCupRoundGames,
    getCupWinner,
    getLeagueCup,
    getPairingResult,
    getPlannedRoundNames,
    getRemainingTeams,
    undoLeagueCupRound,
} from '@/components/frontend/league/cup/LeagueCupUtilFunctions';

const toast = useToast();

const cupSeasons = LEAGUE_SEASONS.filter(season => season.hasCup);
const seasonOptions = cupSeasons.map(season => ({ label: `Saison ${season.label}`, value: season.slug }));
const selectedSeasonSlug = ref(cupSeasons.some(season => season.slug === CURRENT_SEASON_SLUG) ? CURRENT_SEASON_SLUG : cupSeasons[0]?.slug);
const season = computed(() => getSeason(selectedSeasonSlug.value));

const isLoading = ref(true);
const isSaving = ref(false);
const leagueCup = ref<LeagueCup | null>(null);
const leagueGames = ref<Match[]>([]);

const selectedParticipants = ref<string[]>([]);
const selectedByes = ref<string[]>([]);
const gameDrawerVisible = ref(false);
const drawerRoundIndex = ref(0);
const editingMatch = ref<Match>();

const loadData = async () => {
    try {
        const [cup, games] = await Promise.all([getLeagueCup(selectedSeasonSlug.value), getAllLeagueGames()]);
        leagueCup.value = cup;
        leagueGames.value = games;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Fehler', detail: getCupErrorMessage(error), life: 3000 });
    } finally {
        isLoading.value = false;
    }
}

watch(selectedSeasonSlug, () => {
    isLoading.value = true;
    selectedParticipants.value = (season.value?.divisions ?? []).flatMap(division => division.teams.map(team => team.teamName));
    selectedByes.value = [];
    loadData();
}, { immediate: true });

// ─── Abgeleitete Daten ───
const cupGames = computed(() => leagueCup.value ? getCupGames(leagueGames.value, leagueCup.value) : []);
const cupWinner = computed(() => leagueCup.value ? getCupWinner(leagueCup.value, cupGames.value) : undefined);

const remaining = computed(() => leagueCup.value ? getRemainingTeams(leagueCup.value, cupGames.value) : { teams: [], complete: false });
const byeCount = computed(() => getByeCount(remaining.value.teams.length));
// Namen immer berechnen statt gespeicherte zu nehmen, damit Altdaten ("Vorrunde") nicht durchschlagen.
const roundNames = computed(() => leagueCup.value ? getPlannedRoundNames(leagueCup.value.participants.length) : []);
const nextRoundName = computed(() => roundNames.value[leagueCup.value?.rounds.length ?? 0]);
const lastRoundName = computed(() => roundNames.value[(leagueCup.value?.rounds.length ?? 0) - 1]);

// Freilos-Kandidaten nach Herkunftsliga gruppiert, damit die Verteilung auf beide Ligen sichtbar ist.
const remainingByLeague = computed(() =>
    (season.value?.divisions ?? []).map(division => ({
        label: division.label,
        teams: remaining.value.teams.filter(teamName =>
            leagueCup.value?.participants.find(participant => participant.teamName === teamName)?.league === division.league
        ),
    })).filter(group => group.teams.length)
);

// ─── Begegnungen der naechsten Runde (manuell per Dropdown) ───
type PairingSlot = { team1: string | null; team2: string | null };
const pairingSlots = ref<PairingSlot[]>([]);

// Nur neu aufbauen, wenn sich die Teams wirklich aendern (nicht bei jedem Neuladen nach einem Spiel).
watch(() => `${leagueCup.value?._id}|${leagueCup.value?.rounds.length}|${remaining.value.teams.join('|')}`, () => {
    const pairingCount = Math.max(0, (remaining.value.teams.length - byeCount.value) / 2);
    pairingSlots.value = Array.from({ length: pairingCount }, () => ({ team1: null, team2: null }));
}, { immediate: true });

// Wird ein Team zum Freilos, fliegt es aus seiner Begegnung.
watch(selectedByes, (byes) => {
    pairingSlots.value.forEach((slot) => {
        if (slot.team1 && byes.includes(slot.team1)) slot.team1 = null;
        if (slot.team2 && byes.includes(slot.team2)) slot.team2 = null;
    });
});

// Jedes Team nur einmal waehlbar: ohne Freilose und ohne Teams aus anderen Begegnungen.
const getTeamOptions = (currentTeam: string | null) => {
    const usedTeams = pairingSlots.value.flatMap(slot => [slot.team1, slot.team2]);
    return remaining.value.teams.filter(teamName =>
        teamName === currentTeam || (!selectedByes.value.includes(teamName) && !usedTeams.includes(teamName))
    );
}

const filledPairingCount = computed(() => pairingSlots.value.filter(slot => slot.team1 && slot.team2).length);

const canSaveRound = computed(() =>
    selectedByes.value.length === byeCount.value
    && pairingSlots.value.length > 0
    && filledPairingCount.value === pairingSlots.value.length
);

const canUndoLastRound = computed(() =>
    !!leagueCup.value?.rounds.length && !getCupRoundGames(cupGames.value, leagueCup.value.rounds.length - 1).length
);

const roundsNewestFirst = computed(() =>
    (leagueCup.value?.rounds ?? []).map((round, index) => {
        const roundGames = getCupRoundGames(cupGames.value, index);
        const pairings = round.pairings.map(pairing => ({ pairing, result: getPairingResult(pairing, roundGames, round.bestOf) }));
        return { round, index, pairings, hasOpenPairings: pairings.some(entry => !entry.result.winner) };
    }).reverse()
);

// ─── Aktionen ───
const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    if (isSaving.value) return;
    isSaving.value = true;
    try {
        await action();
        selectedByes.value = [];
        await loadData();
        toast.add({ severity: 'success', summary: 'Erfolg', detail: successMessage, life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Fehler', detail: getCupErrorMessage(error), life: 3000 });
    } finally {
        isSaving.value = false;
    }
}

const createCup = () => {
    const participants = (season.value?.divisions ?? []).flatMap(division =>
        division.teams
            .filter(team => selectedParticipants.value.includes(team.teamName))
            .map(team => ({ teamName: team.teamName, league: division.league }))
    );
    runAction(() => createLeagueCup(selectedSeasonSlug.value, participants), 'Cup wurde erstellt');
}

const saveRound = () => {
    if (!leagueCup.value || !canSaveRound.value || !confirm(`Begegnungen der ${nextRoundName.value} jetzt festlegen?`)) return;
    const cup = leagueCup.value;
    const pairings = pairingSlots.value.map(slot => ({ team1: slot.team1!, team2: slot.team2! }));
    runAction(() => addLeagueCupRound(cup, pairings, selectedByes.value), `${nextRoundName.value} wurde festgelegt`);
}

const undoRound = () => {
    if (!leagueCup.value || !confirm(`${lastRoundName.value} wirklich zurücksetzen?`)) return;
    const cup = leagueCup.value;
    runAction(() => undoLeagueCupRound(cup), `${lastRoundName.value} wurde zurückgesetzt`);
}

const deleteCup = () => {
    if (!leagueCup.value || !confirm('Cup wirklich löschen?')) return;
    const cup = leagueCup.value;
    runAction(() => deleteLeagueCup(cup), 'Cup wurde gelöscht');
}

// ─── Spiel eintragen / bearbeiten ───
// Logos kommen aus der Saison, das Spiel selbst speichert nur Teamnamen.
const editSides = computed(() =>
    editingMatch.value
        ? matchToSides(editingMatch.value).map(side => ({ ...side, logo: getLeagueTeamLogo(side.players[0]?.name ?? '', selectedSeasonSlug.value) }))
        : undefined
);

const openAddGame = (roundIndex: number) => {
    editingMatch.value = undefined;
    drawerRoundIndex.value = roundIndex;
    gameDrawerVisible.value = true;
}

const openEditGame = (match: Match) => {
    editingMatch.value = match;
    drawerRoundIndex.value = match.cupRound ?? 0;
    gameDrawerVisible.value = true;
}

const saveGame = async (sides: GameEntrySide[]) => {
    const success = editingMatch.value
        ? await updateLeagueGame(applySidesToMatch(editingMatch.value, sides))
        : await addLeagueGame(sidesToNewMatch(sides, { season: leagueCup.value!.season, cupId: leagueCup.value!._id, cupRound: drawerRoundIndex.value }));
    await loadData();
    return success;
}

const deleteMatch = async () => {
    const success = await deleteLeagueGame(editingMatch.value!);
    await loadData();
    return success;
}
</script>

<style scoped>
.bp-title{
    padding-bottom: 10px;
}
.mc-filters{
    margin-bottom: 20px;
}
.mc-panel{
    padding: 15px;
    margin-bottom: 30px;
    border: 1px solid var(--bp-border);
    border-radius: 4px;
}
.mc-skeleton-panel{
    margin-bottom: 30px;
    border-radius: 4px;
}
.mc-panel-title{
    font-size: 20px;
    font-weight: bold;
    color: var(--main-color);
    margin-bottom: 10px;
}
.mc-info{
    color: var(--main-color);
    margin-bottom: 10px;
}
.mc-checkgroup{
    margin-bottom: 15px;
}
.mc-checkgroup-title{
    font-weight: bold;
    color: var(--secondary-color);
    margin-bottom: 5px;
}
.mc-check{
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    cursor: pointer;
}
.mc-pairing-row{
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
}
.mc-pairing-index{
    width: 24px;
    min-width: 24px;
    color: var(--secondary-color);
}
.mc-pairing-select{
    flex: 1;
    min-width: 0;
}
.mc-pairing-vs{
    color: gray;
    font-style: italic;
    font-size: 12px;
}
.mc-team-option{
    display: flex;
    align-items: center;
    gap: 8px;
}
.mc-team-option-avatar{
    width: 30px;
    height: 30px;
    min-width: 30px;
}
.mc-panel .bp-button{
    margin-top: 10px;
}
.mc-button-secondary{
    background: var(--secondary-color) !important;
}
.mc-disabled{
    opacity: 0.3;
    pointer-events: none;
}

.mc-round{
    margin-bottom: 30px;
}
.mc-round-title{
    font-size: 22px;
    font-weight: bold;
    color: var(--main-color);
    margin-bottom: 10px;
}
.mc-round-tag{
    font-size: 13px;
    color: var(--secondary-color);
    margin-left: 6px;
}
.mc-round > .bp-button{
    margin-bottom: 10px;
}
.mc-pairing{
    margin-bottom: 12px;
}
.mc-pairing-title{
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    font-weight: bold;
    margin-bottom: 4px;
}
.mc-pairing-status{
    margin-left: auto;
    font-weight: normal;
    color: var(--secondary-color);
    font-size: 13px;
}
</style>
