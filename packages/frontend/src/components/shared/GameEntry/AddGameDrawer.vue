<template>
    <GameEntryDrawer
        v-model:visible="addGameVisible"
        :title="knechtSetup ? 'BiPo Knecht' : undefined"
        :subtitle="subtitle"
        :initialSides="initialSides"
        v-bind="MODE_PROPS[mode]"
        :save="save"
        eloPreview
        :launch="knechtSetup || mode !== 'open' ? launch : undefined"
        :hideScores="knechtSetup"
    >
        <template #top="{ setTeams }">
            <!-- BiPo Knecht: laufendes Spiel fortsetzen oder Knecht oeffnen -->
            <button v-if="!knechtSetup" type="button" class="ag-knecht" :class="{ 'ag-knecht--running': runningGameTitle }" @click="openKnecht">
                <span class="ag-knecht-icon">🎯</span>
                <span class="ag-knecht-text">
                    <span class="ag-knecht-title">{{ runningGameTitle ? 'Laufendes Knecht-Spiel' : 'BiPo Knecht' }}</span>
                    <span class="ag-knecht-subtitle">{{ runningGameTitle ?? 'Spiel live Wurf für Wurf zählen' }}</span>
                </span>
                <span class="ag-knecht-action">{{ runningGameTitle ? 'Fortsetzen' : 'Öffnen' }}</span>
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
                    {{ leagueCup === undefined ? 'Paarungen werden geladen â€¦' : 'Im League Cup ist gerade keine Paarung offen.' }}
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
import { CURRENT_SEASON_SLUG, LEAGUE_SEASONS, getSeason, toLeaguePlayers } from '@/components/frontend/league/LeagueSeasonsData';
import { clearPlayerCaches, getUnlockedBadges } from '@/components/frontend/playerProfile/PlayerProfileUtilFunctions';
import { clearGameDataCache, getGameData } from '@/util/gameDataCache';
import { useKnechtLaunch } from '@/components/frontend/biPoKnecht/useKnechtLaunch';
import { runningGameTitle } from '@/components/frontend/biPoKnecht/knechtStorage';
import router from '@/router.js';

// Drawer-Einstellungen je Spieltyp
const TEAM_LABELS: [string, string] = ['Team 1', 'Team 2'];
const MODE_PROPS = {
    open: { allowExtraPlayers: true },
    league: { sideLabels: TEAM_LABELS, incompleteLabel: 'Teams wÃ¤hlen' },
    cup: { sideLabels: TEAM_LABELS, lockedNames: true, allowDraw: false, avatarShape: 'square' as const, incompleteLabel: 'Paarung wÃ¤hlen' },
};

const { addGameVisible, pageContext, presetNames, knechtSetup, notifyGameSaved } = useAddGame();
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

// â”€â”€â”€ Daten â”€â”€â”€
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

    const context = pageContext.value;
    mode.value = context && modeOptions.some(option => option.value === context.mode) ? context.mode : 'open';
    if (context?.league !== undefined && divisionOptions.some(option => option.value === context.league))
        league.value = context.league;

    // Leer, falls beim letzten Oeffnen noch vorbelegt war
    initialSides.value = presetNames.value ? createPresetSides(presetNames.value) : createEmptySides();
    presetNames.value = null;

    loadData();
});

// â”€â”€â”€ Liga â”€â”€â”€
const division = computed(() => season.divisions.find(entry => entry.league === league.value) ?? season.divisions[0]);
const leagueTeams = computed(() => toLeaguePlayers(division.value.teams));

// â”€â”€â”€ Pokal â”€â”€â”€
// Eingetragen wird in der zuletzt angelegten Runde.
const cupRoundIndex = computed(() => (leagueCup.value?.rounds.length ?? 0) - 1);
const cupGames = computed(() => leagueCup.value ? getCupGames(leagueGames.value, leagueCup.value) : []);

const hasOpenCupPairings = computed(() => {
    const round = leagueCup.value?.rounds[cupRoundIndex.value];
    if (!round) return false;

    const roundGames = getCupRoundGames(cupGames.value, cupRoundIndex.value);
    return round.pairings.some(pairing => !getPairingResult(pairing, roundGames, round.bestOf).winner);
});

// â”€â”€â”€ Drawer â”€â”€â”€
const subtitle = computed(() => {
    if (mode.value === 'league')
        return getLeagueGameSubtitle(division.value, filterLeagueGames(leagueGames.value, season.slug, league.value));

    if (mode.value === 'cup') {
        const roundName = leagueCup.value ? getPlannedRoundNames(leagueCup.value.participants.length)[cupRoundIndex.value] : undefined;
        return ['League Cup', roundName].filter(part => part).join(' Â· ');
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

// Laufendes Spiel: zurueck in den Knecht. Sonst zur Startseite des Knechts.
const openKnecht = () => {
    addGameVisible.value = false;
    router.push(runningGameTitle.value ? '/Knecht?Fortsetzen' : '/Knecht');
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
        // Erst die Caches leeren, damit die Seiten beim Neuladen frische Daten bekommen
        clearGameDataCache();
        clearPlayerCaches();
        notifyGameSaved();
        if (badgesBefore) showNewAwards(badgesBefore, names, sides.map(getSideScore).join(' : '));
    }
    return success;
};

// â”€â”€â”€ Erfolge â”€â”€â”€
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

/* ─── BiPo Knecht ─── */
.ag-knecht{
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid #E6E8EB;
    border-radius: 14px;
    background: white;
    color: #1F2328;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.ag-knecht--running{
    border-color: var(--main-color);
    background: #FFF7F8;
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
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    color: #6B7079;
}
.ag-knecht-action{
    padding: 6px 12px;
    border-radius: 999px;
    background: #F1F2F4;
    color: #3A3F46;
    font-size: 13px;
    font-weight: 700;
}
.ag-knecht--running .ag-knecht-action{
    background: var(--main-color);
    color: white;
}
</style>
