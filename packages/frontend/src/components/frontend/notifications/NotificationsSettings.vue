<template>
    <div class="NotificationsSettings">
        <!-- Status -->
        <div class="ns-active">
            <span class="nt-icon ns-active-icon"><BellIcon filled/></span>
            <div class="min-w-0 flex-1">
                <div class="ns-active-title">Aktiv auf diesem Gerät</div>
                <div class="ns-active-text">Einstellungen gelten nur hier</div>
            </div>
            <button type="button" class="ns-test" :disabled="testing" @click="onTest">
                {{ testing ? 'Sende …' : 'Test senden' }}
            </button>
        </div>

        <!-- Pop-up laesst sich nur in den Handy-Einstellungen anschalten, daher Anleitung -->
        <button v-if="isMobile" type="button" class="nt-card ns-popup" @click="popupGuideVisible = true">
            <span class="nt-icon ns-popup-icon"><i class="pi pi-mobile"></i></span>
            <div class="min-w-0 flex-1">
                <div class="nt-row-title">Pushes als Pop-up anzeigen</div>
                <div class="nt-row-text">Erscheinen sie nur als Symbol oben? So stellst du es um.</div>
            </div>
            <i class="pi pi-chevron-right ns-popup-chevron"></i>
        </button>
        <NotificationsPopupGuide v-if="isMobile" v-model:visible="popupGuideVisible"/>

        <!-- Kategorien -->
        <h2 class="nt-section-title">Was möchtest du erfahren?</h2>
        <div class="nt-card">
            <div
                v-for="category in categories"
                :key="category.key"
                class="ns-row"
                :class="{ 'ns-row--highlight': category.key === highlightCategory }"
            >
                <div class="ns-row-main">
                    <span class="nt-icon" :style="{ background: category.background, color: category.color }">
                        <i class="pi" :class="category.icon"></i>
                    </span>
                    <div class="min-w-0 flex-1">
                        <div class="nt-row-title">{{ category.title }}</div>
                        <div class="nt-row-text">{{ category.text }}</div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        class="ns-switch"
                        :aria-checked="preferences[category.key]"
                        :aria-label="category.title"
                        @click="setPreference(category.key, !preferences[category.key])"
                    ></button>
                </div>

                <!-- Alle Spiele oder nur gefolgte Spieler -->
                <div v-if="preferences[category.key]" class="ns-segmented" role="radiogroup" :aria-label="`${category.title}: von welchen Spielen?`">
                    <button
                        v-for="option in followModeOptions"
                        :key="option.value"
                        type="button"
                        role="radio"
                        :aria-checked="followModes[category.key] === option.value"
                        :class="{ 'is-active': followModes[category.key] === option.value }"
                        @click="setFollowMode(category.key, option.value)"
                    >{{ option.label }}</button>
                </div>
            </div>
        </div>

        <template v-if="usesFollowedPlayers">
            <h2 class="nt-section-title">Meine Spieler</h2>
            <div class="nt-card ns-follow">
                <div class="ns-search">
                    <i class="pi pi-search ns-search-icon"></i>
                    <input
                        v-model="query"
                        class="ns-search-input"
                        type="search"
                        placeholder="Spieler hinzufügen …"
                        autocomplete="off"
                        enterkeyhint="done"
                        @focus="loadNames"
                        @keydown.enter.prevent="results[0] && addPlayer(results[0])"
                    />
                </div>

                <div v-if="results.length" class="ns-results">
                    <button v-for="name in results" :key="name" type="button" class="ns-result" @click="addPlayer(name)">
                        <Avatar :name="name" shape="circle" class="ns-result-avatar"/>
                        <span class="flex-1 truncate">{{ name }}</span>
                        <i class="pi pi-plus ns-result-add"></i>
                    </button>
                </div>

                <div v-if="followedPlayers.length" class="ns-chips">
                    <span v-for="name in followedPlayers" :key="name" class="ns-chip">
                        <Avatar :name="name" shape="circle" class="ns-chip-avatar"/>
                        <span class="ns-chip-name">{{ name }}</span>
                        <button type="button" class="ns-chip-remove" :aria-label="`${name} entfernen`" @click="unfollowPlayer(name)">
                            <i class="pi pi-times"></i>
                        </button>
                    </span>
                </div>
            </div>
        </template>

        <button type="button" class="ns-deactivate" @click="onDeactivate">
            <i class="pi pi-bell-slash"></i>
            Auf diesem Gerät deaktivieren
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import Avatar from '@/components/shared/Avatar.vue';
import BellIcon from '@/components/shared/BellIcon.vue';
import { usePushNotifications, type PushCategory, type PushFollowMode } from '@/components/shared/usePushNotifications';
import { getAllPlayerNames, getPlayerMatchCounts } from '@/components/frontend/playerProfile/PlayerProfileUtilFunctions';
import NotificationsPopupGuide from './NotificationsPopupGuide.vue';

