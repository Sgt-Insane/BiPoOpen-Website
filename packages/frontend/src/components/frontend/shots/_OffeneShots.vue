<template>
    <div class="OffeneShots">
        <div class="nm-content">

            <!-- Kopf: Zaehler offen / getrunken (wie Nackte Meilen) -->
            <div class="nm-hero">
                <div class="nm-hero-head">
                    <button type="button" class="nm-back" aria-label="Zurück" @click="goBack()">
                        <i class="pi pi-chevron-left"></i>
                    </button>
                    <h1 class="nm-hero-title">Offene Shots</h1>
                </div>

                <div class="nm-stats">
                    <div class="nm-stat">
                        <div class="nm-stat-value">{{ isLoading ? '–' : open.length }}</div>
                        <div class="nm-stat-label">noch offen</div>
                    </div>
                    <div class="nm-stat nm-stat-done">
                        <div class="nm-stat-value">{{ isLoading ? '–' : drunk.length }}</div>
                        <div class="nm-stat-label">schon getrunken</div>
                    </div>
                </div>

                <div class="nm-hero-hint">
                    Je 3 Airballs eines Teams trinkt jede Person einen Shot.
                    <router-link to="/Nackte-Meilen" class="nm-hero-link">Nackte Meilen <i class="pi pi-angle-right"></i></router-link>
                </div>
            </div>

            <section v-if="isLoading" class="nm-section" aria-busy="true">
                <div class="nm-section-head">
                    <h2 class="nm-section-title">Wer noch trinken muss</h2>
                    <span class="nm-section-meta">nach Anzahl</span>
                </div>
                <SkeletonList :rows="4" class="nm-card"/>
            </section>

            <template v-else>
                <!-- Offene Shots je Person -->
                <section class="nm-section">
                    <div class="nm-section-head">
                        <h2 class="nm-section-title">Wer noch trinken muss</h2>
                        <span class="nm-section-meta">nach Anzahl</span>
                    </div>

                    <div class="nm-card">
                        <div v-if="!debtors.length" class="nm-empty">Alle Shots sind getrunken. Prost! 🥃</div>

                        <div v-for="debtor in debtors" :key="debtor.name" class="nm-entry">
                            <button type="button" class="nm-row" :aria-expanded="expandedName === debtor.name" @click="toggleDebtor(debtor.name)">
                                <Avatar :name="debtor.name" class="nm-avatar"/>
                                <div class="nm-main">
                                    <div class="nm-name">{{ debtor.name }}</div>
                                    <div class="nm-dashes">
                                        <span v-for="index in Math.min(debtor.shots.length, MAX_DASHES)" :key="index" class="nm-dash"></span>
                                    </div>
                                </div>
                                <span class="nm-count">{{ debtor.shots.length }}</span>
                                <i class="pi nm-chevron" :class="expandedName === debtor.name ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                            </button>

                            <div v-if="expandedName === debtor.name" class="nm-games">
                                <div v-for="shot in debtor.shots" :key="shot._id" class="nm-game sh-game">
                                    <div class="sh-game-text">
                                        <div class="nm-game-date">{{ formatDate(shot.gameTime ?? shot.createdAt, 'long') }} · 3 Airballs</div>
                                        <div>{{ describeGame(shot) }}</div>
                                    </div>
                                    <button type="button" class="sh-drink" :disabled="busy === shot._id" @click="markDrunk(shot, true)">
                                        <i class="pi pi-check"></i> Getrunken
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Getrunken, neueste zuerst -->
                <section v-if="drunk.length" class="nm-section">
                    <div class="nm-section-head">
                        <h2 class="nm-section-title">Zuletzt getrunken</h2>
                        <button v-if="drunk.length > RECENT_COUNT" type="button" class="nm-section-link" @click="showAllDrunk = !showAllDrunk">
                            {{ showAllDrunk ? 'Weniger' : `Alle ${drunk.length}` }}
                            <i class="pi" :class="showAllDrunk ? 'pi-angle-up' : 'pi-angle-right'"></i>
                        </button>
                    </div>

                    <div class="nm-card">
                        <div v-for="shot in visibleDrunk" :key="shot._id" class="nm-row nm-row-static">
                            <Avatar :name="shot.name" class="nm-avatar nm-avatar-done"/>
                            <div class="nm-main">
                                <div class="nm-name">{{ shot.name }}</div>
                                <div class="nm-meta">Shot vom {{ formatDate(shot.gameTime ?? shot.createdAt, 'day') }} · {{ describeGame(shot) }}</div>
                            </div>
                            <button type="button" class="nm-done-date sh-undo" title="Zurücknehmen" @click="markDrunk(shot, false)">{{ formatDate(shot.drunkAt!, 'short') }} ✓</button>
                        </div>
                    </div>
                </section>
            </template>

        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Avatar from '@/components/shared/Avatar.vue';
