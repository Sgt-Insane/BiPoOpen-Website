<template>
    <DataTable
        :value="group.teams"
        @row-click="onRowClick"
        rowHover
        scrollable
        class="group-standings mb-[30px]"
    >

        <!-- Platz: die ersten beiden kommen weiter -->
        <Column header="#" frozen class="bp-col-rank">
            <template #body="{ index }">
                <span class="bp-rank" :class="{ 'bp-zone-qualify': index < 2 }">{{ index + 1 }}</span>
            </template>
        </Column>

        <!-- Teamname -->
        <Column header="Team" frozen>
            <template #body="slotProps">
                <div class="bp-name-cell">
                    <Avatar :name="slotProps.data.name" :avatarImage="slotProps.data.logo" shape="square"/>
                    <span class="bp-name">{{ slotProps.data.name }}</span>
                </div>
            </template>
        </Column>

        <!-- Spieler -->
        <Column v-if="!isMobile" header="Spieler" class="bp-col-start">
            <template #body="slotProps">
                <span v-for="player in slotProps.data.players" :key="player._id" class="block">{{ player.name }}</span>
            </template>
        </Column>

        <!-- Siege -->
        <Column :header="labels.wins" field="wins" class="bp-col-strong"/>

        <!-- Spiele -->
        <Column :header="labels.games" field="ammountOfMatches"/>

        <!-- Trefferdifferenz, Antippen zeigt die Treffer (öffnet nicht das Team) -->
        <Column :header="labels.diff">
            <template #body="slotProps">
                <span
                    v-tooltip.top.focus="`${slotProps.data.hitDifference} Treffer`"
                    tabindex="0"
                    class="bp-tooltip-target"
                    :class="getDiffClass(slotProps.data.hitDifferenceNumber)"
                    @click.stop
                >{{ formatDiff(slotProps.data.hitDifferenceNumber) }}</span>
            </template>
        </Column>

    </DataTable>

    <StandingsGroupTeamDrawer v-model:visible="drawerVisible" :selected-team="selectedTeam" :tournament="tournament"/>
</template>

<script setup lang="ts">
import { PropType, ref } from "vue"
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Avatar from '@/components/shared/Avatar.vue';
import { formatDiff, getDiffClass, useIsMobile, useTableLabels } from '@/components/shared/table';
import StandingsGroupTeamDrawer from '@/components/frontend/tournament/StandingsGroupTeamDrawer.vue';

defineProps({
   tournament: {type: Object as PropType<Tournament>, required: true },
   group: {type: Object as PropType<GroupWithStats>, required: true },
})

const drawerVisible = ref(false);
const selectedTeam = ref<TeamWithStats>();

const onRowClick = (event: { data: TeamWithStats }) => {
    selectedTeam.value = event.data;
    drawerVisible.value = true;
};

const isMobile = useIsMobile();
const labels = useTableLabels();
</script>

<style scoped>
/* Teamnamen nie abkuerzen: ohne feste Maximalbreite nimmt die Spalte den freien Platz,
   umgebrochen wird erst, wenn die Tabelle sonst nicht mehr passt */
.group-standings :deep(.bp-name) {
    overflow: visible;
    max-width: none;
    line-height: 1.2;
    white-space: normal;
    text-overflow: clip;
    overflow-wrap: break-word;
}

/* Groessere Logos als in den anderen Tabellen (theme.ts) */
.group-standings :deep(.p-datatable-tbody .p-avatar) {
    --bp-avatar-size: 2.75rem;
}
/* Mobil: 32px bei 360px Viewport bis max. 40px ab 450px */
@media (width <= 900px) {
    .group-standings :deep(.p-datatable-tbody .p-avatar) {
        --bp-avatar-size: clamp(2rem, calc(2rem + (100vw - 360px) * 0.0889), 2.5rem);
    }
}
</style>
