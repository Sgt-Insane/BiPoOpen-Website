<template>
    <!-- Erst waehlen, was man vorhat (ab 2.1.0, vorher direkt das Formular) -->
    <BottomSheet v-if="useChooser" v-model:visible="chooserVisible">
        <template #header>
            <div class="ag-title">Spiel<DevBadge feature="anstossen" /></div>
        </template>
        <div class="ag-choose">
            <button v-if="runningGameTitle" type="button" class="ag-knecht" @click="resumeKnecht">
                <span class="ag-knecht-icon">🎯</span>
                <span class="ag-knecht-text">
                    <span class="ag-knecht-title">Laufendes Knecht-Spiel</span>
                    <span class="ag-knecht-subtitle" v-fit-text>{{ runningGameTitle }}</span>
                </span>
                <span class="ag-knecht-action">Fortsetzen</span>
            </button>
            <button v-if="openLobby" type="button" class="ag-knecht" @click="resumeLobby">
                <span class="ag-knecht-icon">🍻</span>
                <span class="ag-knecht-text">
                    <span class="ag-knecht-title">Offene Lobby</span>
                    <span class="ag-knecht-subtitle" v-fit-text>PIN {{ openLobby }}</span>
                </span>
                <span class="ag-knecht-action">Fortsetzen</span>
            </button>

            <button type="button" class="ag-option" :class="{ 'ag-option--muted': !profileName }" @click="goBump">
                <span class="ag-option-icon">🍻</span>
                <span class="ag-option-text">
                    <span class="ag-option-title">Anstoßen &amp; spielen<DevBadge feature="anstossen" /></span>
                    <span class="ag-option-detail">{{ profileName ? 'Jeder mit eigenem Handy – per Anstoßen oder PIN' : 'Erst dein Profil wählen, dann anstoßen' }}</span>
                </span>
                <i class="pi pi-angle-right"></i>
            </button>
            <button type="button" class="ag-option" @click="step = 'track'">
                <span class="ag-option-icon">🎯</span>
                <span class="ag-option-text">
                    <span class="ag-option-title">Spiel tracken</span>
                    <span class="ag-option-detail">Ein Handy zählt jeden Wurf im BiPo Knecht</span>
                </span>
                <i class="pi pi-angle-right"></i>
            </button>
            <button type="button" class="ag-option" @click="step = 'result'">
                <span class="ag-option-icon">✏️</span>
                <span class="ag-option-text">
                    <span class="ag-option-title">Ergebnis eintragen</span>
                    <span class="ag-option-detail">Spiel ist schon vorbei – Treffer eintragen</span>
                </span>
                <i class="pi pi-angle-right"></i>
            </button>
        </div>
    </BottomSheet>

    <GameEntryDrawer
        v-model:visible="entryVisible"
        :title="entryTitle"
        :entry="useChooser ? (step === 'track' ? 'track' : 'result') : 'both'"
        :subtitle="subtitle"
        :initialSides="initialSides"
        v-bind="MODE_PROPS[mode]"
        :save="save"
        eloPreview
        :launch="launch"
    >
        <template #top="{ setTeams }">
            <button v-if="useChooser" type="button" class="ag-back" @click="step = 'choose'"><i class="pi pi-angle-left"></i> Andere Auswahl</button>
            <!-- Laufendes BiPo-Knecht-Spiel fortsetzen -->
            <button v-if="runningGameTitle && !useChooser" type="button" class="ag-knecht" @click="resumeKnecht">
                <span class="ag-knecht-icon">🎯</span>
                <span class="ag-knecht-text">
                    <span class="ag-knecht-title">Laufendes Knecht-Spiel</span>
                    <span class="ag-knecht-subtitle" v-fit-text>{{ runningGameTitle }}</span>
                </span>
                <span class="ag-knecht-action">Fortsetzen</span>
            </button>

            <!-- Spieltyp -->
            <SelectButton
                v-model="mode"
                :options="modeOptions"
                optionLabel="label"
                optionValue="value"
                :allowEmpty="false"
                fluid
            >
                <template #option="{ option }">
                    <span class="ag-dot" :style="{ background: option.color }"></span>
                    {{ option.label }}
                </template>
            </SelectButton>

            <!-- Liga -->
            <SelectButton v-if="mode === 'league' && divisionOptions.length > 1"
                v-model="league"
                :options="divisionOptions"
                optionLabel="label"
                optionValue="value"
                :allowEmpty="false"
                fluid
            />

            <!-- Pokal: Paarung der laufenden Runde -->
            <template v-if="mode === 'cup'">
                <CupPairingSelect v-if="leagueCup && hasOpenCupPairings"
                    :leagueCup="leagueCup"
                    :roundIndex="cupRoundIndex"
                    :cupGames="cupGames"
                    @select="setTeams"
                />
                <div v-else class="ag-hint">
                    {{ leagueCup === undefined ? 'Paarungen werden geladen …' : 'Im League Cup ist gerade keine Paarung offen.' }}
                </div>
            </template>
        </template>

        <template v-if="mode === 'league'" #player="{ player, excludedNames, setName }">
            <LeagueTeamSelect :modelValue="player.name" :teams="leagueTeams" :excludedNames="excludedNames" @update:modelValue="setName"/>
        </template>
    </GameEntryDrawer>

    <GameAwardSheet v-model:visible="awardVisible" :badges="awardBadges" :score="awardScore"/>
