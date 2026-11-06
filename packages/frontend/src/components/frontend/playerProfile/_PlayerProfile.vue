<template>
    <div class="PlayerProfile">
        <PlayerProfileView
            v-if="profileData"
            :profileData="profileData"
            :avatarKey="avatarKey"
            v-model:trendPeriod="trendPeriod"
            @back="goBack"
            @editImage="showImageUpload = true"
        />

        <!-- Skelett, bis die Spiele geladen sind: Name steht schon in der URL -->
        <div v-else-if="isLoading" class="pp-skeleton" aria-busy="true">
            <div class="pp-hero">
                <button type="button" class="pp-back-button" aria-label="Zurück" @click="goBack">
                    <i class="pi pi-chevron-left"></i>
                </button>
                <Avatar :name="normalizedPlayerName" class="pp-hero-avatar"/>
                <div>
                    <div class="pp-hero-name">{{ normalizedPlayerName }}</div>
                    <div class="bp-skeleton pp-skeleton-line" style="width: 140px"></div>
                </div>
            </div>
            <div class="bp-skeleton pp-skeleton-block" style="height: 92px"></div>
            <div class="bp-skeleton pp-skeleton-block" style="height: 120px"></div>
            <div class="bp-skeleton pp-skeleton-block" style="height: 220px"></div>
        </div>

        <div v-else>
            <button type="button" class="pp-back-button" aria-label="Zurück" @click="goBack">
                <i class="pi pi-chevron-left"></i>
            </button>
            <div class="pp-empty">
                <i class="pi" :class="hasError ? 'pi-wifi' : 'pi-user'"></i>
                <div v-if="hasError">Das Profil konnte nicht geladen werden.</div>
                <div v-else>Für „{{ normalizedPlayerName }}“ gibt es noch keine Spiele.</div>
            </div>
        </div>

        <PlayerProfileImageUpload
            v-if="profileData"
            :playerName="profileData.name"
            v-model:visible="showImageUpload"
            @uploaded="onImageUploaded"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PlayerProfileView from './PlayerProfileView.vue';
import PlayerProfileImageUpload from './PlayerProfileImageUpload.vue';
import Avatar from '@/components/shared/Avatar.vue';
import { usePlayerProfileData } from './usePlayerProfileData';
import { fetchPlayerProfileImage } from './PlayerProfileImageMapping';
import { LEAGUE_PLAYER_DATA, getPlayerForLeagueTeam } from '@/components/frontend/league/LeaguePlayersData';
import { getPlayerProfilePath } from '@/util/util';

const route = useRoute();
const router = useRouter();

const urlName = computed(() => decodeURIComponent(route.params.PlayerName as string));
// "-" steht in der URL fuer Leerzeichen, Liga-Teamnamen koennen aber selbst "-" enthalten ("SallyWin All-in")
const urlLeagueTeam = computed(() => {
    const path = getPlayerProfilePath(urlName.value).toLowerCase();
    return LEAGUE_PLAYER_DATA.find(entry => getPlayerProfilePath(entry.teamName).toLowerCase() === path);
});
const playerName = computed(() => urlLeagueTeam.value?.teamName ?? urlName.value.replaceAll('-', ' '));
const normalizedPlayerName = computed(() => getPlayerForLeagueTeam(playerName.value) ?? playerName.value);
const { isLoading, hasError, profileData, trendPeriod } = usePlayerProfileData(normalizedPlayerName);

const showImageUpload = ref(false);
const avatarKey = ref(0);

// Neues Bild aus dem Backend holen und Avatare neu rendern
const onImageUploaded = () => {
    fetchPlayerProfileImage(normalizedPlayerName.value).then(() => avatarKey.value++);
};

// Ohne Vorgaengerseite (direkt aufgerufener Link) geht es zur Startseite
const goBack = () => {
    if (window.history.state?.back) router.back();
    else router.push('/');
};

// Liga-Teamnamen in der URL auf den Spieler umleiten
watch(playerName, (name) => {
    const mappedName = getPlayerForLeagueTeam(name);
    if (mappedName && route.path !== getPlayerProfilePath(mappedName)) {
        router.replace(getPlayerProfilePath(mappedName));
        return;
    }
    document.title = `${normalizedPlayerName.value} - Weck BiPo Open`;
}, { immediate: true });
</script>

<style scoped>
.PlayerProfile {
    max-width: 720px;
    margin: 0 auto;
    padding-top: 8px;
    color: var(--bp-text-strong);
}

/* ── Laden ── */
.pp-skeleton-line {
    height: 12px;
    margin-top: 8px;
    border-radius: 6px;
}
.pp-skeleton-block {
    margin-bottom: 14px;
}

.pp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 60px 14px;
    text-align: center;
    font-size: 14px;
    color: var(--bp-text-muted);

    .pi {
        font-size: 28px;
        color: var(--bp-text-faint);
    }
}
</style>

<!-- Gemeinsame Bausteine aller Profil-Abschnitte (ungescoped, Praefix pp-) -->
<style>
.PlayerProfile .pp-back-button {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-left: -8px;
    margin-right: -6px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--bp-text-strong);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    .pi {
        font-size: 16px;
    }
}
.PlayerProfile .pp-back-button:hover {
    background: var(--bp-fill-soft);
}

.PlayerProfile .pp-hero {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
}
.PlayerProfile .pp-hero-avatar {
    flex-shrink: 0;
    width: 64px !important;
    height: 64px !important;
    font-size: 22px !important;
}
.PlayerProfile .pp-hero-name {
    font-size: 26px;
    font-weight: 800;
    line-height: 1.15;
    overflow-wrap: anywhere;
}
.PlayerProfile .pp-hero-meta {
    margin-top: 3px;
    font-size: 13px;
    color: var(--bp-text-muted);
}

.PlayerProfile .pp-section {
    margin-top: 26px;
}
.PlayerProfile .pp-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
}
.PlayerProfile .pp-section-title {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.PlayerProfile .pp-section-aside {
    font-size: 13px;
    color: var(--bp-text-muted);
}

.PlayerProfile .pp-card {
    background: var(--bp-surface);
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.PlayerProfile .pp-card + .pp-card {
    margin-top: 10px;
}

.PlayerProfile .pp-sublabel {
    margin: 14px 0 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bp-text-muted);
}

.PlayerProfile .pp-win { color: var(--bp-success); }
.PlayerProfile .pp-loss { color: var(--bp-danger); }
</style>
