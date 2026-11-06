<template>

    <div style="text-align: center; font-size: 18px; color: var(--main-color);" v-if="tournament.groupPhase.groups.length == 0">
        K.o.Phase noch nicht verfügbar
    </div>

    <div v-else>
        <div v-if="bracketRounds.length" class="tb-bracket">
            <template v-for="(round, rIndex) in bracketRounds" :key="rIndex">
                <div class="tb-round" :class="{'tb-round--connected': rIndex > 0}">
                    <div class="tb-round-title">{{ round.name }}</div>
                    <div class="tb-matches">
                        <!-- Non-final rounds: group into pairs for connector lines -->
                        <template v-if="rIndex < bracketRounds.length - 1">
                            <div v-for="(pair, pIndex) in getMatchPairs(round.matches)" :key="pIndex" class="tb-pair">
                                <div v-for="(match, mIndex) in pair" :key="mIndex" class="tb-slot">
                                    <div class="tb-match">
                                        <MatchElement :match="match"  :isBackend="isBackend" @edit="openEdit"
                                            :team1Placeholder="getKOPlaceholderName(tournament, rIndex, pIndex*2+mIndex, false)"
                                            :team2Placeholder="getKOPlaceholderName(tournament, rIndex, pIndex*2+mIndex, true)"/>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <!-- Final round: Finale + Spiel um Platz 3 -->
                        <template v-else>
                            <div class="tb-round-title">Finale</div>
                            <div class="tb-match">
                                <MatchElement :match="round.matches[0]"  :isBackend="isBackend" @edit="openEdit"
                                    :team1Placeholder="getKOPlaceholderName(tournament, rIndex, 0, false)"
                                    :team2Placeholder="getKOPlaceholderName(tournament, rIndex, 0, true)"/>
                            </div>
                            <template v-if="round.matches[1]">
                                <div class="tb-round-title tb-third-place-title">Spiel um Platz 3</div>
                                <div class="tb-match">
                                    <MatchElement :match="round.matches[1]"  :isBackend="isBackend" @edit="openEdit"
                                        :team1Placeholder="getKOPlaceholderName(tournament, rIndex, 1, false)"
                                        :team2Placeholder="getKOPlaceholderName(tournament, rIndex, 1, true)"/>
                                </div>
                            </template>
                        </template>
                    </div>
                </div>
            </template>
        </div>

        <GameEntryDrawer v-if="isBackend"
           v-model:visible="editVisible"
           :title="editingMatch && checkIfMatchFinished(editingMatch) ? 'Spiel bearbeiten' : 'Spiel eintragen'"
           :subtitle="`${tournament.name} · K.o.-Phase`"
           :initialSides="editSides"
           :sideLabels="['Team 1', 'Team 2']"
           lockedNames
           avatarShape="square"
           :save="saveGameResult"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import GameEntryDrawer from '@/components/shared/GameEntry/GameEntryDrawer.vue';
import { applySidesToMatch, useMatchEdit, type GameEntrySide } from '@/components/shared/GameEntry/gameEntry';
import { checkIfMatchFinished } from '@/util/tournamentMatchFunctions';
import { setGameResultKOPhase, getFirstStageSeeding } from '../../../util/tournamentKOPhaseFunctions';
import { convertNumberToCharacter } from '../../../util/util';

const props = defineProps({
    getTournament: {type: Function, required: true },
    tournament: { type: Object as PropType<Tournament>, required: true },
    isBackend: {type: Boolean, required: true },
});

const getStageText = (stageIndex: number) => {
    const total = props.tournament.koPhase.matches.length - 1;
    if (total - stageIndex === 3) return 'Achtelfinale';
    if (total - stageIndex === 2) return 'Viertelfinale';
    if (total - stageIndex === 1) return 'Halbfinale';
    if (total - stageIndex === 0) return 'Finale';
    return `Runde ${stageIndex + 1}`;
};

const getMatchPairs = (matches: Match[]) => {
    const pairs: Match[][] = [];
    for (let i = 0; i < matches.length; i += 2) {
        pairs.push(matches.slice(i, i + 2));
    }

    return pairs;
};

const bracketRounds = computed(() => {
    const ko = props.tournament.koPhase;
    if (!ko.matches.length) return [];
    return ko.matches.map((round, i) => ({
        name: getStageText(i),
        matches: round
    }));
});

