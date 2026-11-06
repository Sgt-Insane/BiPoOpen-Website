<template>
    <div class="KnechtGameOver">
        <div class="kn-over-scroll">
            <!-- Kopf: Sieger und Ergebnis -->
            <div class="kn-over-head" :style="{ '--kn-team-color': TEAM_COLORS[winner] }">
                <div class="kn-over-trophy">🏆</div>
                <div class="kn-over-winner">{{ getTeamName(match, winner) }} gewinnt!</div>
                <div class="kn-over-score">
                    <span :style="{ color: TEAM_COLORS[0] }">{{ formatPoints(teamPoints[0]) }}</span>
                    <span class="kn-over-colon">:</span>
                    <span :style="{ color: TEAM_COLORS[1] }">{{ formatPoints(teamPoints[1]) }}</span>
                </div>
                <div class="kn-over-teams">{{ getTeamName(match, 0) }} gegen {{ getTeamName(match, 1) }}</div>
                <div class="kn-over-reason">{{ reasonText }}<template v-if="duration"> · {{ duration }}</template></div>
            </div>

            <!-- Schritt 1: Auszeichnungen -->
            <template v-if="step === 'awards'">
                <div class="kn-over-section-title">Auszeichnungen</div>
                <div class="kn-awards">
                    <div v-for="(award, index) in awards" :key="index" class="kn-award" :style="{ '--kn-team-color': TEAM_COLORS[stats[index].teamIndex] }">
                        <span class="kn-award-icon">{{ award.icon }}</span>
                        <span class="kn-award-text">
                            <span class="kn-award-title">{{ award.title }}</span>
                            <span class="kn-award-player">{{ stats[index].name }}</span>
                            <span class="kn-award-detail">{{ award.detail }}</span>
                        </span>
                    </div>
                </div>
            </template>

            <!-- Schritt 2: Zusammenfassung, Verlauf bearbeiten, Schiedsrichter -->
            <template v-else>
                <div class="kn-over-section-title">Punktestand</div>
                <KnechtScoreboard :match="match" :state="game.state.value" />

                <div class="kn-over-section-title">
                    Spielverlauf
                    <span class="kn-over-section-hint">Antippen zum Korrigieren</span>
                </div>
                <KnechtTimeline :match="match" :state="game.state.value" editable @edit="editTurn = $event" />

                <template v-if="refereeUsed">
                    <label class="kn-over-section-title" for="kn-referee">Schiedsrichter</label>
                    <input id="kn-referee" v-model="referee" class="kn-referee" type="text" maxlength="40" placeholder="Name (optional)" autocomplete="off" />
                </template>

                <div v-if="isDev" class="kn-over-dev">Entwicklungsmodus: das Spiel wird nicht in die Datenbank geschrieben.</div>
            </template>
        </div>

        <div class="kn-over-footer">
            <template v-if="step === 'awards'">
                <button type="button" class="kn-over-button kn-over-button-secondary" @click="game.undo()">
                    <i class="pi pi-undo"></i>
                </button>
                <button type="button" class="kn-over-button kn-over-button-primary" @click="step = 'summary'">
                    Weiter zur Zusammenfassung
                </button>
            </template>
            <template v-else>
                <button type="button" class="kn-over-button kn-over-button-secondary" :disabled="saving" title="Speichern und Revanche" @click="save(true)">
                    <i class="pi pi-replay"></i>
                </button>
                <button type="button" class="kn-over-button kn-over-button-primary" :disabled="saving" @click="save(false)">
                    <i v-if="saving" class="pi pi-spin pi-spinner"></i>
                    <span v-else>{{ saveLabel }}</span>
                </button>
            </template>
        </div>

        <KnechtSheet :visible="editTurn !== null" title="Eintrag korrigieren" subtitle="Der Rest des Spiels wird neu berechnet" @update:visible="editTurn = null">
            <KnechtTurnEditor v-if="editTurn !== null" :game="game" :turnIndex="editTurn" @done="editTurn = null" />
        </KnechtSheet>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import KnechtScoreboard from './KnechtScoreboard.vue';
import KnechtTimeline from './KnechtTimeline.vue';
import KnechtSheet from './KnechtSheet.vue';
import KnechtTurnEditor from './KnechtTurnEditor.vue';
import { getTeamPoints } from './knechtEngine';
import {
    TEAM_COLORS, buildKnechtMatch, formatDuration, formatPoints, getAwards, getPlayerStats, getSaveLabel, getTeamName, saveKnechtGame,
} from './KnechtUtilFunctions';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const props = defineProps<{ game: BiPoKnechtGame; refereeUsed: boolean }>();
const emit = defineEmits<{ saved: [match: Match, rematch: boolean] }>();

const toast = useToast();
const isDev = import.meta.env.DEV;
const match = props.game.match;

const step = ref<'awards' | 'summary'>('awards');
const editTurn = ref<number | null>(null);
const referee = ref('');
const saving = ref(false);
let saved = false;

