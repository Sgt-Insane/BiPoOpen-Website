<template>
    <section class="pp-section">
        <div class="pp-section-head">
            <h2 class="pp-section-title">Erfolge</h2>
            <button type="button" class="pp-ach-all" @click="sheetVisible = true">
                Alle {{ unlockedCount }} <i class="pi pi-angle-right"></i>
            </button>
        </div>

        <div v-if="groupedBadges.title.length" class="pp-titles">
            <button v-for="badge in groupedBadges.title" :key="badge.id" type="button" class="pp-title" @click="openBadge(badge)">
                <span class="pp-title-icon"><span class="material-icons">{{ badge.icon }}</span></span>
                <span class="min-w-0">
                    <span class="pp-title-label">{{ badge.label }}</span>
                    <span class="pp-title-caption">{{ badge.caption }}</span>
                </span>
            </button>
        </div>

        <!-- Rekorde, Leistung und Meilensteine zum Durchwischen -->
        <div class="pp-ach-scroller">
            <button
                v-for="badge in scrollerBadges"
                :key="badge.id"
                type="button"
                class="pp-ach-card"
                @click="openBadge(badge)"
            >
                <span class="pp-ach-icon" :class="getIconClass(badge)">
                    <span class="material-icons">{{ getIcon(badge) }}</span>
                </span>
                <span class="pp-ach-card-text">
                    <span class="pp-ach-label" :class="{ 'is-muted': badge.locked }">{{ badge.label }}</span>
                    <span class="pp-ach-caption">{{ badge.caption }}</span>
                </span>
            </button>
        </div>

        <!-- Alle Erfolge -->
        <BottomSheet v-model:visible="sheetVisible">
            <template #header>
                <div class="pp-ach-sheet-title">Erfolge</div>
            </template>

            <template v-for="group in GROUPS" :key="group.key">
                <template v-if="groupedBadges[group.key].length">
                    <div class="pp-ach-group-label" :class="`pp-ach-group-label--${group.key}`">{{ group.label }}</div>
                    <button
                        v-for="badge in groupedBadges[group.key]"
                        :key="badge.id"
                        type="button"
                        class="pp-ach-row"
                        @click="openBadge(badge)"
                    >
                        <span class="pp-ach-icon" :class="getIconClass(badge)">
                            <span class="material-icons">{{ getIcon(badge) }}</span>
                        </span>
                        <span class="pp-ach-row-main">
                            <span class="pp-ach-label" :class="{ 'is-muted': badge.locked }">{{ badge.label }}</span>
                            <span v-if="badge.progress" class="pp-ach-progress">
                                <span :style="{ width: `${getProgressPercent(badge)}%` }"></span>
                            </span>
                        </span>
                        <span class="pp-ach-row-caption">{{ badge.caption }}</span>
                    </button>
                </template>
            </template>
        </BottomSheet>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            dismissableMask
            :style="{ width: '340px' }"
            :pt="{ header: { style: 'display:none' } }"
        >
            <div v-if="selectedBadge" class="pp-badge-detail">
                <span class="pp-ach-icon pp-ach-icon--large" :class="getIconClass(selectedBadge)">
                    <span class="material-icons">{{ selectedBadge.icon }}</span>
                </span>
                <div class="pp-badge-detail-label">{{ selectedBadge.label }}</div>
                <div class="pp-badge-detail-text">{{ selectedBadge.description }}</div>
                <div v-if="selectedBadge.former" class="pp-badge-detail-meta">Früher gehalten · {{ selectedBadge.caption }}</div>
                <div v-else-if="selectedBadge.locked" class="pp-badge-detail-meta">
                    Noch nicht freigeschaltet<template v-if="selectedBadge.progress"> · {{ selectedBadge.caption }}</template>
                </div>
                <div v-else-if="selectedBadge.date" class="pp-badge-detail-meta">Erhalten am {{ selectedBadge.date }}</div>

                <!-- Rekorde hat nur einer, der steht schon in der Beschreibung -->
                <div v-if="selectedBadge.group !== 'record'" class="pp-badge-detail-holders">
                    <div v-if="holdersLoading" aria-busy="true">
                        <div class="bp-skeleton pp-badge-holders-skeleton" style="width: 70%"></div>
                        <div class="bp-skeleton pp-badge-holders-skeleton" style="width: 45%"></div>
                    </div>
                    <template v-else>
                        <div class="font-semibold">
                            {{ otherHolders.length }}
                            {{ otherHolders.length === 1 ? 'anderer Spieler hat' : 'andere Spieler haben' }}
                            dieses Abzeichen
                        </div>
                        <div v-if="otherHolders.length > 0 && otherHolders.length <= 5" class="pp-badge-detail-meta">
                            {{ otherHolders.join(', ') }}
                        </div>
                    </template>
                </div>
            </div>
        </Dialog>
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Dialog from 'primevue/dialog';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import { getBadgeHolders } from './PlayerProfileUtilFunctions';