const { editingMatch, editVisible, editSides, openEdit } = useMatchEdit();

const saveGameResult = async (sides: GameEntrySide[]) => {
    await setGameResultKOPhase(props.tournament, applySidesToMatch(editingMatch.value!, sides));
    await props.getTournament();

    return true;
}

const getKOPlaceholderName = (tournament:Tournament, stageIndex:number, matchIndex:number, isTeam2:boolean) => {
    if(stageIndex !== 0 || !tournament.koPhase.matches[0])
        return "TBD";

    const stageLength = tournament.koPhase.matches[0].length;
    const { group1Number, group2Number, placeGroup1, placeGroup2 } = getFirstStageSeeding(tournament, matchIndex, stageLength);

    const groupNumber = isTeam2 ? group2Number : group1Number;
    const place = isTeam2 ? placeGroup2 : placeGroup1;

    return `${place+1}. Gruppe ${convertNumberToCharacter(groupNumber + 1)}`;
}
</script>

<style scoped>
.tb-bracket {
    display: flex;
    overflow-x: auto;
    padding: 8px 0;
}

/* ── Round column ── */
.tb-round {
    display: flex;
    flex-direction: column;
    min-width: 350px;
    flex: 1;
    flex-shrink: 0;
    margin-right: 30px;
}
.tb-round:last-child {
    margin-right: 0;
}
.tb-round-title {
    font-size: 13px;
    color: var(--main-color);
    text-align: center;
    margin-bottom: 8px;
    font-weight: bold;
}
.tb-matches {
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1;
}

/* Sub-heading for the third-place match below the final */
.tb-third-place-title {
    margin-top: 20px;
}

/* ── Match card ── */
.tb-match {
    position: relative;
    width: 100%;
}

/* Incoming horizontal line from previous round */
.tb-round--connected .tb-match::before {
    content: '';
    position: absolute;
    top: 50%;
    left: -15px;
    width: 15px;
    height: 2px;
    background: var(--bp-border-strong);
    z-index: 1;
}

/* ── Pair (two matches feeding into one) ── */
.tb-pair {
    flex: 1;
    display: flex;
    flex-direction: column;
}

/* ── Slot (match wrapper inside a pair) ── */
.tb-slot {
    flex: 1;
    display: flex;
    align-items: center;
    position: relative;
    padding: 4px 0;
}

/* Horizontal line from match right to the vertical connector */
.tb-slot::after {
    content: '';
    position: absolute;
    top: 50%;
    right: -15px;
    width: 15px;
    height: 2px;
    background: var(--bp-border-strong);
}

/* Vertical connector: top slot → down to pair center */
.tb-slot:first-child:not(:only-child)::before {
    content: '';
    position: absolute;
    top: 50%;
    bottom: 0;
    right: -15px;
    width: 2px;
    background: var(--bp-border-strong);
}

/* Vertical connector: bottom slot → up to pair center */
.tb-slot:last-child:not(:only-child)::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 50%;
    right: -15px;
    width: 2px;
    background: var(--bp-border-strong);
}

/* ── MatchElement overrides ── */
.tb-match :deep(.Match) {
    margin-bottom: 0;
    padding: 5px 8px;
    border-color: var(--bp-border);
}
.tb-match :deep(.mt-team) {
    font-size: 13px;
    min-height: 26px;
}
.tb-match :deep(.mt-team-score) {
    padding: 3px 5px;
    width: 28px;
    font-size: 12px;
}
.tb-match :deep(.mt-team-player-name) {
    font-size: 8px;
}


/* ═══════ MOBILE ═══════ */
@media (width <= 900px) {
    .tb-round {
        min-width: 200px;
        margin-right: 24px;
    }
    .tb-round:last-child {
        margin-right: 0;
    }
    .tb-slot::after {
        right: -12px;
        width: 12px;
    }
    .tb-slot:first-child:not(:only-child)::before,
    .tb-slot:last-child:not(:only-child)::before {
        right: -12px;
    }
    .tb-round--connected .tb-match::before {
        left: -12px;
        width: 12px;
    }
    .tb-match :deep(.Match) {
        padding: 4px 6px;
    }
    .tb-match :deep(.mt-team) {
        font-size: 11px;
    }
    .tb-match :deep(.p-avatar) {
        min-width: 30px;
        min-height: 30px;
    }
}
</style>