</template>

<script setup lang="ts">
import DevBadge from '@/components/shared/DevBadge.vue';
import { computed, ref, shallowRef, watch } from 'vue';
import SelectButton from 'primevue/selectbutton';
import GameEntryDrawer from './GameEntryDrawer.vue';
import GameAwardSheet from './GameAwardSheet.vue';
import { createEmptySides, getSideScore, sidesToNewMatch, type GameEntrySide } from './gameEntry';
import { useAddGame, type AddGameMode } from './useAddGame';
import LeagueTeamSelect from '@/components/frontend/league/LeagueTeamSelect.vue';
import CupPairingSelect from '@/components/frontend/league/cup/CupPairingSelect.vue';
import { addOpenGame } from '@/components/frontend/openGames/OpenGamesUtilFunctions';
import { addLeagueGame, filterLeagueGames, getAllLeagueGames, getLeagueGameSubtitle } from '@/components/frontend/league/LeagueUtilFunctions';
import { getCupGames, getCupRoundGames, getLeagueCup, getPairingResult, getPlannedRoundNames } from '@/components/frontend/league/cup/LeagueCupUtilFunctions';
import { CURRENT_SEASON_SLUG, LEAGUE_SEASONS, getActiveTeams, getSeason, toLeaguePlayers } from '@/components/frontend/league/LeagueSeasonsData';
import { getUnlockedBadges } from '@/components/frontend/playerProfile/PlayerProfileUtilFunctions';
import { clearGameDataCache, getGameData } from '@/util/gameDataCache';
import { useKnechtLaunch } from '@/components/frontend/biPoKnecht/useKnechtLaunch';
import { runningGameTitle } from '@/components/frontend/biPoKnecht/knechtStorage';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import { isFeatureOn } from '@/util/featureFlags';
import { useProfile } from '@/components/frontend/multiplayer/useProfile';
import { useMultiplayerSession } from '@/components/frontend/multiplayer/useMultiplayerSession';
import { requestBumpPermission } from '@/components/frontend/multiplayer/useBump';
import router from '@/router.js';

// Drawer-Einstellungen je Spieltyp
const TEAM_LABELS: [string, string] = ['Team 1', 'Team 2'];
const MODE_PROPS = {
    open: { allowExtraPlayers: true, allowTeamName: true },
    league: { sideLabels: TEAM_LABELS, incompleteLabel: 'Teams wählen' },
    cup: { sideLabels: TEAM_LABELS, lockedNames: true, allowDraw: false, avatarShape: 'square' as const, incompleteLabel: 'Paarung wählen' },
};

const { addGameVisible, pageContext, presetNames, notifyGameSaved } = useAddGame();
const { profileName } = useProfile();

// ─── Auswahl: anstossen, tracken oder Ergebnis eintragen (ab 2.1.0) ───
const useChooser = computed(() => isFeatureOn('anstossen'));
const step = ref<'choose' | 'track' | 'result'>('choose');
const chooserVisible = computed({
    get: () => addGameVisible.value && step.value === 'choose',
    set: (visible) => { if (!visible) addGameVisible.value = false; },
});
const entryVisible = computed({
    get: () => addGameVisible.value && (!useChooser.value || step.value !== 'choose'),
    set: (visible) => { if (!visible) addGameVisible.value = false; },
});
const entryTitle = computed(() => !useChooser.value ? 'Spiel eintragen' : step.value === 'track' ? 'Spiel tracken' : 'Ergebnis eintragen');

// Ohne Profil fragt die Anstoss-Seite zuerst danach
// Offene Anstoss-Lobby (nur pruefen, ob es sie noch gibt)
const { storedCode, checkStored } = useMultiplayerSession();
const openLobby = ref<string | null>(null);
watch(addGameVisible, async (isVisible) => {
    if (!isVisible || !useChooser.value || !storedCode.value) { if (!storedCode.value) openLobby.value = null; return; }
    openLobby.value = storedCode.value;
    openLobby.value = await checkStored();
});
const resumeLobby = () => {
    const code = openLobby.value;
    addGameVisible.value = false;
    if (code) router.push(`/Mitspielen/${code}`);
};

