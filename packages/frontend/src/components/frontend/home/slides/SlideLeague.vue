<template>
    <HeroSlideLayout
        :kicker="`BiPo League · ${division.label}`"
        :title="title"
        ctaLabel="Zur Tabelle"
        :ctaTo="`/League/${seasonSlug}/${division.league}`"
    >
        <ol class="sl-table">
            <li v-for="team in topTeams" :key="team.name" class="sl-row">
                <span class="sl-place">{{ team.placement! + 1 }}</span>
                <img v-if="logos[team.name]" class="sl-logo" :src="logos[team.name]" alt="">
                <span class="sl-name">{{ team.name }}</span>
                <span class="sl-record">{{ team.wins }}–{{ team.looses }} · {{ formatDiff(team.hitDifferenceNumber) }}</span>
            </li>
        </ol>
    </HeroSlideLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getLeagueList } from '@/components/frontend/league/LeagueUtilFunctions';
import { toLeaguePlayers, type LeagueDivision } from '@/components/frontend/league/LeagueSeasonsData';
import HeroSlideLayout from './HeroSlideLayout.vue';

const props = defineProps<{
    // Bereits auf Saison und Liga gefiltert
    games: Match[];
    division: LeagueDivision;
    seasonSlug: string;
}>();

const leaguePlayers = computed(() => toLeaguePlayers(props.division.teams));
const logos = computed(() => Object.fromEntries(leaguePlayers.value.map(player => [player.name, player.logo])));

const topTeams = computed(() => getLeagueList(props.games, leaguePlayers.value).slice(0, 3));

const title = computed(() => {
    const [first, second] = topTeams.value;
    if (second && second.placement === first.placement)
        return 'Kopf-an-Kopf an der Spitze';
    return `${first.name} führt`;
});

const formatDiff = (diff: number) => (diff > 0 ? `+${diff}` : `${diff}`);
</script>

<style scoped>
.sl-table{
    list-style: none;
    margin: 0;
    padding: 0;
    max-width: 480px;
    background: var(--hs-glass);
    border: 1px solid var(--hs-glass-border);
    border-radius: 12px;
    overflow: hidden;
}
.sl-row{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    font-size: 14px;
}
.sl-row + .sl-row{
    border-top: 1px solid var(--hs-glass-border);
}
.sl-place{
    width: 14px;
    font-weight: 800;
}
.sl-logo{
    width: 22px;
    height: 22px;
    object-fit: contain;
    flex-shrink: 0;
}
.sl-name{
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.sl-record{
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.85);
}
</style>
