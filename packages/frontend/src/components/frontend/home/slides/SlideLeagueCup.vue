<template>
    <HeroSlideLayout
        :kicker="`League Cup · ${round.name}`"
        :title="title"
        ctaLabel="Zum Cup"
        :ctaTo="`/League/${leagueCup.season}/${CUP_URL_SEGMENT}`"
    >
        <div class="sc-content">
            <div v-if="!winner" class="sc-progress">
                <div class="sc-progress-fill" :style="{ width: `${decidedCount / round.pairings.length * 100}%` }"></div>
            </div>

            <div v-if="lastGame" class="sc-last">
                <div class="sc-last-label">Zuletzt</div>
                <div class="sc-last-result">
                    <span :class="{ 'sc-winner': lastGame.team1Won }">{{ lastGame.team1 }}</span>
                    {{ lastGame.score1 }} : {{ lastGame.score2 }}
                    <span :class="{ 'sc-winner': !lastGame.team1Won }">{{ lastGame.team2 }}</span>
                </div>
            </div>
        </div>
    </HeroSlideLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CUP_URL_SEGMENT, getCupRoundGames, getCupWinner, getPairingResult } from '@/components/frontend/league/cup/LeagueCupUtilFunctions';
import { getMatchScore } from '@/util/tournamentMatchFunctions';
import { getTeamDisplayName } from '@/util/tournamentFunctions';
import HeroSlideLayout from './HeroSlideLayout.vue';

const props = defineProps<{
    // Nur Cups mit mindestens einer Runde
    leagueCup: LeagueCup;
    cupGames: Match[];
}>();

const roundIndex = computed(() => props.leagueCup.rounds.length - 1);
const round = computed(() => props.leagueCup.rounds[roundIndex.value]);

const decidedCount = computed(() => {
    const roundGames = getCupRoundGames(props.cupGames, roundIndex.value);
    return round.value.pairings
        .filter(pairing => getPairingResult(pairing, roundGames, round.value.bestOf).winner)
        .length;
});

const winner = computed(() => getCupWinner(props.leagueCup, props.cupGames));

const title = computed(() => {
    if (winner.value)
        return `${winner.value} holt den Cup`;

    const total = round.value.pairings.length;
    return round.value.bestOf === 1
        ? `${decidedCount.value} von ${total} Spielen gespielt`
        : `${decidedCount.value} von ${total} Duellen entschieden`;
});

const lastGame = computed(() => {
    const finishedGames = props.cupGames
        .map(match => ({ match, score1: getMatchScore(match, true), score2: getMatchScore(match, false) }))
        .filter(entry => entry.score1 !== undefined && entry.score2 !== undefined)
        .sort((a, b) => (b.match.time ?? 0) - (a.match.time ?? 0));

    const latest = finishedGames[0];
    if (!latest) return undefined;

    return {
        team1: getTeamDisplayName(latest.match.team1),
        team2: getTeamDisplayName(latest.match.team2),
        score1: latest.score1 as number,
        score2: latest.score2 as number,
        team1Won: (latest.score1 as number) > (latest.score2 as number),
    };
});
</script>

<style scoped>
.sc-content{
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 480px;
}
.sc-progress{
    height: 6px;
    background: rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    overflow: hidden;
}
.sc-progress-fill{
    height: 100%;
    background: var(--bp-surface);
    border-radius: 999px;
    transition: width 0.6s ease;
}
.sc-last{
    padding: 10px 12px;
    background: var(--hs-glass);
    border: 1px solid var(--hs-glass-border);
    border-radius: 12px;
}
.sc-last-label{
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.75);
    margin-bottom: 2px;
}
.sc-last-result{
    font-size: 14px;
    line-height: 1.35;
}
.sc-winner{
    font-weight: 800;
}
</style>
