<template>
    <DataTable
        :value="sortedLeaguePlayers"
        :rowClass="getRowClass"
        @row-click="onRowClick"
        rowHover
        scrollable
        class="league-standings mb-[30px]"
    >

        <!-- Platz -->
        <Column header="#" frozen class="bp-col-rank">
            <template #body="{ index }">
                <span class="bp-rank" :class="getZoneClass(index)">{{ index + 1 }}</span>
            </template>
        </Column>

        <!-- Team -->
        <Column header="Team" frozen>
            <template #body="slotProps">
                <div class="bp-name-cell">
                    <Avatar :name="slotProps.data.name" :avatarImage="getPlayerLogo(slotProps.data.name)" shape="square"/>
                    <div class="min-w-0">
                        <span class="bp-name">{{ slotProps.data.name }}</span>
                        <div v-if="slotProps.data.withdrawn" class="league-withdrawn-hint">zurückgezogen</div>
                    </div>
                </div>
            </template>
        </Column>

        <!-- Spiele -->
        <Column>
            <template #header><GlossaryWord term="tableColumns">{{ labels.games }}</GlossaryWord></template>
            <template #body="slotProps">{{ slotProps.data.withdrawn ? '–' : slotProps.data.ammountOfMatches }}</template>
        </Column>

        <!-- Siege -->
        <Column class="bp-col-strong">
            <template #header><GlossaryWord term="tableColumns">{{ labels.wins }}</GlossaryWord></template>
            <template #body="slotProps">{{ slotProps.data.withdrawn ? '–' : slotProps.data.wins }}</template>
        </Column>

        <!-- Niederlagen -->
        <Column>
            <template #header><GlossaryWord term="tableColumns">{{ labels.losses }}</GlossaryWord></template>
            <template #body="slotProps">
                {{ slotProps.data.withdrawn ? '–' : slotProps.data.ammountOfMatches - slotProps.data.wins }}
            </template>
        </Column>

        <!-- Trefferdifferenz, Antippen zeigt die Treffer (öffnet nicht das Team) -->
        <Column>
            <template #header><GlossaryWord term="tableColumns">{{ labels.diff }}</GlossaryWord></template>
            <template #body="slotProps">
                <template v-if="slotProps.data.withdrawn">–</template>
                <span v-else
                    v-tooltip.top.focus="`${slotProps.data.hitDifference} Treffer`"
                    tabindex="0"
                    class="bp-tooltip-target"
                    :class="getDiffClass(slotProps.data.hitDifferenceNumber)"
                    @click.stop
                >{{ formatDiff(slotProps.data.hitDifferenceNumber) }}</span>
            </template>
        </Column>

        <!-- Trend: letzte 5 Spiele, neuestes rechts -->
        <Column>
            <template #header><GlossaryWord term="tableColumns">Trend</GlossaryWord></template>
            <template #body="slotProps">
                <div v-if="!slotProps.data.withdrawn" class="league-form">
                    <span
                        v-for="(result, index) in getFormSlots(slotProps.data.name)"
                        :key="index"
                        class="league-form-item"
                        :class="result === 'W' ? 'league-form-win' : result === 'L' ? 'league-form-loss' : ''"
                        :title="result === 'W' ? 'Sieg' : result === 'L' ? 'Niederlage' : undefined"
                    >{{ result === 'W' ? 'S' : result === 'L' ? 'N' : '' }}</span>
                </div>
            </template>
        </Column>

        <template v-if="highlightTopSlots || promotionSlots || relegationSlots" #footer>
            <div class="bp-legend">
                <span v-if="promotionSlots" class="bp-zone-promotion">Aufstieg in die 1. Liga</span>
                <span v-if="highlightTopSlots > promotionSlots" class="bp-zone-qualify">Final 4</span>
                <span v-if="relegationSlots" class="bp-zone-relegation">Abstieg in die 2. Liga</span>            </div>
        </template>
    </DataTable>
</template>

