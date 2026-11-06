<template>
    <component
        :is="isClickable ? 'button' : 'div'"
        :type="isClickable ? 'button' : undefined"
        class="ffc-card"
        :class="{ 'ffc-card--clickable': isClickable, 'ffc-card--champion': highlightWinner && result.winner }"
        @click="isClickable && emit('open')"
    >
        <div
            v-for="row in rows"
            :key="row.placeholder"
            class="ffc-team"
            :class="{ 'ffc-team--win': row.isWinner, 'ffc-team--loose': row.isLoser, 'ffc-team--placeholder': !row.team }"
        >
            <Avatar
                v-if="row.team"
                :name="row.name"
                :avatarImage="row.team.logo"
                shape="square"
                :grayscale="row.isLoser"
                class="ffc-avatar !w-[24px] !h-[24px] !min-w-[24px] !text-[9px]"
            />
            <span class="ffc-team-name">{{ row.name }}</span>
            <span v-if="hasGames" class="ffc-team-score">{{ row.wins }}</span>
        </div>

        <div class="ffc-footer">
            <template v-if="hasGames">
                {{ result.games.length }} {{ result.games.length === 1 ? 'Spiel' : 'Spiele' }}
                <i class="pi pi-chevron-right"></i>
            </template>
            <template v-else>Best of 3</template>
        </div>
    </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import { getSeriesTeamName, SeriesResult } from './LeagueUtilFunctions';

const props = defineProps({
    team1: { type: Object as () => Team | undefined, default: undefined },
    team2: { type: Object as () => Team | undefined, default: undefined },
    team1Placeholder: { type: String, required: true },
    team2Placeholder: { type: String, required: true },
    result: { type: Object as () => SeriesResult, required: true },
    // Finale: Sieger-Karte golden umranden
    highlightWinner: { type: Boolean, default: false },
});

const emit = defineEmits<{ open: [] }>();

const isClickable = computed(() => !!props.team1 && !!props.team2);
const hasGames = computed(() => props.result.games.length > 0);

const rows = computed(() => [
    { team: props.team1, placeholder: props.team1Placeholder, wins: props.result.team1Wins },
    { team: props.team2, placeholder: props.team2Placeholder, wins: props.result.team2Wins },
].map(row => ({
    ...row,
    name: getSeriesTeamName(row.team, row.placeholder),
    isWinner: !!row.team && props.result.winner === row.team,
    isLoser: !!row.team && props.result.loser === row.team,
})));
</script>

<style scoped>
.ffc-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 4px 8px 0;
    background: var(--bp-surface);
    border: 1px solid var(--bp-border);
    border-radius: 10px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    font: inherit;
    text-align: left;
    color: inherit;
}
.ffc-card--clickable {
    cursor: pointer;
    transition: border-color .2s ease;
}
.ffc-card--clickable:hover {
    border-color: var(--bp-border-strong);
}
.ffc-card--clickable:focus-visible {
    outline: 2px solid var(--main-color);
    outline-offset: 2px;
}
.ffc-card--champion {
    border: 1.5px solid #e2b93b;
    box-shadow: 0 2px 10px rgba(226, 185, 59, 0.25);
}

.ffc-team {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    font-size: 13px;
    color: var(--bp-text);
    /* graue Initialen statt roter Avatare */
    --avatar-background: var(--bp-fill);
    --avatar-color: var(--bp-text-muted);
}
.ffc-team-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ffc-team--win .ffc-team-name {
    font-weight: 700;
    color: var(--bp-text-strong);
}
.ffc-team--loose .ffc-team-name {
    color: var(--bp-text-subtle);
}
.ffc-team--placeholder .ffc-team-name {
    color: var(--bp-text-subtle);
    font-style: italic;
    font-size: 12px;
}

/* Siege in der Serie: Sieger rot, sonst neutral grau */
.ffc-team-score {
    min-width: 22px;
    height: 22px;
    padding: 0 5px;
    border-radius: 6px;
    background: var(--bp-fill);
    color: var(--bp-text-strong);
    font-size: 13px;
    font-weight: 600;
    line-height: 22px;
    text-align: center;
    flex-shrink: 0;
}
.ffc-team--win .ffc-team-score {
    background: var(--main-color);
    color: white;
    font-weight: 700;
}

.ffc-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin: 2px -8px 0;
    padding: 5px 0;
    border-top: 1px solid var(--bp-border);
    font-size: 11px;
    color: var(--bp-text-subtle);
}
.ffc-footer .pi {
    font-size: 9px;
}
</style>