const props = defineProps<{
    badges: PlayerBadge[];
    playerName: string;
}>();

const GROUPS: { key: PlayerBadgeGroup; label: string }[] = [
    { key: 'title', label: 'Titel' },
    { key: 'record', label: 'Rekorde' },
    { key: 'performance', label: 'Leistung' },
    { key: 'milestone', label: 'Meilensteine' },
];

// Stufen-Reihen: nur die hoechste erreichte und die naechste offene Stufe
const visibleBadges = computed(() => props.badges.filter(badge => {
    if (!badge.tier || badge.locked) return true;
    const higherUnlocked = props.badges.some(other =>
        other.tier === badge.tier && !other.locked && props.badges.indexOf(other) > props.badges.indexOf(badge));
    return !higherUnlocked;
}));

const unlockedCount = computed(() => visibleBadges.value.filter(badge => !badge.locked).length);

// Freigeschaltet, dann frueher gehaltene Rekorde, dann gesperrt; Titel neueste zuerst
const getStateOrder = (badge: PlayerBadge) => !badge.locked ? 0 : badge.former ? 1 : 2;

const groupedBadges = computed(() => Object.fromEntries(GROUPS.map(({ key }) => [key, visibleBadges.value
    .filter(badge => badge.group === key)
    .sort((a, b) => key === 'title' ? b.time - a.time : getStateOrder(a) - getStateOrder(b))
])) as Record<PlayerBadgeGroup, PlayerBadge[]>);

const scrollerBadges = computed(() => [...groupedBadges.value.record, ...groupedBadges.value.performance, ...groupedBadges.value.milestone]);

const getIcon = (badge: PlayerBadge) => badge.locked && !badge.former ? 'lock' : badge.icon;
const getIconClass = (badge: PlayerBadge) => badge.locked ? 'is-locked' : `pp-ach-icon--${badge.group}`;

const getProgressPercent = (badge: PlayerBadge) =>
    badge.progress ? Math.min(100, Math.round(badge.progress.current / badge.progress.target * 100)) : 0;

const sheetVisible = ref(false);

// Detail-Dialog mit den anderen Besitzern
const dialogVisible = ref(false);
const selectedBadge = ref<PlayerBadge | null>(null);
const holderNames = ref<string[]>([]);
const holdersLoading = ref(false);

const otherHolders = computed(() => holderNames.value.filter(name => name !== props.playerName));

const openBadge = async (badge: PlayerBadge) => {
    selectedBadge.value = badge;
    holderNames.value = [];
    dialogVisible.value = true;
    if (badge.group === 'record') return;

    holdersLoading.value = true;
    try {
        holderNames.value = await getBadgeHolders(badge.id);
    } finally {
        holdersLoading.value = false;
    }
};
</script>

<style scoped>
button {
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}

.pp-ach-all {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0;
    border: none;
    background: none;
    color: var(--main-color) !important;
    font-size: 14px;
    font-weight: 700;
}