<script setup lang="ts">
import GlossaryWord from '@/components/shared/GlossaryWord.vue';
import { computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Avatar from '@/components/shared/Avatar.vue';
import { formatDiff, getDiffClass, useTableLabels } from '@/components/shared/table';
import { getLeagueList, getRecentForm, getWithdrawnStandings } from './LeagueUtilFunctions';

const props = withDefaults(defineProps<{
    leaguePlayers: LeaguePlayer[];
    withdrawnPlayers?: LeaguePlayer[];   // zurueckgezogene Teams, fest am Tabellenende
    leagueGames: Match[];
    highlightTopSlots?: number;
    promotionSlots?: number;
    relegationSlots?: number;
}>(), {
    withdrawnPlayers: () => [],
    highlightTopSlots: 4,
    promotionSlots: 0,
    relegationSlots: 3,
});

const emit = defineEmits<{
    (e: 'select-player', playerName: string): void;
}>();

const sortedLeaguePlayers = computed(() => [
    ...getLeagueList(props.leagueGames, props.leaguePlayers),
    ...getWithdrawnStandings(props.withdrawnPlayers, props.leaguePlayers.length),
]);

const playerOrderByName = computed(() => {
    return sortedLeaguePlayers.value.reduce<Record<string, number>>((acc, player, index) => {
        acc[player.name] = index;
        return acc;
    }, {});
});

// Zone eines Tabellenplatzes: Aufstieg (gruen), Final Four (blau), Abstieg (rot)
const getZoneClass = (index: number) => {
    if (index < props.promotionSlots)
        return 'bp-zone-promotion';

    if (index < props.highlightTopSlots)
        return 'bp-zone-qualify';

    const placesFromBottom = sortedLeaguePlayers.value.length - 1 - index;
    if (placesFromBottom < props.relegationSlots)
        return 'bp-zone-relegation';

    return '';
};

// Gestrichelte Linie unter dem letzten Platz einer Zone
const getRowClass = (row: PlayerWithStats) => {
    const index = playerOrderByName.value[row.name];
    if (index === undefined || index === sortedLeaguePlayers.value.length - 1) return '';

    return getZoneClass(index) !== getZoneClass(index + 1) ? 'bp-row-divider' : '';
};

const getPlayerLogo = (playerName: string) => {
    return [...props.leaguePlayers, ...props.withdrawnPlayers].find(player => player.name === playerName)?.logo;
};

// Immer FORM_LENGTH Felder, noch nicht gespielte bleiben als leere Platzhalter vorne
const FORM_LENGTH = 5;

const recentFormByName = computed(() => {
    return props.leaguePlayers.reduce<Record<string, ('W' | 'L')[]>>((acc, player) => {
        acc[player.name] = getRecentForm(props.leagueGames, player.name, FORM_LENGTH);
        return acc;
    }, {});
});

const getFormSlots = (playerName: string) => {
    const form = recentFormByName.value[playerName] ?? [];
    return [...Array(FORM_LENGTH - form.length).fill(null), ...form] as ('W' | 'L' | null)[];
};

const onRowClick = (event: any) => {
    if (event.data.withdrawn) return;
    emit('select-player', event.data.name);
}

const labels = useTableLabels();
</script>

<style scoped>
.league-withdrawn-hint {
    font-size: 0.6875rem;
    color: var(--bp-text-muted);
    line-height: 1.2;
}

.league-form {
    display: flex;
    gap: 0.125rem;
}
.league-form-item {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    border-radius: 0.1875rem;
    background: var(--bp-fill);
    color: white;
    font-size: 0.5625rem;
    font-weight: 700;
}
.league-form-win { background: #1F9D55; }
.league-form-loss { background: #D64545; }

/* Mobil: kleinere Trend-Felder, damit der Trend ohne Wischen sichtbar ist */
@media (width <= 900px) {
    .league-form-item {
        width: 0.875rem;
        height: 0.875rem;
        font-size: 0.5rem;
    }
}

/* Mobil: lange Namen brechen in eine zweite Zeile um statt abgekuerzt zu werden */
@media (width <= 900px) {
    .league-standings :deep(.bp-name) {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-height: 1.2;
        white-space: normal;
        overflow-wrap: anywhere;
    }
}
</style>
