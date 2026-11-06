<template>
    <div class="ff-series" :class="{ 'ff-series--expanded': expanded }">

        <!-- Paarung (zusammengeklappt) -->
        <div class="ff-series-header" @click="toggleExpanded">
            <div class="ff-match">
                <div class="ff-teams">
                    <div class="ff-team" :class="{ 'ff-team--loose': isSeriesLoser(0) }">
                        <Avatar
                            v-if="seriesMatch.team1"
                            :name="getTeamName(seriesMatch.team1, team1Placeholder)"
                            :avatarImage="seriesMatch.team1.logo"
                            :shape="avatarShape"
                            :grayscale="isSeriesLoser(0)"
                            class="ff-avatar"
                        />
                        <span class="ff-team-name">{{ getTeamName(seriesMatch.team1, team1Placeholder) }}</span>
                        <span v-if="seriesScoresVisible" class="ff-team-score">{{ seriesResult.team1Wins }}</span>
                    </div>
                    <div class="ff-team" :class="{ 'ff-team--loose': isSeriesLoser(1) }">
                        <Avatar
                            v-if="seriesMatch.team2"
                            :name="getTeamName(seriesMatch.team2, team2Placeholder)"
                            :avatarImage="seriesMatch.team2.logo"
                            :shape="avatarShape"
                            :grayscale="isSeriesLoser(1)"
                            class="ff-avatar"
                        />
                        <span class="ff-team-name">{{ getTeamName(seriesMatch.team2, team2Placeholder) }}</span>
                        <span v-if="seriesScoresVisible" class="ff-team-score ff-team-score--second">{{ seriesResult.team2Wins }}</span>
                    </div>
                </div>
                <span v-if="!seriesScoresVisible" class="ff-vs">vs.</span>
            </div>
        </div>

        <!-- Die 3 Spiele (ausgeklappt) -->
        <div v-if="expanded" class="ff-series-games">
            <div v-for="(gameMatch, index) in seriesResult.games" :key="gameMatch._id || index" class="ff-series-game">
                <div class="ff-series-game-title">Spiel {{ index + 1 }}</div>
                <MatchElement
                    :match="withLeagueTeamLogos(gameMatch)"
                    :avatarShape="avatarShape"
                    :team1Placeholder="team1Placeholder"
                    :team2Placeholder="team2Placeholder"
                />
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import { withLeagueTeamLogos } from './LeaguePlayersData';

const props = defineProps({
    team1: { type: Object as () => Team | undefined, default: undefined },
    team2: { type: Object as () => Team | undefined, default: undefined },
    team1Placeholder: { type: String, default: 'TBD' },
    team2Placeholder: { type: String, default: 'TBD' },
    avatarShape: { type: String as () => 'circle' | 'square', default: 'square' },
    leagueGames: { type: Array as () => Match[], required: true },
    regularSeasonGameCount: { type: Number, required: true },
});

const getTeamNames = (team: Team | undefined) => team
    ? [team.name, ...team.players.map(player => player.name)].filter(Boolean).map(name => name!.toLocaleLowerCase())
    : [];

const getFinalFourGames = () => props.leagueGames
    .slice()
    .sort((match1, match2) => (match1.time ?? 0) - (match2.time ?? 0))
    .slice(props.regularSeasonGameCount);

const getSeriesResult = (team1: Team | undefined, team2: Team | undefined) => {
    const team1Names = getTeamNames(team1);
    const team2Names = getTeamNames(team2);
    const games = getFinalFourGames().filter(match => {
        const matchTeam1Names = getTeamNames(match.team1);
        const matchTeam2Names = getTeamNames(match.team2);
        return matchTeam1Names.some(name => team1Names.includes(name)) && matchTeam2Names.some(name => team2Names.includes(name))
            || matchTeam1Names.some(name => team2Names.includes(name)) && matchTeam2Names.some(name => team1Names.includes(name));
    }).slice(0, 3);
    let team1Wins = 0;
    let team2Wins = 0;

    games.forEach(match => {
        const matchTeam1Score = match.team1.players.reduce((score, player) => score + (player.score ?? 0), 0);
        const matchTeam2Score = match.team2.players.reduce((score, player) => score + (player.score ?? 0), 0);
        if (matchTeam1Score === matchTeam2Score)
            return;

        const matchUsesTeam1 = getTeamNames(match.team1).some(name => team1Names.includes(name));
        if (matchUsesTeam1 === (matchTeam1Score > matchTeam2Score))
            team1Wins++;
        else
            team2Wins++;
    });

    return {
        games,
        team1Wins,
        team2Wins,
        winner: team1Wins >= 2 ? team1 : team2Wins >= 2 ? team2 : undefined,
        loser: team1Wins >= 2 ? team2 : team2Wins >= 2 ? team1 : undefined,
    };
};

