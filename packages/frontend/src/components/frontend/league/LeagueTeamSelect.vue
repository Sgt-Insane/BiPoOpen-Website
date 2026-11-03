<template>
    <!-- Team-Auswahl fuer den GameEntryDrawer (#player-Slot) -->
    <Select
        :modelValue="selectedTeam"
        :options="options"
        optionLabel="name"
        dataKey="name"
        scrollHeight="320px"
        placeholder="Team wählen"
        class="LeagueTeamSelect"
        :pt="{ root: { style: '--p-select-focus-border-color: #1F2328;' } }"
        @update:modelValue="(team: LeaguePlayer | null) => emit('update:modelValue', team?.name ?? '')"
    >
        <template #value="slotProps">
            <div class="lt-value">
                <Avatar v-if="slotProps.value" :name="slotProps.value.name" :avatarImage="slotProps.value.logo" shape="square" class="lt-avatar" />
                <span v-else class="lt-avatar lt-avatar--empty">?</span>
                <span class="lt-name" :class="{ 'lt-placeholder': !slotProps.value }">{{ slotProps.value?.name ?? slotProps.placeholder }}</span>
                <EloChip v-if="slotProps.value" :rating="getElo(slotProps.value.name)" />
            </div>
        </template>
        <template #option="slotProps">
            <div class="lt-value">
                <Avatar :name="slotProps.option.name" :avatarImage="slotProps.option.logo" shape="square" class="lt-avatar" />
                <span class="lt-name">{{ slotProps.option.name }}</span>
                <EloChip :rating="getElo(slotProps.option.name)" />
            </div>
        </template>
    </Select>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Select from 'primevue/select';
import Avatar from '@/components/shared/Avatar.vue';
import EloChip from '@/components/shared/EloChip.vue';
import { useEloRatings } from '@/components/shared/useEloRatings';

const props = withDefaults(defineProps<{
    modelValue: string;
    teams: LeaguePlayer[];
    excludedNames?: string[];   // z.B. das Team der anderen Seite
}>(), {
    excludedNames: () => [],
});

const emit = defineEmits<{ 'update:modelValue': [name: string] }>();

// Elo des Spielers hinter dem Team
const { loadEloRatings, getElo } = useEloRatings();
loadEloRatings();

// Altdaten koennen Teams enthalten, die es in der Liga nicht mehr gibt: trotzdem anzeigen.
const selectedTeam = computed(() =>
    props.modelValue ? props.teams.find(team => team.name === props.modelValue) ?? { name: props.modelValue, logo: '' } : null
);

const options = computed(() => {
    const teams = props.teams.filter(team => !props.excludedNames.includes(team.name));
    return selectedTeam.value && !teams.some(team => team.name === selectedTeam.value!.name) ? [selectedTeam.value, ...teams] : teams;
});
</script>

<style scoped>
.LeagueTeamSelect{
    width: 100%;
    height: 48px;
    align-items: center;
    border-radius: 10px;
}
.lt-value{
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    color: #1F2328;
}
.lt-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.lt-placeholder{
    color: #9AA0A8;
    font-weight: 500;
}
.lt-avatar{
    width: 32px !important;
    height: 32px !important;
    min-width: 32px;
    font-size: 12px !important;
}
.lt-avatar--empty{
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: #F1F2F4;
    color: #8A9099;
    font-weight: 700;
}
:deep(.p-select-label){
    padding-left: 8px;
}
</style>