import SkeletonList from '@/components/shared/SkeletonList.vue';
import { getShots, setShotDrunk, type Shot } from './shots';

const MAX_DASHES = 10;
const RECENT_COUNT = 5;

const router = useRouter();
const toast = useToast();

const shots = shallowRef<Shot[]>([]);
const isLoading = ref(true);
const busy = ref<string | null>(null);

const loadShots = async () => {
    try {
        shots.value = await getShots();
    } catch {
        shots.value = [];
    }
    isLoading.value = false;
};
loadShots();

const open = computed(() => shots.value.filter(shot => !shot.drunkAt));
const drunk = computed(() => shots.value.filter(shot => shot.drunkAt).sort((a, b) => b.drunkAt! - a.drunkAt!));

// Offene Shots je Person: meiste zuerst, bei Gleichstand der neueste zuerst
const debtors = computed(() => {
    const byName = new Map<string, Shot[]>();
    open.value.forEach(shot => byName.set(shot.name, [...(byName.get(shot.name) ?? []), shot]));
    return [...byName.entries()]
        .map(([name, list]) => ({ name, shots: list.sort((a, b) => b.createdAt - a.createdAt) }))
        .sort((a, b) => b.shots.length - a.shots.length || b.shots[0].createdAt - a.shots[0].createdAt);
});

const expandedName = ref<string | null>(null);
const toggleDebtor = (name: string) => {
    expandedName.value = expandedName.value === name ? null : name;
};

const showAllDrunk = ref(false);
const visibleDrunk = computed(() => showAllDrunk.value ? drunk.value : drunk.value.slice(0, RECENT_COUNT));

const markDrunk = async (shot: Shot, isDrunk: boolean) => {
    busy.value = shot._id;
    const success = await setShotDrunk(shot, isDrunk);
    busy.value = null;
    if (!success) {
        toast.add({ severity: 'error', summary: 'Konnte nicht gespeichert werden', life: 3000 });
        return;
    }
    shots.value = shots.value.map(entry => entry._id === shot._id ? { ...entry, drunkAt: isDrunk ? Date.now() : null } : entry);
    if (isDrunk) toast.add({ severity: 'success', summary: `${shot.name} hat getrunken 🥃`, life: 2000 });
};

// ─── Formatierung ───
const DATE_FORMATS: Record<'long' | 'short' | 'day', Intl.DateTimeFormatOptions> = {
    long: { day: '2-digit', month: '2-digit', year: 'numeric' },
    short: { day: '2-digit', month: '2-digit', year: '2-digit' },
    day: { day: '2-digit', month: '2-digit' },
};
const formatDate = (time: number, format: keyof typeof DATE_FORMATS) =>
    new Date(time).toLocaleDateString('de-DE', DATE_FORMATS[format]);

const describeGame = (shot: Shot) =>
    shot.teamName && shot.opponentName ? `${shot.teamName} gegen ${shot.opponentName}` : shot.teamName ?? 'BiPo Knecht';

const goBack = () => {
    if (window.history.state?.back)
        router.back();
    else
        router.push('/');
};
</script>

<style scoped>
/* Grauer Seitengrund ueber die volle Breite, Inhalt schmal wie eine App */
.OffeneShots{
    margin-inline: calc(50% - 50vw);
    padding: 12px calc(50vw - 50%) 32px;
    background: var(--page-gray);
}
.nm-content{
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 720px;
    margin: 0 auto;
}

