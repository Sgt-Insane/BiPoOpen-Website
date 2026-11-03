<template>
    <DataTable :value="teams" scrollable class="mb-[30px]">

        <!-- Nummer -->
        <Column header="#" frozen class="bp-col-rank">
            <template #body="slotProps">
                <span class="bp-rank">{{ slotProps.index + 1 }}</span>
            </template>
        </Column>

        <!-- Team -->
        <Column header="Team" frozen>
            <template #body="slotProps">
                <div class="bp-name-cell">
                    <Image
                        v-if="slotProps.data.logo"
                        class="team-logo-preview"
                        :src="slotProps.data.logo"
                        preview
                        :pt="{
                            toolbar: { style: 'display: none' },
                            previewMask: { style: 'background: transparent; opacity: 0' },
                            mask: { style: 'background-color: rgba(0, 0, 0, 0.9) !important' }
                        }"
                    />
                    <Avatar v-else :name="slotProps.data.name" shape="square"/>
                    <span class="bp-name whitespace-normal">{{ slotProps.data.name }}</span>
                </div>
            </template>
        </Column>

        <!-- Spieler -->
        <Column header="Spieler" class="bp-col-start">
            <template #body="slotProps">
                <span v-for="player in slotProps.data.players" :key="player._id" class="block">{{ player.name }}</span>
            </template>
        </Column>

    </DataTable>
</template>

<script setup lang="ts">
import { PropType, computed } from "vue"
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Image from 'primevue/image';
import Avatar from '@/components/shared/Avatar.vue';
import { getAllTeams } from '@/util/tournamentTeamFunctions';

const props = defineProps({
   tournament: {type: Object as PropType<Tournament>, required: true },
})

const teams = computed(() => getAllTeams(props.tournament));
</script>

<style scoped>
/* Logo in Avatar-Groesse, Klick oeffnet die Vorschau */
.team-logo-preview {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
}
.team-logo-preview :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    cursor: pointer;
}
</style>
