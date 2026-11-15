
<template>

    <LeaguePlayerOverviewDrawer
        v-model:visible="leaguePlayerOverviewVisible"
        :selectedPlayer="selectedLeaguePlayer"
        :leaguePlayers="leaguePlayers"
        :leagueGames="games"
        :divisionLabel="props.divisionLabel"
        :canAddGames="props.canAddGames"
    />

    <!-- lazy: nur die aktive Tabelle wird gerendert -->
    <Tabs v-model:value="activeTableTab" class="p-tabs-chips" lazy>
        <TabList v-if="hasRueckrunde" ref="tabList" class="league-table-sticky-tablist pt-[12px] pb-[12px]" :style="{ top: tabListTop }">
            <Tab value="overall">Gesamt</Tab>
            <Tab value="hinrunde">Hinrunde</Tab>
            <Tab value="rueckrunde">Rückrunde</Tab>
        </TabList>

        <TabPanels :class="hasRueckrunde ? '!pt-[0px]' : '!pt-[12px]'">
            <TabPanel value="overall">
                <LeagueStandingsTable
                    :leaguePlayers="props.leaguePlayers"
                    :leagueGames="games"
                    :highlightTopSlots="props.highlightTopSlots"
                    :promotionSlots="props.promotionSlots"
                    :relegationSlots="props.relegationSlots"
                    @select-player="openPlayerOverview"
                />
            </TabPanel>

            <!-- Auf-/Abstiegs- und Final-4-Plaetze gibt es nur in der Gesamttabelle -->
            <TabPanel value="rueckrunde">
                <LeagueStandingsTable
                    :leaguePlayers="props.leaguePlayers"
                    :leagueGames="leagueGamesByRound.rueckrunde"
                    :highlightTopSlots="0"
                    :promotionSlots="0"
                    :relegationSlots="0"
                    @select-player="openPlayerOverview"
                />
            </TabPanel>

            <TabPanel value="hinrunde">
                <LeagueStandingsTable
                    :leaguePlayers="props.leaguePlayers"
                    :leagueGames="leagueGamesByRound.hinrunde"
                    :highlightTopSlots="0"
                    :promotionSlots="0"
                    :relegationSlots="0"
                    @select-player="openPlayerOverview"
                />
            </TabPanel>

        </TabPanels>
    </Tabs>
</template>

<script setup lang="ts">
import { computed, ref, watch, type ComponentPublicInstance } from 'vue';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import { splitLeagueGamesByRound } from './LeagueUtilFunctions';
import LeaguePlayerOverviewDrawer from './LeaguePlayerOverviewDrawer.vue';
import LeagueStandingsTable from './LeagueStandingsTable.vue';
import { useStickyBar } from '@/components/shared/useStickyStack';

const props = defineProps({
    leaguePlayers: { type: Array as () => LeaguePlayer[], required: true },
    leagueGames: { type: Array as () => Match[], required: true },
    regularSeasonGameCount: { type: Number, required: true },
    highlightTopSlots: { type: Number, default: 4 },
    promotionSlots: { type: Number, default: 0 },
    relegationSlots: { type: Number, default: 3 },
    divisionLabel: { type: String, required: false },
    canAddGames: { type: Boolean, default: false }
});

const activeTableTab = ref('overall');

// Der Tabellenkopf klebt direkt unter diesen Reitern.
const tabList = ref<ComponentPublicInstance | null>(null);
const tabListTop = useStickyBar(tabList);
const leaguePlayerOverviewVisible = ref(false);
const selectedLeaguePlayer = ref<LeaguePlayer | undefined>(undefined);

// Nur die Hauptrunde zaehlt fuer die Tabelle, die Final-Four-Spiele kommen danach.
let games = computed(() => props.leagueGames.toReversed().toSpliced(props.regularSeasonGameCount));
const leagueGamesByRound = computed(() => splitLeagueGamesByRound(games.value));

// Hin-/Rueckrunden-Reiter erst, sobald das erste Rueckrundenspiel gespielt ist.
const hasRueckrunde = computed(() => leagueGamesByRound.value.rueckrunde.length > 0);
watch(hasRueckrunde, (value) => {
    if (!value)
        activeTableTab.value = 'overall';
});

const openPlayerOverview = (playerName: string) => {
    const selectedPlayer = props.leaguePlayers.find(player => player.name === playerName);
    if (!selectedPlayer)
        return;

    selectedLeaguePlayer.value = selectedPlayer;
    leaguePlayerOverviewVisible.value = true;
}
</script>

<style scoped>
:deep(.p-tablist.league-table-sticky-tablist) {
    position: sticky;
    z-index: 3;
    background: var(--page-gray);
}
</style>