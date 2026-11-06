<template>
    <div class="Notifications">
        <button type="button" class="nt-back" aria-label="Zurück" @click="goBack">
            <i class="pi pi-chevron-left"></i>
        </button>

        <h1 class="nt-title">Benachrichtigungen</h1>
        <p class="nt-subtitle">Push-Benachrichtigungen {{ status === 'active' ? 'verwalten' : 'einrichten' }}</p>

        <div v-if="status === 'loading' || (status === 'active' && !settingsLoaded)" aria-busy="true">
            <div class="bp-skeleton" style="height: 64px"></div>
            <div class="bp-skeleton mt-[24px]" style="height: 260px"></div>
        </div>

        <NotificationsSettings v-else-if="status === 'active'" :highlightCategory="requestedCategory"/>

        <NotificationsIntro
            v-else-if="status === 'inactive'"
            :followNames="requestedFollows"
            :loading="activating"
            @activate="onActivate"
        />

        <NotificationsUnavailable v-else :status="status"/>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useGrayPage } from '@/components/shared/useGrayPage';
import { usePushNotifications, type PushCategory } from '@/components/shared/usePushNotifications';
import NotificationsSettings from './NotificationsSettings.vue';
import NotificationsIntro from './NotificationsIntro.vue';
import NotificationsUnavailable from './NotificationsUnavailable.vue';

// Einstiege von aussen per Query:
// ?folgen=Name1,Name2  (Folgen-Button im Profil, Hinweis nach dem ersten Spiel) -> nach dem Aktivieren gefolgt
// ?kategorie=tournamentResults  (Hinweis auf der Turnierseite) -> Kategorie wird eingeschaltet
const CATEGORIES: PushCategory[] = ['openGames', 'leagueGames', 'tournamentResults'];

useGrayPage();

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { status, settingsLoaded, loadSettings, activate, followPlayer, followToastDetail, setPreference, preferences, allCategoriesOff } = usePushNotifications();

const requestedFollows = computed(() => String(route.query.folgen ?? '').split(',').map(name => name.trim()).filter(Boolean));
const requestedCategory = computed(() => CATEGORIES.find(category => category === route.query.kategorie));

const activating = ref(false);
// Query gilt nur fuer den ersten Durchgang, nicht nach erneutem Aktivieren
let queryHandled = false;

const goBack = () => {
    if (window.history.state?.back) router.back();
    else router.push('/');
};

// Query nur einmal anwenden: ohne Neuaufbau aus der URL entfernen (router-view ist auf fullPath gekeyt)
const clearQuery = () => {
    queryHandled = true;
    const newURL = `${window.location.origin}${route.path}`;
    window.history.replaceState({ ...window.history.state, as: newURL, url: newURL }, '', newURL);
};

const followText = (names: string[]) => names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;

const onActivate = async () => {
    if (activating.value) return;
    activating.value = true;
    // activate() nimmt die Query selbst mit, der Watcher auf status darf sie nicht noch einmal anwenden
    queryHandled = true;
    try {
        const activated = await activate({ follow: requestedFollows.value, category: requestedCategory.value });
        if (activated) {
            const follows = requestedFollows.value;
            toast.add({
                severity: 'success',
                summary: follows.length ? `Du folgst jetzt ${followText(follows)}` : 'Benachrichtigungen aktiv',
                detail: follows.length ? followToastDetail(followText(follows)) : undefined,
                life: follows.length ? 5000 : 3000,
            });
            clearQuery();
        }
    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Aktivieren hat nicht geklappt', detail: 'Bitte versuch es gleich noch einmal.', life: 4000 });
    } finally {
        activating.value = false;
    }
};

// Schon aktiv und ueber einen Einstieg mit Query gekommen: direkt uebernehmen
const applyQueryWhenActive = async () => {
    if (status.value !== 'active' || queryHandled) return;
    await loadSettings();

    const follows = requestedFollows.value;
    const category = requestedCategory.value;
    if (!follows.length && !category) return;

    const wasAllOff = follows.length > 0 && allCategoriesOff.value;
    for (const name of follows) await followPlayer(name);
    if (category && !preferences[category]) await setPreference(category, true);
    if (follows.length) toast.add({
        severity: 'success',
        summary: `Du folgst jetzt ${followText(follows)}`,
        detail: wasAllOff
            ? `Benachrichtigungen sind wieder an. ${followToastDetail(followText(follows))}`
            : followToastDetail(followText(follows)),
        life: wasAllOff ? 6000 : 5000,
    });
    clearQuery();
};

onMounted(() => { loadSettings(); });
watch(status, applyQueryWhenActive, { immediate: true });
</script>

<style scoped>
.Notifications {
    max-width: 560px;
    margin: 0 auto;
    padding-top: 8px;
    color: var(--bp-text-strong);
}

.nt-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-left: -8px;
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
.nt-back:hover {
    background: var(--bp-fill-soft);
}

.nt-title {
    margin: 14px 0 0;
    font-size: 28px;
    font-weight: 800;
    line-height: 1.15;
}
.nt-subtitle {
    margin: 4px 0 20px;
    font-size: 14px;
    color: var(--bp-text-muted);
}

/* Ohne App-Header (route meta detailPage): Abstand zur Statusleiste */
@media (width <= 900px) {
    .Notifications {
        padding-top: calc(10px + env(safe-area-inset-top));
    }
}
</style>

<!-- Gemeinsame Bausteine der Abschnitte (ungescoped, Praefix nt-) -->
<style>
.Notifications .nt-section-title {
    margin: 26px 0 10px;
    font-size: 17px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.Notifications .nt-card {
    overflow: hidden;
    background: var(--bp-surface);
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.Notifications .nt-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 16px;
}
.Notifications .nt-row-title {
    font-size: 15px;
    font-weight: 700;
    line-height: 1.25;
}
.Notifications .nt-row-text {
    margin-top: 2px;
    font-size: 13px;
    line-height: 1.3;
    color: var(--bp-text-muted);
}
</style>
