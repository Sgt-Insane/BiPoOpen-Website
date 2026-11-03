<template>
    <BottomSheet v-model:visible="visible" fit>
        <template #header>
            <div v-if="team1 && team2">
                <div class="ffs-round">{{ title }}</div>
                <div class="ffs-headline">{{ headline }}</div>
            </div>
        </template>

        <div v-if="team1 && team2">
            <div class="ffs-card">
                <div class="ffs-row ffs-row--head">
                    <span></span>
                    <span v-for="gameNumber in BEST_OF" :key="gameNumber" class="ffs-cell">{{ gameNumber }}</span>
                    <span class="ffs-cell ffs-cell--series">Serie</span>
                </div>

                <div
                    v-for="row in rows"
                    :key="row.name"
                    class="ffs-row"
                    :class="{ 'ffs-row--win': row.isWinner, 'ffs-row--loose': row.isLoser }"
                >
                    <span class="ffs-team">
                        <Avatar
                            :name="row.name"
                            :avatarImage="row.team.logo"
                            shape="square"
                            :grayscale="row.isLoser"
                            class="!w-[26px] !h-[26px] !min-w-[26px] !text-[10px]"
                        />
                        <span class="ffs-team-name">{{ row.name }}</span>
                    </span>
                    <span
                        v-for="(score, index) in row.scores"
                        :key="index"
                        class="ffs-cell"
                        :class="{ 'ffs-cell--game-win': score.isWin }"
                    >{{ score.label }}</span>
                    <span class="ffs-cell ffs-cell--series">
                        <span class="ffs-series-score">{{ row.wins }}</span>
                    </span>
                </div>
            </div>

            <div class="ffs-meta">
                <template v-if="lastGameDate">{{ lastGameDate }} · </template>Best of {{ BEST_OF }}
            </div>
        </div>
    </BottomSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import Avatar from '@/components/shared/Avatar.vue';
import { getSeriesGameScores, getSeriesTeamName, SeriesResult } from './LeagueUtilFunctions';

const BEST_OF = 3;

const visible = defineModel<boolean>('visible', { default: false });

const props = defineProps({
    title: { type: String, required: true },
    team1: { type: Object as () => Team | undefined, default: undefined },
    team2: { type: Object as () => Team | undefined, default: undefined },
    result: { type: Object as () => SeriesResult, required: true },
});

const team1Name = computed(() => getSeriesTeamName(props.team1, ''));
const team2Name = computed(() => getSeriesTeamName(props.team2, ''));

const headline = computed(() => {
    const { winner, team1Wins, team2Wins, games } = props.result;
    if (winner)
        return `${getSeriesTeamName(winner, '')} gewinnt ${Math.max(team1Wins, team2Wins)} : ${Math.min(team1Wins, team2Wins)}`;
    if (!games.length)
        return 'Noch nicht gespielt';
    return `Stand ${team1Wins} : ${team2Wins}`;
});

// 10.5 -> "10,5"
const formatScore = (score: number) => score.toLocaleString('de-DE');

const gameScores = computed(() =>
    props.team1 ? props.result.games.map(match => getSeriesGameScores(match, props.team1!)) : []
);

const getRowScores = (isTeam1: boolean) => Array.from({ length: BEST_OF }, (_, index) => {
    const scores = gameScores.value[index];
    if (!scores)
        return { label: '', isWin: false };

    const own = isTeam1 ? scores.team1Score : scores.team2Score;
    const opponent = isTeam1 ? scores.team2Score : scores.team1Score;
    return { label: formatScore(own), isWin: own > opponent };
});

const rows = computed(() => !props.team1 || !props.team2 ? [] : [
    { team: props.team1, name: team1Name.value, wins: props.result.team1Wins, scores: getRowScores(true) },
    { team: props.team2, name: team2Name.value, wins: props.result.team2Wins, scores: getRowScores(false) },
].map(row => ({
    ...row,
    isWinner: props.result.winner === row.team,
    isLoser: props.result.loser === row.team,
})));

// "Sa, 12.09.2026": Tag des letzten Spiels der Serie
const lastGameDate = computed(() => {
    const times = props.result.games.map(match => match.time).filter((time): time is number => !!time);
    if (!times.length)
        return '';

    const date = new Date(Math.max(...times));
    const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
    const day = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${weekday}, ${day}`;
});
</script>

<style scoped>
.ffs-round {
    font-size: 12px;
    font-weight: 700;
    color: var(--main-color);
}
.ffs-headline {
    font-size: 18px;
    font-weight: 800;
    color: #1f2328;
    line-height: 1.25;
}

.ffs-card {
    padding: 4px 12px;
    background: white;
    border: 1px solid #ECEEF1;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.ffs-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(3, 40px) 48px;
    align-items: center;
    min-height: 44px;
    font-size: 14px;
    color: #8a9099;
}
.ffs-row + .ffs-row {
    border-top: 1px solid #ECEEF1;
}
.ffs-row--head {
    min-height: 28px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #8a9099;
}

.ffs-team {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    /* graue Initialen statt roter Avatare */
    --avatar-background: #EEF0F3;
    --avatar-color: #6B717B;
}
.ffs-team-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #4a5058;
}
.ffs-row--win .ffs-team-name {
    font-weight: 700;
    color: #1f2328;
}
.ffs-row--loose .ffs-team-name {
    color: #8a9099;
}

.ffs-cell {
    text-align: center;
}
.ffs-cell--game-win {
    font-weight: 700;
    color: #1f2328;
}
.ffs-cell--series {
    display: flex;
    justify-content: center;
}

/* Siege in der Serie: Sieger rot, sonst neutral grau */
.ffs-series-score {
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    border-radius: 6px;
    background: #ECEEF1;
    color: #1f2328;
    font-weight: 600;
    line-height: 26px;
    text-align: center;
}
.ffs-row--win .ffs-series-score {
    background: var(--main-color);
    color: white;
    font-weight: 700;
}

.ffs-meta {
    margin-top: 10px;
    font-size: 12px;
    color: #8a9099;
}

@media (width <= 360px) {
    .ffs-row {
        grid-template-columns: minmax(0, 1fr) repeat(3, 34px) 42px;
        font-size: 13px;
    }
}
</style>
