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

        <!-- Kategorien -->
        <h2 class="nt-section-title">Was möchtest du erfahren?</h2>
        <div class="nt-card">
            <div
                v-for="category in categories"
                :key="category.key"
                class="ns-row"
                :class="{ 'ns-row--highlight': category.key === highlightCategory }"
            >
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
        </div>

        <!-- Alle Spiele oder nur gefolgte Spieler -->
        <h2 class="nt-section-title">Von welchen Spielen?</h2>
        <div class="ns-segmented" role="radiogroup">
            <button
                v-for="option in followModeOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="followMode === option.value"
                :class="{ 'is-active': followMode === option.value }"
                @click="setFollowMode(option.value)"
            >{{ option.label }}</button>
        </div>

        <div v-if="followMode === 'followed'" class="nt-card ns-follow">
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

            <p class="ns-hint">
                <template v-if="followedPlayers.length">Du bekommst nur Spiele, an denen einer von ihnen beteiligt ist.</template>
                <template v-else>Noch niemand ausgewählt – solange bekommst du keine Spiele.</template>
                Tipp: Auf jedem Spielerprofil gibt es eine Glocke zum Folgen.
            </p>
        </div>

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

const MAX_RESULTS = 6;

defineProps<{ highlightCategory?: PushCategory }>();

const toast = useToast();
const { preferences, followMode, followedPlayers, setPreference, setFollowMode, isFollowing, followPlayer, unfollowPlayer, sendTest, deactivate } = usePushNotifications();

// Farben wie die Texte je Kategorie im Push-Design
const categories: { key: PushCategory, title: string, text: string, icon: string, background: string, color: string }[] = [
    { key: 'openGames', title: 'Offene Spiele', text: 'Wenn jemand ein offenes Spiel einträgt', icon: 'pi-arrow-up-right', background: '#eef0f3', color: '#4b5160' },
    { key: 'leagueGames', title: 'BiPo League & Cup', text: 'Neue Liga- und Cup-Spiele', icon: 'pi-trophy', background: '#e2f4f8', color: '#2a93ab' },
    { key: 'tournamentResults', title: 'Turnier-Ergebnisse', text: 'Gruppen- und K.o.-Phase beim BiPo Open', icon: 'pi-sitemap', background: '#fde9eb', color: 'var(--main-color)' },
    { key: 'registrations', title: 'Turnier-Anmeldungen', text: 'Wenn sich ein neues Team anmeldet', icon: 'pi-user-plus', background: '#fdf3dc', color: '#c48a12' },
];

const followModeOptions: { value: PushFollowMode, label: string }[] = [
    { value: 'all', label: 'Alle Spiele' },
    { value: 'followed', label: 'Nur von Spielern, denen ich folge' },
];

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
    background: #e6f5ea;
}
.ns-active-icon {
    background: #2ea45f;
    color: white;
    font-size: 18px;
}
.ns-active-title {
    font-size: 15px;
    font-weight: 800;
    color: #1b6b3c;
}
.ns-active-text {
    font-size: 13px;
    color: #3d7a55;
}
.ns-test {
    flex-shrink: 0;
    padding: 9px 14px;
    border: none;
    border-radius: 999px;
    background: white;
    color: #1d1f23;
    font-size: 13px;
    font-weight: 700;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.ns-test:disabled {
    opacity: .6;
}

/* ─── Kategorien ─── */
.ns-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
}
.ns-row + .ns-row {
    border-top: 1px solid #f0f1f3;
}
/* Ueber den Turnier-Hinweis gekommen: Kategorie kurz hervorheben */
.ns-row--highlight {
    animation: ns-highlight 2.4s ease-out;
}
@keyframes ns-highlight {
    0%, 40% { background: #fff1f2; }
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
    background: #d5d8dd;
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
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform .2s ease;
}
.ns-switch[aria-checked="true"] {
    background: var(--main-color);
}
.ns-switch[aria-checked="true"]::after {
    transform: translateX(20px);
}

/* ─── Alle | Gefolgte ─── */
.ns-segmented {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: #e9ebee;

    button {
        flex: 1;
        min-height: 38px;
        padding: 6px 10px;
        border: none;
        border-radius: 9px;
        background: transparent;
        color: #555b63;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.2;
        transition: background .2s ease, color .2s ease;
    }
    button.is-active {
        background: white;
        color: #1d1f23;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
}

/* ─── Spieler ─── */
.ns-follow {
    margin-top: 10px;
    padding: 12px;
}
.ns-search {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 14px;
    border: 1px solid #dfe2e6;
    border-radius: 12px;
}
.ns-search:focus-within {
    border-color: var(--main-color);
}
.ns-search-icon {
    color: #8a9099;
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
    background: #f5f6f8;
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
    background: #eef0f3;
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
    color: #555b63;

    .pi {
        font-size: 11px;
    }
}
.ns-chip-remove:hover {
    background: rgba(0, 0, 0, 0.06);
}

.ns-hint {
    margin: 12px 2px 0;
    font-size: 12px;
    line-height: 1.4;
    color: #6b717b;
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
    color: #555b63;
    font-size: 14px;
    font-weight: 700;
}
.ns-deactivate:hover {
    color: #1d1f23;
}
</style>