const seriesResult = computed(() => getSeriesResult(props.team1, props.team2));

const seriesScoresVisible = computed(() => seriesResult.value.team1Wins > 0 || seriesResult.value.team2Wins > 0);

const getTeamName = (team: Team | undefined, placeholder: string) => {
    if (!team)
        return placeholder;

    return team.name || team.players.map(player => player.name.trim()).filter(Boolean).join(' & ') || placeholder;
};

const isSeriesLoser = (teamIndex: 0 | 1) => {
    if (!seriesScoresVisible.value)
        return false;

    return teamIndex === 0
        ? seriesResult.value.team2Wins >= 2 && seriesResult.value.team1Wins < 2
        : seriesResult.value.team1Wins >= 2 && seriesResult.value.team2Wins < 2;
};

const scoredTeam = (team: Team | undefined, score: number) => team ? {
    ...team,
    players: team.players.map(player => ({ ...player, score })),
} as Team : undefined;

const seriesMatch = computed(() => ({
    _id: '',
    team1: seriesResult.value.team1Wins || seriesResult.value.team2Wins ? scoredTeam(props.team1, seriesResult.value.team1Wins) : props.team1,
    team2: seriesResult.value.team1Wins || seriesResult.value.team2Wins ? scoredTeam(props.team2, seriesResult.value.team2Wins) : props.team2,
}) as Match);

const expanded = ref(false);
const toggleExpanded = () => {
    expanded.value = !expanded.value;
};
</script>

<style scoped>
.ff-series {
    width: 100%;
}

.ff-series-header {
    cursor: pointer;
}

.ff-match {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 5px 8px;
    border: 1px solid var(--bp-border);
    border-radius: 4px;
}

.ff-teams {
    flex: 1;
    min-width: 0;
}

.ff-team {
    display: flex;
    align-items: center;
    min-height: 26px;
    color: var(--main-color);
    font-size: 13px;
}

.ff-team + .ff-team {
    color: var(--secondary-color);
}

.ff-team--loose {
    color: var(--loose-gray) !important;
}

.ff-avatar {
    width: 30px;
    height: 30px;
    min-width: 30px;
    margin-right: 8px;
}

.ff-team-name {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ff-team-score {
    width: 28px;
    min-width: 28px;
    padding: 3px 5px;
    margin-left: 6px;
    background: var(--main-color);
    color: white;
    text-align: center;
    font-size: 12px;
}

.ff-team-score--second {
    background: var(--secondary-color);
}

.ff-team--loose .ff-team-score {
    background: var(--loose-gray);
}

.ff-vs {
    padding: 5px 8px;
    color: gray;
    font-size: 11px;
    font-style: italic;
}

/* ── Ausgeklappte Spiele ── */
.ff-series-games {
    margin-top: 6px;
    padding-left: 10px;
    border-left: 2px solid var(--bp-border);
}
.ff-series-game {
    margin-bottom: 6px;
}
.ff-series-game:last-child {
    margin-bottom: 0;
}
.ff-series-game-title {
    font-size: 11px;
    color: var(--secondary-color);
    margin-bottom: 2px;
}

@media (width <= 900px) {
    .ff-team {
        font-size: 11px;
    }
    .ff-avatar {
        min-width: 30px;
        min-height: 30px;
    }
}
</style>
