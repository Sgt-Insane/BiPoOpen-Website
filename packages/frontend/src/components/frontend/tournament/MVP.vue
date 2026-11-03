<template>
    <div class="MVP">

        <div style="text-align: center; font-size: 18px; color: var(--main-color);" v-if="tournament.groupPhase.groups.length == 0">
            Die MVP-Liste ist noch nicht verfügbar
        </div>

        <div v-else>

            <DataTable
                :value="mvpList"
                @row-click="onRowClick"
                rowHover
                scrollable
                sortField="averageHits"
                :sortOrder="-1"
            >

                <!-- Platz -->
                <Column header="#" frozen class="bp-col-rank">
                    <template #body="{ data }">
                        <span class="bp-rank" :class="`bp-rank-${data.placement + 1}`">{{ data.placement + 1 }}</span>
                    </template>
                </Column>

                <!-- Name -->
                <Column header="Name" frozen>
                    <template #body="slotProps">
                        <div class="bp-name-cell">
                            <Avatar :name="slotProps.data.name"/>
                            <span class="bp-name">{{ slotProps.data.name }}</span>
                        </div>
                    </template>
                </Column>

                <!-- Trefferquote -->
                <Column field="averageHits" sortable :header="labels.hitRate" class="bp-col-strong">
                    <template #body="slotProps">
                        {{ slotProps.data.averageHits.toFixed(2) }}
                    </template>
                </Column>

                <!-- Treffer -->
                <Column field="hits" sortable :header="labels.hits"/>

                <!-- Spiele -->
                <Column field="ammountOfMatches" sortable :header="labels.games"/>

            </DataTable>
        </div>

    </div>
</template>

<script setup lang="ts">
import { computed, inject, PropType } from "vue"
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Avatar from '@/components/shared/Avatar.vue';
import { useTableLabels } from '@/components/shared/table';
import { getMVPList } from "@/util/tournamentPlayerFunctions";

let props = defineProps({
   tournament: {type: Object as PropType<Tournament>, required: true }
});

const labels = useTableLabels();

const mvpList = computed(() => {
    if(props.tournament == undefined)
        return [];

    // getMVPList returns the players ranked by averageHits (tiebreak: drunken cups);
    // PrimeVue's DataTable handles column sorting from here.
    return getMVPList(props.tournament);
})

const openPlayerProfile = inject<(name: string) => void>('openPlayerProfile');

const onRowClick = (event: { data: PlayerWithStats }) => {
    openPlayerProfile?.(event.data.name);
}
</script>