// Antippen = Bestaetigung: der Sensor wird gleich freigeschaltet (iPhone fragt hier), die Seite lauscht sofort.
// Eine offene Lobby gibt es oben extra ("Fortsetzen"), hier geht es immer mit einer neuen Suche los.
const goBump = () => {
    requestBumpPermission();
    addGameVisible.value = false;
    router.push({ path: '/Mitspielen', query: { anstossen: '1' } });
};

const { launchKnecht } = useKnechtLaunch();

// Eingetragen wird immer in der aktuellen Saison.
const season = getSeason(CURRENT_SEASON_SLUG) ?? LEAGUE_SEASONS[0];

const modeOptions = [
    { label: 'Offen', value: 'open', color: 'var(--bp-text-secondary)' },
    { label: 'Liga', value: 'league', color: '#2AA3B8' },
    ...(season.hasCup ? [{ label: 'Cup', value: 'cup', color: '#EA5160' }] : []),
];
const divisionOptions = season.divisions.map(division => ({ label: division.label, value: division.league }));

const mode = ref<AddGameMode>('open');
const league = ref(season.divisions[0].league);

// Neue leere Seiten bei jedem Wechsel von Spieltyp oder Liga.
// sync: laeuft sofort beim Oeffnen, bevor die Vorbelegung gesetzt wird, und ueberschreibt sie nicht.
const initialSides = shallowRef<GameEntrySide[]>(createEmptySides());
watch([mode, league], () => { initialSides.value = createEmptySides(); }, { flush: 'sync' });

const createPresetSides = (names: string[]) => {
    const sides = createEmptySides();
    names.forEach((name, index) => sides[index].players[0].name = name);
    return sides;
};

// ─── Daten ───
// Bei jedem Oeffnen neu laden, damit Runde und offene Paarungen aktuell sind.
const leagueGames = shallowRef<Match[]>([]);    // neueste zuerst
const leagueCup = ref<LeagueCup | null | undefined>(undefined);   // undefined = laedt

const loadData = () => {
    getAllLeagueGames().then(games => leagueGames.value = games.reverse()).catch(() => {});

    if (!season.hasCup)
        leagueCup.value = null;
    else
        getLeagueCup(season.slug).then(cup => leagueCup.value = cup ?? null).catch(() => leagueCup.value = null);
};

// Vorauswahl der angezeigten Seite, sonst offenes Spiel
watch(addGameVisible, (isVisible) => {
    if (!isVisible) return;
    // Vorbelegte Namen (z.B. offene Liga-Paarung): direkt zum Eintragen, sonst erst die Auswahl
    step.value = presetNames.value ? 'result' : 'choose';

    const context = pageContext.value;
    mode.value = context && modeOptions.some(option => option.value === context.mode) ? context.mode : 'open';
    if (context?.league !== undefined && divisionOptions.some(option => option.value === context.league))
        league.value = context.league;

    // Leer, falls beim letzten Oeffnen noch vorbelegt war
    initialSides.value = presetNames.value ? createPresetSides(presetNames.value) : createEmptySides();
    presetNames.value = null;

    loadData();
});

// ─── Liga ───
const division = computed(() => season.divisions.find(entry => entry.league === league.value) ?? season.divisions[0]);
const leagueTeams = computed(() => toLeaguePlayers(getActiveTeams(division.value)));

// ─── Pokal ───
// Eingetragen wird in der zuletzt angelegten Runde.
const cupRoundIndex = computed(() => (leagueCup.value?.rounds.length ?? 0) - 1);
const cupGames = computed(() => leagueCup.value ? getCupGames(leagueGames.value, leagueCup.value) : []);

const hasOpenCupPairings = computed(() => {
    const round = leagueCup.value?.rounds[cupRoundIndex.value];
    if (!round) return false;

    const roundGames = getCupRoundGames(cupGames.value, cupRoundIndex.value);
    return round.pairings.some(pairing => !getPairingResult(pairing, roundGames, round.bestOf).winner);
});

// ─── Drawer ───
const subtitle = computed(() => {
    if (mode.value === 'league')
        return getLeagueGameSubtitle(division.value, filterLeagueGames(leagueGames.value, season.slug, league.value));

    if (mode.value === 'cup') {
        const roundName = leagueCup.value ? getPlannedRoundNames(leagueCup.value.participants.length)[cupRoundIndex.value] : undefined;
        return ['League Cup', roundName].filter(part => part).join(' · ');
    }

    return 'Offenes Spiel';
});

const saveGame = (sides: GameEntrySide[]) => {
    const match = sidesToMatch(sides);
    if (!match) return Promise.resolve(false);
    return mode.value === 'open' ? addOpenGame(match) : addLeagueGame(match);
};

