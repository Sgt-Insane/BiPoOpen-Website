<template>
    <HeroSlideLayout
        :kicker="`Offene Spiele · ${monthName}`"
        :title="title"
        ctaLabel="Zur Weltrangliste"
        ctaTo="/Weltrangliste"
    >
        <div v-if="topPlayers.length" class="so-content">
            <div class="so-caption">Beste Siegquote · ab {{ MIN_GAMES + 1 }} Spielen</div>
            <div class="so-tiles">
                <button v-for="player in topPlayers" :key="player.name" type="button" class="so-tile" @click="openPlayerProfile?.(player.name)">
                    <span class="so-rate">{{ player.winrate }} %</span>
                    <span class="so-name" v-fit-text>{{ player.name }}</span>
                    <span class="so-games">{{ player.matches }} Spiele</span>
                </button>
            </div>
        </div>
    </HeroSlideLayout>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { getMatchScore } from '@/util/tournamentMatchFunctions';
import { formatPlayerName } from '../homeUtil';
import HeroSlideLayout from './HeroSlideLayout.vue';

const props = defineProps<{
    // Offene Spiele eines Monats (siehe getLatestOpenGamesMonth)
    games: Match[];
    monthStart: number;
    isCurrentMonth: boolean;
}>();

const openPlayerProfile = inject<(name: string) => void>('openPlayerProfile');

// Nur wer im Monat mehr als so viele Spiele gemacht hat, kommt in die Siegquote.
const MIN_GAMES = 3;

const monthName = computed(() => new Date(props.monthStart).toLocaleDateString('de-DE', { month: 'long' }));

const title = computed(() => {
    const count = props.games.length;
    const games = count === 1 ? 'Spiel' : 'Spiele';
    return props.isCurrentMonth
        ? `${count} ${games} diesen Monat`
        : `${count} ${games} im ${monthName.value}`;
});

const topPlayers = computed(() => {
    const stats = new Map<string, { name: string; matches: number; wins: number }>();

    props.games.forEach((match) => {
        const score1 = getMatchScore(match, true);
        const score2 = getMatchScore(match, false);
        if (score1 === undefined || score2 === undefined) return;

        const addPlayers = (team: Team, won: boolean) => team.players.forEach((player) => {
            const name = formatPlayerName(player.name);
            const entry = stats.get(name) ?? { name, matches: 0, wins: 0 };
            entry.matches++;
            if (won) entry.wins++;
            stats.set(name, entry);
        });
        addPlayers(match.team1, score1 > score2);
        addPlayers(match.team2, score2 > score1);
    });

    return [...stats.values()]
        .filter(player => player.matches > MIN_GAMES)
        .map(player => ({ ...player, winrate: Math.round(player.wins / player.matches * 100) }))
        .sort((a, b) => b.winrate - a.winrate || b.wins - a.wins || b.matches - a.matches)
        .slice(0, 3);
});
</script>

<style scoped>
.so-content{
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 480px;
}
.so-caption{
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.75);
}
.so-tiles{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}
.so-tile{
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    padding: 10px 6px;
    background: var(--hs-glass);
    border: 1px solid var(--hs-glass-border);
    border-radius: 12px;
    color: white;
    cursor: pointer;
    transition: background 0.2s;
}
.so-tile:hover{
    background: rgba(255, 255, 255, 0.22);
}
.so-rate{
    font-size: 20px;
    font-weight: 800;
    line-height: 1.2;
}
.so-name{
    max-width: 100%;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    color: rgba(255, 255, 255, 0.85);
}
.so-games{
    font-size: 11px;
    color: rgba(255, 255, 255, 0.65);
}
</style>