/* ── Titel ── */
.pp-titles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
    margin-bottom: 8px;
}
.pp-title {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--bp-gold-border);
    border-radius: 14px;
    background: var(--bp-gold-card);
}
.pp-title-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: #e3a92b;
    color: white;

    .material-icons {
        font-size: 19px;
    }
}
.pp-title-label {
    display: block;
    font-size: 14px;
    font-weight: 800;
}
.pp-title-caption {
    display: block;
    font-size: 12px;
    color: var(--bp-gold);
}

/* ── Icons je Gruppe ── */
.pp-ach-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;

    .material-icons {
        font-size: 19px;
    }
}
.pp-ach-icon--large {
    width: 60px;
    height: 60px;
    margin-bottom: 4px;

    .material-icons {
        font-size: 30px;
    }
}
.pp-ach-icon--title { background: var(--bp-gold-weak); color: var(--bp-gold-icon); }
.pp-ach-icon--record { background: var(--bp-violet-weak); color: var(--bp-violet); }
.pp-ach-icon--performance { background: var(--bp-primary-weak); color: var(--main-color); }
.pp-ach-icon--milestone { background: var(--secondary-color-weak); color: var(--bp-secondary-text); }
.pp-ach-icon.is-locked { background: var(--bp-fill); color: var(--bp-text-faint); }

.pp-ach-label {
    display: block;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pp-ach-label.is-muted {
    color: var(--bp-text-muted);
}

/* ── Leiste ── */
.pp-ach-scroller {
    display: flex;
    gap: 8px;
    padding: 2px 2px 6px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
}
.pp-ach-scroller::-webkit-scrollbar {
    display: none;
}
.pp-ach-card {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    width: 158px;
    padding: 10px 12px;
    border: none;
    border-radius: 14px;
    background: var(--bp-surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    scroll-snap-align: start;
}
.pp-ach-card-text {
    min-width: 0;

    .pp-ach-label {
        font-size: 14px;
    }
}
.pp-ach-caption {
    display: block;
    font-size: 12px;
    color: var(--bp-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* ── Sheet ── */
.pp-ach-sheet-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.pp-ach-group-label {
    margin: 18px 0 6px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.pp-ach-group-label:first-child {
    margin-top: 4px;
}
.pp-ach-group-label--title { color: var(--bp-gold); }
.pp-ach-group-label--record { color: var(--bp-violet); }
.pp-ach-group-label--performance { color: var(--bp-primary-text); }
.pp-ach-group-label--milestone { color: var(--bp-secondary-text); }

.pp-ach-row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 8px 0;
    border: none;
    background: none;
}
.pp-ach-row-main {
    flex: 1;
    min-width: 0;

    .pp-ach-label {
        font-size: 15px;
    }
}
.pp-ach-row-caption {
    flex-shrink: 0;
    max-width: 45%;
    font-size: 13px;
    color: var(--bp-text-muted);
    text-align: right;
}
.pp-ach-progress {
    display: block;
    height: 4px;
    margin-top: 6px;
    overflow: hidden;
    border-radius: 2px;
    background: var(--bp-fill-strong);

    span {
        display: block;
        height: 100%;
        background: var(--bp-text-faint);
    }
}

/* ── Dialog ── */
.pp-badge-detail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding-top: 16px;
    text-align: center;
}
.pp-badge-detail-label {
    font-size: 17px;
    font-weight: 800;
}
.pp-badge-detail-text {
    font-size: 13px;
    color: var(--bp-text);
}
.pp-badge-detail-meta {
    font-size: 12px;
    color: var(--bp-text-muted);
}
.pp-badge-detail-holders {
    width: 100%;
    margin-top: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--bp-border);
    font-size: 13px;
}
.pp-badge-holders-skeleton {
    height: 12px;
    margin: 4px auto 0;
    border-radius: 6px;
}
.pp-badge-holders-skeleton + .pp-badge-holders-skeleton {
    margin-top: 8px;
}
</style>