/* ─── Kopf ─── */
.nm-hero{
    padding: 16px 16px 14px;
    border-radius: 20px;
    background: linear-gradient(160deg, #13235B 0%, #0D1A45 100%);
    color: white;
}
.nm-hero-head{
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
}
.nm-back{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-left: -6px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: white;
    cursor: pointer;
}
.nm-back:hover{
    background: rgba(255, 255, 255, 0.1);
}
.nm-hero-title{
    margin: 0;
    font-size: 24px;
    font-weight: 800;
    line-height: 1.2;
}
.nm-stats{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.nm-stat{
    padding: 12px 12px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.08);
}
.nm-stat-value{
    font-size: 28px;
    font-weight: 800;
    line-height: 1.1;
}
.nm-stat-done .nm-stat-value{
    color: #5BC8F0;
}
.nm-stat-label{
    font-size: 13px;
    color: rgba(255, 255, 255, 0.75);
}
.nm-hero-hint{
    margin-top: 14px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
}
.nm-hero-link{
    color: white;
    font-weight: 700;
    text-decoration: none;
}
.nm-hero-link .pi{
    font-size: 11px;
}

/* ─── Abschnitte ─── */
.nm-section-head{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
}
.nm-section-title{
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.nm-section-meta{
    font-size: 12px;
    color: var(--bp-text-subtle);
}
.nm-section-link{
    padding: 0;
    border: none;
    background: none;
    color: var(--main-color);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
}
.nm-section-link .pi{
    font-size: 11px;
}

.nm-card{
    overflow: hidden;
    border: 1px solid var(--bp-border);
    border-radius: 14px;
    background: var(--bp-surface);
}
.nm-empty{
    padding: 16px;
    color: var(--bp-text-muted);
    font-size: 14px;
    text-align: center;
}

/* ─── Zeilen ─── */
.nm-entry + .nm-entry,
.nm-row-static + .nm-row-static{
    border-top: 1px solid var(--bp-border);
}
.nm-row{
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: none;
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.nm-row-static{
    cursor: default;
}
.nm-avatar{
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    font-size: 12px;
    font-weight: 700;
    opacity: 1;
    --avatar-background: var(--bp-fill);
    --avatar-color: var(--bp-text-muted);
}
.nm-avatar-done{
    --avatar-background: var(--secondary-color-weak);
    --avatar-color: var(--bp-secondary-text);
}
.nm-main{
    flex: 1;
    min-width: 0;
}
.nm-name{
    overflow: hidden;
    font-size: 15px;
    font-weight: 700;
    color: var(--bp-text-strong);
    white-space: nowrap;
    text-overflow: ellipsis;
}
.nm-meta{
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.35;
    color: var(--bp-text-muted);
}
.nm-dashes{
    display: flex;
    gap: 3px;
    margin-top: 5px;
}
.nm-dash{
    width: 14px;
    height: 4px;
    border-radius: 2px;
    background: var(--bp-navy);
}
.nm-count{
    font-size: 17px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.nm-chevron{
    font-size: 11px;
    color: var(--bp-text-subtle);
}
.nm-done-date{
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 700;
    color: #1F97B0;
}

/* Aufgeklappt: Spiele mit 0 Treffern */
.nm-games{
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 14px 12px 62px;
}
.nm-game{
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--bp-fill-soft);
    font-size: 13px;
    line-height: 1.35;
    color: var(--bp-text-strong);
}
.nm-game-date{
    font-size: 12px;
    color: var(--bp-text-muted);
}

.nm-more{
    width: 100%;
    padding: 12px 14px;
    border: none;
    border-top: 1px solid var(--bp-border);
    background: none;
    color: var(--bp-text-muted);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
}
.sh-game{
    display: flex;
    align-items: center;
    gap: 10px;
}
.sh-game-text{
    flex: 1;
    min-width: 0;
}
.sh-drink{
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    border: none;
    border-radius: 999px;
    background: #1E8DA3;
    color: white;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
}
.sh-drink:disabled{
    opacity: .5;
}
.sh-undo{
    border: none;
    background: none;
    font: inherit;
    cursor: pointer;
}
</style>