const MAX_RESULTS = 6;

defineProps<{ highlightCategory?: PushCategory }>();

const toast = useToast();
const { preferences, followModes, usesFollowedPlayers, followedPlayers, setPreference, setFollowMode, isFollowing, followPlayer, unfollowPlayer, sendTest, deactivate } = usePushNotifications();

// Farben wie die Texte je Kategorie im Push-Design
const categories: { key: PushCategory, title: string, text: string, icon: string, background: string, color: string }[] = [
    { key: 'openGames', title: 'Offene Spiele', text: 'Wenn jemand ein offenes Spiel einträgt', icon: 'pi-arrow-up-right', background: 'var(--bp-fill)', color: 'var(--bp-text)' },
    { key: 'leagueGames', title: 'BiPo League & Cup', text: 'Neue Liga- und Cup-Spiele', icon: 'pi-trophy', background: 'var(--secondary-color-weak)', color: 'var(--bp-secondary-text)' },
    { key: 'tournamentResults', title: 'Turnier-Ergebnisse', text: 'Gruppen- und K.o.-Phase beim BiPo Open', icon: 'pi-sitemap', background: 'var(--bp-primary-weak)', color: 'var(--main-color)' },
];

const followModeOptions: { value: PushFollowMode, label: string }[] = [
    { value: 'all', label: 'Alle Spiele' },
    { value: 'followed', label: 'Nur meine Spieler' },
];

// ─── Pop-up-Anleitung ───
const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
const popupGuideVisible = ref(false);

// ─── Test ───
const testing = ref(false);
const onTest = async () => {
    testing.value = true;
    const sent = await sendTest();
    testing.value = false;
    if (!sent) toast.add({ severity: 'error', summary: 'Test nicht gesendet', life: 3000 });
};

// ─── Spielersuche ───
const query = ref('');
const names = ref<string[]>([]);
const matchCounts = ref<Record<string, number>>({});

const loadNames = async () => {
    if (names.value.length) return;
    [names.value, matchCounts.value] = await Promise.all([getAllPlayerNames(), getPlayerMatchCounts()]);
};

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

// Treffer nach Anzahl Spiele, Namensanfang zuerst, ohne bereits gefolgte
const results = computed(() => {
    const search = normalize(query.value);
    if (!search) return [];
    const counts = matchCounts.value;
    return names.value
        .filter(name => normalize(name).includes(search) && !isFollowing(name))
        .sort((name1, name2) =>
            Number(normalize(name2).startsWith(search)) - Number(normalize(name1).startsWith(search)) ||
            (counts[name2] ?? 0) - (counts[name1] ?? 0)
        )
        .slice(0, MAX_RESULTS);
});

const addPlayer = (name: string) => {
    query.value = '';
    followPlayer(name);
};

// ─── Deaktivieren ───
const onDeactivate = async () => {
    await deactivate();
    toast.add({ severity: 'info', summary: 'Benachrichtigungen deaktiviert', life: 3000 });
};
</script>

