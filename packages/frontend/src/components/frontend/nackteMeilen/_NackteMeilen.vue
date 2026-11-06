<template>
    <div class="NackteMeilen">
        <div class="nm-content">

            <!-- Kopf: Zaehler offen / gelaufen -->
            <div class="nm-hero">
                <div class="nm-hero-head">
                    <button type="button" class="nm-back" aria-label="Zurück" @click="goBack()">
                        <i class="pi pi-chevron-left"></i>
                    </button>
                    <h1 class="nm-hero-title">Nackte Meilen</h1>
                </div>

                <div class="nm-stats">
                    <div class="nm-stat">
                        <div class="nm-stat-value">{{ isLoading ? '–' : offen.length }}</div>
                        <div class="nm-stat-label">noch offen</div>
                    </div>
                    <div class="nm-stat nm-stat-done">
                        <div class="nm-stat-value">{{ isLoading ? '–' : absolviert.length }}</div>
                        <div class="nm-stat-label">schon gelaufen</div>
                    </div>
                </div>

                <div class="nm-hero-hint">
                    Wann gibt es eine Meile?
                    <router-link to="/Regeln" class="nm-hero-link">Regeln <i class="pi pi-angle-right"></i></router-link>
                </div>
            </div>

            <section v-if="isLoading" class="nm-section" aria-busy="true">
                <div class="nm-section-head">
                    <h2 class="nm-section-title">Wer noch läuft</h2>
                    <span class="nm-section-meta">nach Anzahl</span>
                </div>
                <SkeletonList :rows="6" class="nm-card"/>
            </section>

            <template v-else>
                <!-- Offene Meilen je Spieler -->
                <section class="nm-section">
                    <div class="nm-section-head">
                        <h2 class="nm-section-title">Wer noch läuft</h2>
                        <span class="nm-section-meta">nach Anzahl</span>
                    </div>

                    <div class="nm-card">
                        <div v-if="!debtors.length" class="nm-empty">Alle Meilen sind gelaufen.</div>

                        <div v-for="debtor in visibleDebtors" :key="debtor.name" class="nm-entry">
                            <button type="button" class="nm-row" :aria-expanded="expandedName === debtor.name" @click="toggleDebtor(debtor.name)">
                                <Avatar :name="debtor.name" class="nm-avatar"/>
                                <div class="nm-main">
                                    <div class="nm-name">{{ debtor.name }}</div>
                                    <div class="nm-dashes">
                                        <span v-for="index in Math.min(debtor.miles.length, MAX_DASHES)" :key="index" class="nm-dash"></span>
                                    </div>
                                </div>
                                <span class="nm-count">{{ debtor.miles.length }}</span>
                                <i class="pi nm-chevron" :class="expandedName === debtor.name ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                            </button>

                            <div v-if="expandedName === debtor.name" class="nm-games">
                                <div v-for="(mile, index) in debtor.miles" :key="index" class="nm-game">
                                    <div class="nm-game-date">{{ formatDate(mile.time, 'long') }}</div>
                                    <div>{{ formatMatch(mile.match) }}</div>
                                </div>
                            </div>
                        </div>

                        <button v-if="hiddenDebtorCount" type="button" class="nm-more" @click="showAllDebtors = true">
                            + {{ hiddenDebtorCount }} Spieler mit je 1 Meile
                        </button>
                    </div>
                </section>

                <!-- Absolvierte Meilen, neueste zuerst -->
                <section v-if="absolviert.length" class="nm-section">
                    <div class="nm-section-head">
                        <h2 class="nm-section-title">Zuletzt gelaufen</h2>
                        <button v-if="absolviert.length > RECENT_RUN_COUNT" type="button" class="nm-section-link" @click="showAllRuns = !showAllRuns">
                            {{ showAllRuns ? 'Weniger' : `Alle ${absolviert.length}` }}
                            <i class="pi" :class="showAllRuns ? 'pi-angle-up' : 'pi-angle-right'"></i>
                        </button>
                    </div>

                    <div class="nm-card">
                        <div v-for="(run, index) in visibleRuns" :key="index" class="nm-row nm-row-static">
                            <Avatar :name="formatPlayerName(run.name)" class="nm-avatar nm-avatar-done"/>
                            <div class="nm-main">
                                <div class="nm-name">{{ formatPlayerName(run.name) }}</div>
                                <div class="nm-meta">{{ run.match ? `Meile vom ${formatDate(run.time, 'day')} · ${formatMatch(run.match)}` : 'gelaufen' }}</div>
                            </div>
                            <span class="nm-done-date">{{ formatDate(run.completedAt.getTime(), 'short') }} ✓</span>
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
import Avatar from '@/components/shared/Avatar.vue';
import SkeletonList from '@/components/shared/SkeletonList.vue';
import { onGameSaved } from '@/components/shared/GameEntry/useAddGame';
import { getAllOpenGames } from '@/components/frontend/openGames/OpenGamesUtilFunctions';
import { formatPlayerName } from '@/components/frontend/home/homeUtil';
import { getMatchScore } from '@/util/tournamentMatchFunctions';
import { getNackteMeilen, type OffeneMeile } from './nackteMeilen';

