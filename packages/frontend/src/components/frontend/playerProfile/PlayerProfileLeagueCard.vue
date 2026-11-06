<template>
    <div class="pp-card pp-league">
        <router-link :to="getLeaguePath(latest)" class="pp-league-team">
            <Avatar :name="latest.teamName" :avatarImage="teamLogo" shape="square" :lazy="false" class="pp-league-logo"/>
            <div class="min-w-0 flex-1">
                <div class="pp-league-hint">Spielt in der BiPo League für</div>
                <div class="pp-league-name">{{ latest.teamName }}</div>
            </div>
            <i class="pi pi-chevron-right pp-league-chevron"></i>
        </router-link>

        <router-link
            v-for="standing in standings"
            :key="`${standing.seasonSlug}-${standing.league}`"
            :to="getLeaguePath(standing)"
            class="pp-league-row"
        >
            <span class="pp-league-season">{{ standing.seasonLabel }}</span>
            <span class="pp-league-placement">
                {{ standing.divisionLabel }} ·
                <b v-if="standing.placement">Platz {{ standing.placement }}</b>
                <template v-else>noch kein Spiel</template>
            </span>
            <span v-if="standing.champion" class="pp-league-tag pp-league-tag--champion">Meister</span>
            <span v-else-if="standing.seasonSlug === CURRENT_SEASON_SLUG" class="pp-league-tag">läuft</span>
            <i class="pi pi-chevron-right pp-league-chevron"></i>
        </router-link>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import { CURRENT_SEASON_SLUG } from '@/components/frontend/league/LeagueSeasonsData';
import { getLeagueTeamLogo } from '@/components/frontend/league/LeaguePlayersData';

// Neueste Saison zuerst
const props = defineProps<{ standings: LeagueStanding[] }>();

const latest = computed(() => props.standings[0]);
const teamLogo = computed(() => getLeagueTeamLogo(latest.value.teamName, latest.value.seasonSlug));

const getLeaguePath = (standing: LeagueStanding) => `/League/${standing.seasonSlug}/${standing.league}`;
</script>

<style scoped>
.pp-league {
    margin-top: 12px;
    overflow: hidden;
}

.pp-league-team,
.pp-league-row {
    display: flex;
    align-items: center;
    gap: 12px;
    color: inherit;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
}
.pp-league-team:hover,
.pp-league-row:hover {
    background: var(--bp-surface-soft);
}

.pp-league-team {
    padding: 12px 14px;
}
.pp-league-logo {
    --avatar-background: var(--bp-fill);
    --avatar-color: var(--bp-text);
    flex-shrink: 0;
    width: 40px !important;
    height: 40px !important;
    border-radius: 10px;
    font-size: 14px !important;
    font-weight: 700;
}
.pp-league-hint {
    font-size: 12px;
    color: var(--bp-text-muted);
}
.pp-league-name {
    font-size: 16px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pp-league-row {
    padding: 11px 14px;
    border-top: 1px solid var(--bp-border);
    font-size: 14px;
}
.pp-league-season {
    flex-shrink: 0;
    width: 56px;
    font-size: 13px;
    font-weight: 700;
    color: var(--bp-text-muted);
}
.pp-league-placement {
    flex: 1;
    min-width: 0;
}
.pp-league-tag {
    flex-shrink: 0;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--bp-fill);
    color: var(--bp-text-muted);
    font-size: 11px;
    font-weight: 700;
}
.pp-league-tag--champion {
    background: var(--bp-gold-weak);
    color: var(--bp-gold);
}
.pp-league-chevron {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--bp-text-faint);
}
</style>