// Spiel mit den gewaehlten Teams fuer den jeweiligen Spieltyp
const sidesToMatch = (sides: GameEntrySide[]) => {
    if (mode.value === 'league')
        return sidesToNewMatch(sides, { season: season.slug, league: league.value });

    if (mode.value === 'cup') {
        const cup = leagueCup.value;
        if (!cup) return null;
        return sidesToNewMatch(sides, { season: cup.season, cupId: cup._id, cupRound: cupRoundIndex.value });
    }

    return sidesToNewMatch(sides);
};

const resumeKnecht = () => {
    addGameVisible.value = false;
    router.push('/Knecht');
};

// Liga-Teams bringen ihr Logo mit, damit der Knecht es anzeigen kann
const launch = (sides: GameEntrySide[]) => {
    const match = sidesToMatch(sides);
    if (!match) return;
    const withLogo = (team: Team, side: GameEntrySide): Team => {
        const leagueTeam = leagueTeams.value.find(entry => entry.name === side.players[0]?.name);
        const logo = side.logo ?? leagueTeam?.logo;
        return logo ? { ...team, logo } : team;
    };
    launchKnecht({ ...match, team1: withLogo(match.team1, sides[0]), team2: withLogo(match.team2, sides[1]) });
};

const save = async (sides: GameEntrySide[]) => {
    const names = sides.flatMap(side => side.players.map(player => player.name));
    // Erfolge vor dem Speichern, zum Vergleich danach. Ohne Daten gibt es eben keinen Hinweis.
    const badgesBefore = await getGameData().then(data => getUnlockedBadges(data, names)).catch(() => null);

    const success = await saveGame(sides);
    if (success) {
        // Erst den Cache leeren, damit die Seiten beim Neuladen frische Daten bekommen
        clearGameDataCache();
        notifyGameSaved();
        if (badgesBefore) showNewAwards(badgesBefore, names, sides.map(getSideScore).join(' : '));
    }
    return success;
};

// ─── Erfolge ───
// Neu freigeschaltete Badges der beteiligten Spieler, Titel zuerst
const AWARD_GROUP_ORDER: PlayerBadgeGroup[] = ['title', 'record', 'milestone', 'performance'];

const awardVisible = ref(false);
const awardBadges = shallowRef<PlayerBadge[]>([]);
const awardScore = ref('');

const showNewAwards = async (badgesBefore: Map<string, PlayerBadge[]>, names: string[], score: string) => {
    try {
        const badgesAfter = getUnlockedBadges(await getGameData(), names);
        const newBadges = [...badgesAfter].flatMap(([playerName, badges]) => {
            const knownIds = new Set(badgesBefore.get(playerName)?.map(badge => badge.id));
            return badges.filter(badge => badge.award && !knownIds.has(badge.id));
        });
        if (!newBadges.length) return;

        awardBadges.value = newBadges.sort((a, b) => AWARD_GROUP_ORDER.indexOf(a.group) - AWARD_GROUP_ORDER.indexOf(b.group));
        awardScore.value = score;
        awardVisible.value = true;
    } catch {
        // Kein Hinweis, das Spiel ist trotzdem gespeichert
    }
};
</script>

<style scoped>
.ag-dot{
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 50%;
}
.ag-hint{
    padding: 12px;
    border-radius: 12px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-muted);
    font-size: 14px;
    text-align: center;
}

/* ─── Auswahl ─── */
.ag-title{
    font-size: 20px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.ag-choose{
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 8px;
}
.ag-option{
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 72px;
    padding: 12px 16px;
    border: 1px solid var(--bp-border);
    border-radius: 18px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.ag-option--muted{
    border-color: var(--bp-border);
    background: var(--bp-fill-soft);
    color: var(--bp-text-muted);
}
.ag-option--muted .ag-option-detail{ color: var(--bp-text-muted); }
.ag-option-icon{ font-size: 26px; }
.ag-option-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}
.ag-option-title{
    font-size: 17px;
    font-weight: 800;
}
.ag-option-detail{
    font-size: 13px;
    color: var(--bp-text-secondary);
}
.ag-back{
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    border: none;
    background: none;
    color: var(--bp-text-secondary);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}

/* ─── BiPo Knecht ─── */
.ag-knecht{
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--main-color);
    border-radius: 14px;
    background: #FFF7F8;
    color: #1F2328;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.ag-knecht-icon{
    font-size: 20px;
}
.ag-knecht-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}
.ag-knecht-title{
    font-size: 14px;
    font-weight: 700;
}
.ag-knecht-subtitle{
    overflow: hidden;
    white-space: nowrap;
    font-size: 12px;
    color: #6B7079;
}
.ag-knecht-action{
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--main-color);
    color: white;
    font-size: 13px;
    font-weight: 700;
}
</style>