<style scoped>
/* ─── Status ─── */
.ns-active {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 16px;
    background: var(--bp-success-weak);
}
.ns-active-icon {
    background: #2ea45f;
    color: white;
    font-size: 18px;
}
.ns-active-title {
    font-size: 15px;
    font-weight: 800;
    color: var(--bp-success-strong);
}
.ns-active-text {
    font-size: 13px;
    color: var(--bp-success-strong);
}
.ns-test {
    flex-shrink: 0;
    padding: 9px 14px;
    border: none;
    border-radius: 999px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.ns-test:disabled {
    opacity: .6;
}

/* ─── Pop-up-Anleitung ─── */
.ns-popup {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    margin-top: 12px;
    padding: 12px 14px;
    border: none;
    text-align: left;
    color: var(--bp-text-strong);
}
.ns-popup-icon {
    background: var(--bp-info-weak);
    color: var(--bp-info);
}
.ns-popup-chevron {
    color: var(--bp-text-subtle);
    font-size: 13px;
}

/* ─── Kategorien ─── */
.ns-row {
    padding: 12px 14px;
}
.ns-row-main {
    display: flex;
    align-items: center;
    gap: 12px;
}
.ns-row + .ns-row {
    border-top: 1px solid var(--bp-border);
}
/* Ueber den Turnier-Hinweis gekommen: Kategorie kurz hervorheben */
.ns-row--highlight {
    animation: ns-highlight 2.4s ease-out;
}
@keyframes ns-highlight {
    0%, 40% { background: var(--bp-primary-faint); }
    100% { background: transparent; }
}

.ns-switch {
    position: relative;
    flex-shrink: 0;
    width: 48px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--bp-border-strong);
    transition: background .2s ease;
    -webkit-tap-highlight-color: transparent;
}
.ns-switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--bp-surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform .2s ease;
}
.ns-switch[aria-checked="true"] {
    background: var(--main-color);
}
.ns-switch[aria-checked="true"]::after {
    transform: translateX(20px);
}

/* ─── Alle | Meine Spieler ─── */
.ns-segmented {
    display: flex;
    gap: 4px;
    margin-top: 10px;
    padding: 4px;
    border-radius: 12px;
    background: var(--bp-fill);

    button {
        flex: 1;
        min-height: 34px;
        padding: 6px 10px;
        border: none;
        border-radius: 9px;
        background: transparent;
        color: var(--bp-text-secondary);
        font-size: 13px;
        font-weight: 700;
        line-height: 1.2;
        transition: background .2s ease, color .2s ease;
    }
    button.is-active {
        background: var(--bp-surface);
        color: var(--bp-text-strong);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
}

/* ─── Spieler ─── */
.ns-follow {
    padding: 12px;
}
.ns-search {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 14px;
    border: 1px solid var(--bp-border-strong);
    border-radius: 12px;
}
.ns-search:focus-within {
    border-color: var(--main-color);
}
.ns-search-icon {
    color: var(--bp-text-subtle);
    font-size: 14px;
}
.ns-search-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 15px;
}

.ns-results {
    margin-top: 6px;
}
.ns-result {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 6px;
    border: none;
    border-radius: 10px;
    background: transparent;
    text-align: left;
    font-size: 15px;
    font-weight: 600;
}
.ns-result:hover {
    background: var(--bp-fill-soft);
}
.ns-result-avatar {
    width: 30px !important;
    height: 30px !important;
    font-size: 11px !important;
}
.ns-result-add {
    color: var(--main-color);
    font-size: 13px;
}

.ns-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}
.ns-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 4px 3px 3px;
    border-radius: 999px;
    background: var(--bp-fill);
}
.ns-chip-avatar {
    width: 26px !important;
    height: 26px !important;
    font-size: 10px !important;
}
.ns-chip-name {
    font-size: 14px;
    font-weight: 600;
}
.ns-chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--bp-text-secondary);

    .pi {
        font-size: 11px;
    }
}
.ns-chip-remove:hover {
    background: var(--bp-fill);
}

/* ─── Deaktivieren ─── */
.ns-deactivate {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    margin-top: 28px;
    padding: 12px;
    border: none;
    background: transparent;
    color: var(--bp-text-secondary);
    font-size: 14px;
    font-weight: 700;
}
.ns-deactivate:hover {
    color: var(--bp-text-strong);
}
</style>
