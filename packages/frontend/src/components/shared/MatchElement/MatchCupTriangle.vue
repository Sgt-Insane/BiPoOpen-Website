<template>
    <!-- Becher-Dreieck: je Team, welcher Becher wann und von wem abgeraeumt wurde -->
    <div v-if="racks" class="MatchCupTriangle">
        <div v-for="rack in racks" :key="rack.ownerIndex" class="mct-rack">
            <div class="mct-rack-title" :style="{ '--mct-color': getTeamColor(match, rack.ownerIndex) }">
                Becher von {{ getTeamName(match, rack.ownerIndex) }}
            </div>
            <div class="mct-phases">
                <div v-for="(phase, phaseIndex) in rack.phases" :key="phaseIndex" class="mct-phase">
                    <div v-if="rack.phases.length > 1" class="mct-phase-label">{{ phase.label }}</div>
                    <!-- Aus Sicht des Werfers: hinten 7-10 oben, Spitze 1 unten -->
                    <div class="mct-triangle">
                        <div v-for="(row, rowIndex) in ROWS" :key="rowIndex" class="mct-row">
                            <template v-for="number in row" :key="number">
                                <div
                                    v-if="phase.falls[number - 1]"
                                    class="mct-cup mct-cup--fell"
                                    :style="{ '--mct-color': getTeamColor(match, phase.falls[number - 1].teamIndex) }"
                                    v-hint="describe(phase.falls[number - 1], number)"
                                >
                                    <span class="mct-minute">{{ phase.falls[number - 1].minute !== null ? `${phase.falls[number - 1].minute}'` : `#${phase.falls[number - 1].order}` }}</span>
                                    <span class="mct-player">{{ initials(phase.falls[number - 1]) }}</span>
                                </div>
                                <!-- Stand am Ende des Abschnitts noch: im letzten Abschnitt bis zum Schluss, sonst beim Re-Rack umgestellt -->
                                <div v-else-if="phase.standingAtStart.includes(number - 1)" class="mct-cup" :class="phaseIndex === rack.phases.length - 1 ? 'mct-cup--standing' : 'mct-cup--moved'" :style="{ '--mct-color': getTeamColor(match, rack.ownerIndex) }">{{ number }}</div>
                                <div v-else class="mct-cup mct-cup--empty"></div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="mct-legend">Minute, in der der Becher fiel, und wer ihn getroffen hat · volle Becher standen am Ende noch<template v-if="hasPhases"> · umrandete wurden beim Re-Rack umgestellt</template></div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getPlayerName, getTeamColor, getTeamName } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';
import { buildCupHistory, type CupFall } from './cupHistory';

const props = defineProps<{ match: Match }>();

const ROWS = [[7, 8, 9, 10], [4, 5, 6], [2, 3], [1]];
const racks = computed(() => buildCupHistory(props.match));
const hasPhases = computed(() => racks.value?.some(rack => rack.phases.length > 1) ?? false);

// Kuerzel: Vorname-Initialen, bei Gleichheit im Spiel die ersten zwei Buchstaben
const initials = (fall: CupFall) => {
    const name = getPlayerName(props.match, fall.teamIndex, fall.playerIndex) ?? '';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.slice(0, 2);
};

const KIND_LABELS: Partial<Record<Turn['type'], string>> = { bomb: 'Bombe', bouncer: 'Bouncer', trickshot: 'Trickshot', deathcup: 'Deathcup', owncup: 'eigener Becher', penalty: 'Strafbier', lastCup: 'letzter Becher' };
const describe = (fall: CupFall, number: number) => {
    const who = getPlayerName(props.match, fall.teamIndex, fall.playerIndex);
    const kind = KIND_LABELS[fall.kind];
    return `Becher ${number}: ${fall.minute !== null ? `${fall.minute}. Minute` : `${fall.order}. Becher`}, ${who}${kind ? ` (${kind})` : ''}`;
};
</script>

<style scoped>
.MatchCupTriangle{
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.mct-rack{
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.mct-rack-title{
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.mct-rack-title::before{
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--mct-color);
}
.mct-phases{
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
}
.mct-phase{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}
.mct-phase-label{
    font-size: 11px;
    font-weight: 700;
    color: var(--bp-text-muted);
}
.mct-triangle{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
}
.mct-row{
    display: flex;
    gap: 3px;
}
.mct-cup{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
}
/* Gefallen: Farbe des werfenden Teams, Minute gross, Kuerzel klein */
.mct-cup--fell{
    background: color-mix(in srgb, var(--mct-color) 18%, var(--bp-surface));
    border: 2px solid var(--mct-color);
    color: var(--bp-text-strong);
}
.mct-minute{
    font-size: 12px;
    font-weight: 800;
}
.mct-player{
    margin-top: 1px;
    font-size: 9px;
    color: var(--bp-text-muted);
}
/* Stand am Ende noch */
.mct-cup--standing{
    background: var(--mct-color);
    color: white;
}
/* Beim Re-Rack umgestellt */
.mct-cup--moved{
    border: 2px solid var(--mct-color);
    color: var(--mct-color);
}
/* In diesem Abschnitt gar nicht aufgestellt */
.mct-cup--empty{
    border: 1.5px dashed var(--bp-border);
}
.mct-legend{
    font-size: 11px;
    color: var(--bp-text-muted);
}
</style>
