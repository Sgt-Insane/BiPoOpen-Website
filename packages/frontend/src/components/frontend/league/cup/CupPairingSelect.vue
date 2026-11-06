<template>
    <!-- Paarungsauswahl fuer den GameEntryDrawer (#top-Slot) -->
    <div class="CupPairingSelect">
        <div class="cp-label">Paarung</div>
        <Select
            v-model="selectedPairing"
            :options="openPairings"
            scrollHeight="320px"
            placeholder="Paarung wählen"
            class="cp-select"
            :pt="{ root: { style: '--p-select-focus-border-color: var(--bp-text-strong);' } }"
        >
            <template #value="slotProps">
                <div class="cp-value">
                    <span class="cp-value-text" :class="{ 'cp-placeholder': !slotProps.value }">
                        {{ slotProps.value ? `${slotProps.value.team1} vs. ${slotProps.value.team2}` : slotProps.placeholder }}
                    </span>
                    <span class="cp-count">{{ openPairings.length }} offen</span>
                </div>
            </template>
            <template #option="slotProps">
                <!-- Feste Spalten: Team 1 links, vs. mittig, Team 2 rechts - lange Namen brechen nur in ihrer Spalte um -->
                <div class="cp-option">
                    <div class="cp-team">
                        <Avatar :name="slotProps.option.team1" :avatarImage="getLeagueTeamLogo(slotProps.option.team1, leagueCup.season)" shape="square" class="cp-avatar" />
                        <span class="cp-team-name">{{ slotProps.option.team1 }}</span>
                    </div>
                    <span class="cp-vs">vs.</span>
                    <div class="cp-team cp-team--right">
                        <span class="cp-team-name">{{ slotProps.option.team2 }}</span>
                        <Avatar :name="slotProps.option.team2" :avatarImage="getLeagueTeamLogo(slotProps.option.team2, leagueCup.season)" shape="square" class="cp-avatar" />
                    </div>
                </div>
            </template>
        </Select>
    </div>
</template>

<script setup lang="ts">
import { computed, PropType, ref, watch } from 'vue';
import Select from 'primevue/select';
import Avatar from '@/components/shared/Avatar.vue';
import { getLeagueTeamLogo } from '../LeaguePlayersData';
import { getCupRoundGames, getPairingResult } from './LeagueCupUtilFunctions';

const props = defineProps({
    leagueCup: { type: Object as PropType<LeagueCup>, required: true },
    roundIndex: { type: Number, required: true },
    cupGames: { type: Array as () => Match[], required: true },
});

const emit = defineEmits<{ select: [teams: { name: string; logo?: string }[]] }>();

const round = computed(() => props.leagueCup.rounds[props.roundIndex]);

// Nur Paarungen ohne Sieger (im Best-of-3 also bis eine Seite 2 Siege hat).
const openPairings = computed(() => {
    const roundGames = getCupRoundGames(props.cupGames, props.roundIndex);
    return round.value?.pairings.filter(pairing => !getPairingResult(pairing, roundGames, round.value.bestOf).winner) ?? [];
});

// Gibt es nur eine offene Paarung, ist sie direkt gewaehlt.
const selectedPairing = ref<LeagueCupPairing | null>(openPairings.value.length === 1 ? openPairings.value[0] : null);

watch(selectedPairing, (pairing) => {
    if (!pairing) return;
    emit('select', [pairing.team1, pairing.team2].map(name => ({ name, logo: getLeagueTeamLogo(name, props.leagueCup.season) })));
}, { immediate: true });
</script>

<style scoped>
.cp-label{
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--bp-text-secondary);
}
.cp-select{
    width: 100%;
    height: 48px;
    align-items: center;
    border-radius: 10px;
}
.cp-value{
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}
.cp-value-text{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 600;
    color: var(--bp-text-strong);
}
.cp-placeholder{
    color: var(--bp-text-faint);
    font-weight: 500;
}
.cp-count{
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-secondary);
    font-size: 12px;
    font-weight: 600;
}
.cp-option{
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    width: 100%;
}
.cp-team{
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}
.cp-team--right{
    justify-content: flex-end;
    text-align: right;
}
.cp-team-name{
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    font-size: 14px;
    line-height: 1.25;
    overflow-wrap: anywhere;
}
.cp-vs{
    color: gray;
    font-size: 12px;
    font-style: italic;
}
.cp-avatar{
    width: 28px !important;
    height: 28px !important;
    min-width: 28px;
}
</style>