const state = computed(() => props.game.state.value);
const winner = computed(() => state.value.winnerTeamIndex ?? 0);
const teamPoints = computed(() => getTeamPoints(state.value));
const stats = computed(() => getPlayerStats(match, state.value));
const awards = computed(() => getAwards(stats.value));
const duration = computed(() => formatDuration(match.time, state.value.turns.at(-1)?.time));
const saveLabel = getSaveLabel(match.time ?? 0);

const reasonText = computed(() => {
    const overtime = state.value.overtimeCount ? ` (nach ${state.value.overtimeCount}. Verlängerung)` : '';
    switch (state.value.endReason) {
        case 'doubleLastCup': return `Zwei Bälle im letzten Becher – Sofortsieg${overtime}`;
        case 'nachwurfDouble': return `Im Nachwurf mit zwei Bällen im letzten Becher gewonnen${overtime}`;
        case 'deathcup': return `💀 Deathcup – Sofortsieg${overtime}`;
        case 'owncup': return `Gegner hat den letzten eigenen Becher runtergeworfen${overtime}`;
        default: return state.value.markers.some(marker => marker.kind === 'nachwurf')
            ? `Alle Becher getroffen, Nachwurf verfehlt${overtime}`
            : `Alle Becher getroffen${overtime}`;
    }
});

const save = async (rematch: boolean) => {
    if (saving.value || saved) return;
    saving.value = true;
    const result = buildKnechtMatch(match, state.value, props.refereeUsed ? referee.value : undefined);
    let success = false;
    try {
        success = await saveKnechtGame(result);
    } catch {
        success = false;
    }
    saving.value = false;

    if (!success) {
        toast.add({ severity: 'error', summary: 'Spiel nicht gespeichert – bitte nochmal versuchen', life: 4000 });
        return;
    }
    saved = true;
    emit('saved', result, rematch);
};
</script>

<style scoped>
.KnechtGameOver{
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    flex-direction: column;
    background: var(--page-gray);
}
.kn-over-scroll{
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 24px;
}

.kn-over-head{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 20px 16px;
    border: 1px solid #E6E8EB;
    border-top: 5px solid var(--kn-team-color);
    border-radius: 20px;
    background: white;
    text-align: center;
}
.kn-over-trophy{
    font-size: 40px;
    line-height: 1.1;
}
.kn-over-winner{
    font-size: 26px;
    font-weight: 800;
    color: var(--main-color);
    line-height: 1.2;
}
.kn-over-score{
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-top: 6px;
    font-size: 44px;
    font-weight: 800;
    line-height: 1;
}
.kn-over-colon{
    color: #B5B9C0;
}
.kn-over-teams{
    font-size: 14px;
    font-weight: 600;
    color: #3A3F46;
}
.kn-over-reason{
    font-size: 13px;
    color: #6B7079;
}

.kn-over-section-title{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 20px 4px 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: #555B63;
}
.kn-over-section-hint{
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    color: #8A9099;
}

.kn-awards{
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.kn-award{
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px;
    border: 1px solid #E6E8EB;
    border-left: 5px solid var(--kn-team-color);
    border-radius: 16px;
    background: white;
    animation: kn-award-in .4s ease both;
}
.kn-award:nth-child(2){ animation-delay: .1s; }
.kn-award:nth-child(3){ animation-delay: .2s; }
.kn-award:nth-child(4){ animation-delay: .3s; }
.kn-award-icon{
    font-size: 34px;
}
.kn-award-text{
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.kn-award-title{
    font-size: 17px;
    font-weight: 800;
    color: #1F2328;
}
.kn-award-player{
    font-size: 13px;
    font-weight: 700;
    color: var(--kn-team-color);
}
.kn-award-detail{
    font-size: 13px;
    color: #6B7079;
}
@keyframes kn-award-in{
    from{ opacity: 0; transform: translateY(12px); }
    to{ opacity: 1; transform: none; }
}

.kn-referee{
    width: 100%;
    height: 48px;
    padding: 0 14px;
    border: 1px solid #D3D6DB;
    border-radius: 12px;
    background: white;
    color: #1F2328;
    font: inherit;
    font-size: 16px;
    outline: none;
}
.kn-referee:focus{
    border-color: var(--main-color);
}
.kn-over-dev{
    margin-top: 16px;
    padding: 10px 12px;
    border-radius: 12px;
    background: #FFF8E6;
    color: #8A5A00;
    font-size: 13px;
}

.kn-over-footer{
    display: flex;
    gap: 8px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid #E6E8EB;
    background: white;
}
.kn-over-button{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 52px;
    border: none;
    border-radius: 14px;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
}
.kn-over-button-primary{
    flex: 1;
    background: var(--main-color);
    color: white;
}
.kn-over-button-secondary{
    width: 52px;
    min-width: 52px;
    border: 1px solid #E6E8EB;
    background: white;
    color: #3A3F46;
}
.kn-over-button:disabled{
    opacity: .6;
    cursor: default;
}
</style>