// Ein Strich pro offener Meile, ab hier nur noch die Zahl
const MAX_DASHES = 10;
const RECENT_RUN_COUNT = 3;

const router = useRouter();

// shallowRef: Spiele werden nur komplett ersetzt
const openGames = shallowRef<Match[]>([]);
const isLoading = ref(true);

const loadOpenGames = async () => {
    openGames.value = await getAllOpenGames();
    isLoading.value = false;
};
loadOpenGames();
onGameSaved(loadOpenGames);

const nackteMeilen = computed(() => getNackteMeilen(openGames.value));
const offen = computed(() => nackteMeilen.value.offen);
const absolviert = computed(() => nackteMeilen.value.absolviert);

// ─── Wer noch laeuft ───
// Offene Meilen je Spieler: meiste zuerst, bei Gleichstand die juengste Meile zuerst.
const debtors = computed(() => {
    const milesByName = new Map<string, OffeneMeile[]>();
    offen.value.forEach((mile) => {
        const name = formatPlayerName(mile.name);
        milesByName.set(name, [...(milesByName.get(name) ?? []), mile]);
    });

    return [...milesByName.entries()]
        .map(([name, miles]) => ({ name, miles: miles.sort((a, b) => b.time - a.time) }))
        .sort((a, b) => b.miles.length - a.miles.length || b.miles[0].time - a.miles[0].time);
});

// Spieler mit nur einer Meile erst auf Klick, ausser es gibt nur solche.
const showAllDebtors = ref(false);
const multiMileDebtors = computed(() => debtors.value.filter(debtor => debtor.miles.length > 1));
const visibleDebtors = computed(() => showAllDebtors.value || !multiMileDebtors.value.length ? debtors.value : multiMileDebtors.value);
const hiddenDebtorCount = computed(() => debtors.value.length - visibleDebtors.value.length);

const expandedName = ref<string | null>(null);
const toggleDebtor = (name: string) => {
    expandedName.value = expandedName.value === name ? null : name;
};

// ─── Zuletzt gelaufen ───
const showAllRuns = ref(false);
const visibleRuns = computed(() => showAllRuns.value ? absolviert.value : absolviert.value.slice(0, RECENT_RUN_COUNT));

// ─── Formatierung ───
const DATE_FORMATS: Record<'long' | 'short' | 'day', Intl.DateTimeFormatOptions> = {
    long: { day: '2-digit', month: '2-digit', year: 'numeric' },    // 26.09.2026
    short: { day: '2-digit', month: '2-digit', year: '2-digit' },   // 26.09.26
    day: { day: '2-digit', month: '2-digit' },                      // 26.09.
};
const formatDate = (time: number, format: keyof typeof DATE_FORMATS) =>
    new Date(time).toLocaleDateString('de-DE', DATE_FORMATS[format]);

// "Nick Brinkrolf & Leonard Südbrock 3 : 10 Jonas Weck & Leon Rose"
const formatMatch = (match: Match) => {
    const teamNames = (team: Team) => team.players.map(player => formatPlayerName(player.name)).join(' & ');
    return `${teamNames(match.team1)} ${getMatchScore(match, true)} : ${getMatchScore(match, false)} ${teamNames(match.team2)}`;
};

const goBack = () => {
    if (window.history.state?.back)
        router.back();
    else
        router.push('/');
};
</script>

<style scoped>
/* Grauer Seitengrund ueber die volle Breite, Inhalt schmal wie eine App */
.NackteMeilen{
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
</style>
