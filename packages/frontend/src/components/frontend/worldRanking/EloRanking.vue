<template>
    <div class="EloRanking">

        <div class="elo-header">
            <div class="elo-header-text">
                <h1 class="bp-title">Weltrangliste</h1>
                <div class="elo-subtitle">Elo-Rating · alle offiziellen Spiele seit 2020</div>
            </div>
            <button type="button" class="elo-info-button" @click="showExplanation = true">
                <i class="pi pi-info-circle"></i>
                Elo erklärt
            </button>
        </div>

        <Tabs :value="mode" class="p-tabs-chips" @update:value="value => selectMode(value as EloMode)">
            <TabList class="elo-chips">
                <Tab v-for="chip in chips" :key="chip.key" :value="chip.key">{{ chip.label }}</Tab>
            </TabList>
        </Tabs>

        <div class="elo-card">
            <div class="elo-card-head">
                <span class="elo-col-rank">#</span>
                <span class="elo-col-player">{{ mode === 'players' ? 'Spieler' : 'Team' }}</span>
                <span class="elo-col-rating">Rating · {{ ELO_TREND_DAYS }} Tage</span>
            </div>

            <div v-if="!ranking.active.length" class="elo-empty">Noch keine aktiven {{ mode === 'players' ? 'Spieler' : 'Teams' }}.</div>

            <EloRankingEntry
                v-for="entry in ranking.active"
                :key="entry.key"
                :entry="entry"
                :mode="mode"
                :now="now"
                :expanded="expandedKey === entry.key"
                @toggle="toggleEntry(entry.key)"
            />
        </div>

        <template v-if="ranking.inactive.length">
            <button type="button" class="elo-inactive-toggle" :aria-expanded="showInactive" @click="showInactive = !showInactive">
                <span><b>{{ ranking.inactive.length }} inaktive {{ mode === 'players' ? 'Spieler' : 'Teams' }}</b> · Rating bleibt erhalten</span>
                <i class="pi" :class="showInactive ? 'pi-angle-down' : 'pi-angle-right'"></i>
            </button>

            <div v-if="showInactive" class="elo-card">
                <EloRankingEntry
                    v-for="entry in ranking.inactive"
                    :key="entry.key"
                    :entry="entry"
                    :mode="mode"
                    :now="now"
                    :expanded="expandedKey === entry.key"
                    @toggle="toggleEntry(entry.key)"
                />
            </div>
        </template>

        <p class="elo-footnote">
            In der Liste erscheint, wer mindestens {{ ELO_MIN_GAMES }} Spiele hat und in den letzten 6 Monaten gespielt hat.
            Pfeile und Veränderung beziehen sich auf den Stand vor {{ ELO_TREND_DAYS }} Tagen.
        </p>

        <EloExplainedSheet v-model:visible="showExplanation"/>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import EloRankingEntry from './EloRankingEntry.vue';
import EloExplainedSheet from './EloExplainedSheet.vue';
import { ELO_MIN_GAMES, ELO_TREND_DAYS, EloMode, RankingData, buildEloGames, computeElo, getEloRanking } from './eloRating';

const props = defineProps<{ data: RankingData; now: number }>();

const chips: { key: EloMode; label: string }[] = [
    { key: 'players', label: 'Spieler' },
    { key: 'teams', label: 'Teams' },
];

const mode = ref<EloMode>('players');
const showInactive = ref(false);
const showExplanation = ref(false);
const expandedKey = ref<string | null>(null);

const selectMode = (key: EloMode) => {
    mode.value = key;
    expandedKey.value = null;
    showInactive.value = false;
};

const toggleEntry = (key: string) => {
    expandedKey.value = expandedKey.value === key ? null : key;
};

const eloGames = computed(() => buildEloGames(props.data));
const records = computed(() => computeElo(eloGames.value, props.now, mode.value));
const ranking = computed(() => getEloRanking(records.value, props.now));
</script>

<style scoped>
.EloRanking {
    color: var(--bp-text-strong);
}

/* ── Header ── */
.elo-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0 14px;

    h1 {
        padding: 0;
    }
}
.elo-subtitle {
    margin-top: 4px;
    font-size: 13px;
    color: var(--bp-text-muted);
}
.elo-info-button {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--bp-border-strong);
    border-radius: 999px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}
.elo-info-button:hover {
    background: var(--bp-fill-soft);
}

/* ── Filter ── */
:deep(.elo-chips) {
    padding: 0 0 14px;
}

/* ── Liste ── */
.elo-card {
    background: var(--bp-surface);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.elo-card + .elo-inactive-toggle,
.elo-inactive-toggle + .elo-card {
    margin-top: 10px;
}
.elo-card-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--bp-border);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--bp-text-muted);
}
.elo-col-rank {
    flex-shrink: 0;
    width: 28px;
    text-align: center;
}
.elo-col-player {
    flex: 1;
    padding-left: 52px; /* unter dem Namen, neben dem Avatar */
}
.elo-col-rating {
    flex-shrink: 0;
    text-align: right;
}

.elo-inactive-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 16px;
    background: var(--bp-surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    color: var(--bp-text);
    font-size: 13px;
    text-align: left;
    cursor: pointer;

    b {
        color: var(--bp-text-strong);
    }
}

.elo-empty {
    padding: 30px 14px;
    text-align: center;
    font-size: 14px;
    color: var(--bp-text-muted);
}
.elo-footnote {
    margin: 12px 2px 10px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--bp-text-subtle);
}

@media (width <= 360px) {
    .elo-info-button {
        padding: 7px 10px;
    }
}
</style>
