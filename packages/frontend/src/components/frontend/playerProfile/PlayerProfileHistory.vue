<template>
    <section v-if="matchHistory.length" class="pp-section">
        <div class="pp-section-head">
            <h2 class="pp-section-title">Letzte Spiele</h2>
            <button v-if="!expanded && matchHistory.length > limit" type="button" class="pp-history-all" @click="showAll">
                Alle {{ matchHistory.length.toLocaleString('de-DE') }} <i class="pi pi-angle-right"></i>
            </button>
        </div>

        <div class="flex flex-col gap-[12px]">
            <MatchElement
                v-for="(entry, index) in displayed"
                :key="entry.match._id || index"
                :match="withLeagueTeamLogos(entry.match)"
                :chipLabel="SOURCE_LABELS[entry.source] ?? entry.source"
                showChip
                showDate
                showElo
                class="pp-history-match"
            >
                <template #meta>
                    <Tag :severity="entry.won ? 'success' : 'danger'" :value="entry.won ? 'Sieg' : 'Niederlage'" rounded class="ml-auto"/>
                </template>
            </MatchElement>
        </div>

        <Button
            v-if="expanded && matchHistory.length > limit"
            :label="`Mehr anzeigen (${matchHistory.length - limit} weitere)`"
            severity="secondary"
            outlined
            class="w-full mt-[12px]"
            @click="limit += PAGE_SIZE"
        />
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import { withLeagueTeamLogos } from '@/components/frontend/league/LeaguePlayersData';

// Neueste zuerst
const props = defineProps<{ matchHistory: MatchHistoryEntry[] }>();

const SOURCE_LABELS: Record<string, string> = {
    'Offene Spiele 1v1': 'Offenes Spiel',
    'Offene Spiele 2v2': 'Offenes Spiel',
    'BiPo League': 'Liga',
    'BiPo League Cup': 'Cup',
    'BiPo Open Turniere': 'BiPo Open',
};

const INITIAL_COUNT = 5;
const PAGE_SIZE = 20;

const expanded = ref(false);
const limit = ref(INITIAL_COUNT);

const displayed = computed(() => props.matchHistory.slice(0, limit.value));

const showAll = () => {
    expanded.value = true;
    limit.value = PAGE_SIZE;
};
</script>

<style scoped>
.pp-history-all {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0;
    border: none;
    background: none;
    color: var(--main-color);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
}
.flex > .pp-history-match {
    margin-bottom: 0;
}
</style>
