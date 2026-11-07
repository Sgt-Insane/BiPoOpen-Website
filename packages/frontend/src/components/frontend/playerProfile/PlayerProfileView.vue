<template>
    <div class="pp-view">
        <!-- Kopf -->
        <div class="pp-hero">
            <button type="button" class="pp-back-button" aria-label="Zurück" @click="emit('back')">
                <i class="pi pi-chevron-left"></i>
            </button>
            <button type="button" class="pp-avatar-button" aria-label="Profilbild ändern" @click="emit('editImage')">
                <Avatar :key="avatarKey" :name="profileData.name" :lazy="false" class="pp-hero-avatar"/>
                <span class="pp-avatar-edit" aria-hidden="true"><i class="pi pi-pencil"></i></span>
            </button>
            <div class="min-w-0">
                <h1 class="pp-hero-name">{{ profileData.name }}</h1>
                <div class="pp-hero-meta">{{ heroMeta }}</div>
            </div>
            <PlayerProfileFollowButton :playerName="profileData.name"/>
        </div>

        <PlayerProfileEloCard v-if="profileData.elo" :elo="profileData.elo"/>

        <PlayerProfileLeagueCard v-if="profileData.leagueStandings.length" :standings="profileData.leagueStandings"/>

        <PlayerProfileAchievements v-if="profileData.badges.length" :badges="profileData.badges" :playerName="profileData.name"/>

        <PlayerProfileActivity v-if="profileData.firstGameTime" :matchHistory="profileData.allMatchHistory"/>

        <PlayerProfileKnechtCard v-if="profileData.knecht" :stats="profileData.knecht"/>

        <!-- Statistik je Spielart -->
        <section class="pp-section">
            <div class="pp-section-head">
                <h2 class="pp-section-title">Statistik</h2>
                <Select
                    v-model="trendPeriod"
                    :options="trendPeriodOptions"
                    optionLabel="label"
                    optionValue="value"
                    size="small"
                    class="pp-period-select"
                />
            </div>

            <div class="pp-segmented" role="tablist">
                <button
                    v-for="option in gameTypeOptions"
                    :key="option.value"
                    type="button"
                    role="tab"
                    :aria-selected="gameType === option.value"
                    :class="{ 'is-active': gameType === option.value }"
                    @click="gameType = option.value"
                >{{ option.label }}</button>
            </div>

            <PlayerProfileStats v-if="gameTypeData.totalMatches > 0" :data="gameTypeData"/>
            <div v-else class="pp-card pp-no-games">
                Keine {{ gameType === '1v1' ? '1 vs 1' : '2 vs 2' }} Spiele {{ trendPeriod === 'all' ? 'vorhanden' : 'im gewählten Zeitraum' }}
            </div>
        </section>

        <PlayerProfilePeers
            v-if="gameTypeData.totalMatches > 0"
            :partners="gameTypeData.partners"
            :rivals="gameTypeData.rivals"
            :isDouble="gameType === '2v2'"
        />

        <PlayerProfileHistory :matchHistory="profileData.matchHistory"/>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Select from 'primevue/select';
import Avatar from '@/components/shared/Avatar.vue';
import PlayerProfileEloCard from './PlayerProfileEloCard.vue';
import PlayerProfileLeagueCard from './PlayerProfileLeagueCard.vue';
import PlayerProfileAchievements from './PlayerProfileAchievements.vue';
import PlayerProfileActivity from './PlayerProfileActivity.vue';
import PlayerProfileKnechtCard from './PlayerProfileKnechtCard.vue';
import PlayerProfileStats from './PlayerProfileStats.vue';
import PlayerProfilePeers from './PlayerProfilePeers.vue';
import PlayerProfileHistory from './PlayerProfileHistory.vue';
import PlayerProfileFollowButton from './PlayerProfileFollowButton.vue';
import { PROFILE_GAME_TYPE_SOURCES, filterProfileDataByGameType } from './PlayerProfileUtilFunctions';
import { trendPeriodOptions } from './usePlayerProfileData';

type GameType = '1v1' | '2v2';

const props = defineProps<{
    profileData: PlayerProfileData;
    avatarKey: number;
}>();

const emit = defineEmits<{ back: []; editImage: [] }>();

const trendPeriod = defineModel<TrendPeriod>('trendPeriod', { required: true });

const gameTypeOptions: { value: GameType; label: string }[] = [
    { value: '1v1', label: '1 vs 1' },
    { value: '2v2', label: '2 vs 2' },
];

// Standard Doppel, ausser der Spieler hat nur Einzel gespielt
const hasDoubles = props.profileData.matchHistory.some(entry => PROFILE_GAME_TYPE_SOURCES['2v2'].includes(entry.source));
const gameType = ref<GameType>(hasDoubles ? '2v2' : '1v1');

const gameTypeData = computed(() => filterProfileDataByGameType(props.profileData, gameType.value));

const heroMeta = computed(() => {
    const parts = [];
    if (props.profileData.firstGameTime) parts.push(`dabei seit ${new Date(props.profileData.firstGameTime).getFullYear()}`);
    parts.push(`${props.profileData.allTimeMatches.toLocaleString('de-DE')} Spiele`);
    return parts.join(' · ');
});
</script>

<style scoped>
.pp-avatar-button {
    position: relative;
    flex-shrink: 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.pp-avatar-edit {
    position: absolute;
    right: -2px;
    bottom: -2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid var(--bp-border);
    border-radius: 50%;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);

    i {
        font-size: 11px;
    }
}
.pp-hero-name {
    margin: 0;
}

.pp-period-select {
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
}

.pp-segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    margin-bottom: 10px;
    border-radius: 12px;
    background: var(--bp-fill);

    button {
        padding: 8px 0;
        border: none;
        border-radius: 9px;
        background: transparent;
        color: var(--bp-text-muted);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }
    button.is-active {
        background: var(--bp-surface);
        color: var(--bp-text-strong);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
}

.pp-no-games {
    padding: 30px 14px;
    text-align: center;
    font-size: 14px;
    color: var(--bp-text-muted);
}
</style>
