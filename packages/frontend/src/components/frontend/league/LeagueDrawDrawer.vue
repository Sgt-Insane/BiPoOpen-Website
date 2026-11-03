<template>
    <BottomSheet v-model:visible="drawerVisible" :closable="view === 'draw'">
        <template #header>
            <div v-if="view === 'draw'" class="ld-title">Spielauslosung</div>

            <div v-else class="ld-header-back">
                <button type="button" class="ld-back" aria-label="Zurück" @click="view = 'draw'">
                    <i class="pi pi-chevron-left"></i>
                </button>
                <div>
                    <div class="ld-title">Wer ist heute da?</div>
                    <div class="ld-subtitle">Nur diese Teams kommen ins Rad</div>
                </div>
            </div>
        </template>

        <!-- ─── Auslosung ─── -->
        <div v-if="view === 'draw'" class="ld-draw">
            <div class="ld-chips">
                <Select
                    v-if="leagueOptions.length > 1"
                    v-model="league"
                    :options="leagueOptions"
                    optionLabel="label"
                    optionValue="value"
                    aria-label="Liga"
                    :disabled="controlsLocked"
                    class="ld-chip ld-select"
                />
                <Select
                    v-model="round"
                    :options="ROUND_OPTIONS"
                    optionLabel="label"
                    optionValue="value"
                    :disabled="controlsLocked"
                    class="ld-chip ld-select"
                />
                <button type="button" class="ld-chip" :disabled="controlsLocked" @click="openParticipants()">
                    <i class="pi pi-users"></i>
                    <span>{{ participants.size }} von {{ leaguePlayers.length }} da</span>
                    <i class="pi pi-chevron-right ld-chip-chevron"></i>
                </button>
            </div>

            <div v-if="!wheelEntries.length" class="ld-empty">{{ emptyMessage }}</div>

            <template v-else>
                <div class="ld-wheel">
                    <LeagueWheel
                        ref="wheel"
                        :entries="wheelEntries"
                        :disabled="isRevealing || phase === 'result'"
                        @spin-start="isSpinning = true"
                        @spun="onSpun"
                    />
                </div>

                <div v-if="hiddenTeamCount" class="ld-hint">
                    {{ hiddenTeamCount }} {{ hiddenTeamCount === 1 ? 'Team hat' : 'Teams haben' }} in der {{ roundLabel }} keinen möglichen Gegner mehr und {{ hiddenTeamCount === 1 ? 'ist' : 'sind' }} ausgeblendet.
                </div>
            </template>

            <div v-if="wheelEntries.length || teamA" class="ld-card">
                <div class="ld-card-label">Ausgelost</div>

                <div class="ld-matchup">
                    <div class="ld-slot" :class="{ 'ld-slot-empty': !teamA }">
                        <div class="ld-avatar">
                            <img v-if="teamA" :src="teamA.logo" alt="" />
                            <span v-else>?</span>
                        </div>
                        <div class="ld-slot-name">{{ teamA?.name ?? 'Team' }}</div>
                    </div>

                    <div class="ld-vs">vs</div>

                    <div class="ld-slot" :class="{ 'ld-slot-empty': !teamB }">
                        <div class="ld-avatar">
                            <img v-if="teamB" :src="teamB.logo" alt="" />
                            <span v-else>?</span>
                        </div>
                        <div class="ld-slot-name">{{ teamB?.name ?? 'Gegner' }}</div>
                    </div>
                </div>

                <div class="ld-actions">
                    <button v-if="teamA" type="button" class="ld-button ld-button-secondary" :disabled="isSpinning || isRevealing" @click="clearCurrentPairing()">
                        Neu drehen
                    </button>
                    <button v-if="phase === 'result'" type="button" class="ld-button" @click="nextPairing()">
                        Nächstes Spiel
                    </button>
                    <button v-else type="button" class="ld-button" :disabled="isSpinning || isRevealing" @click="wheel?.spin()">
                        {{ spinLabel }}
                    </button>
                </div>
            </div>

            <template v-if="pairings.length">
                <div class="ld-section-header">
                    <div class="ld-section-title">Ausgeloste Spiele ({{ pairings.length }})</div>
                    <button type="button" class="ld-pill" :disabled="isSpinning" @click="resetDraw()">Neu starten</button>
                </div>

                <div v-for="([home, away], index) in pairings" :key="index" class="ld-pairing">
                    <img :src="home.logo" alt="" />
                    <div class="ld-pairing-name">{{ home.name }}</div>
                    <div class="ld-vs ld-pairing-vs">vs</div>
                    <div class="ld-pairing-name ld-pairing-name-away">{{ away.name }}</div>
                    <img :src="away.logo" alt="" />
                </div>
            </template>
        </div>

        <!-- ─── Teilnehmer ─── -->
        <div v-else class="ld-participants">
            <div class="ld-section-header">
                <div class="ld-count">{{ draftParticipants.size }} von {{ leaguePlayers.length }} da</div>
                <div class="ld-pills">
                    <button type="button" class="ld-pill" @click="selectAll()">Alle</button>
                    <button type="button" class="ld-pill" @click="selectNone()">Keine</button>
                </div>
            </div>

            <div class="ld-grid">
                <div
                    v-for="player in leaguePlayers"
                    :key="player.name"
                    class="ld-team"
                    :class="{ 'ld-team-off': !draftParticipants.has(player.name) }"
                    role="checkbox"
                    tabindex="0"
                    :aria-checked="draftParticipants.has(player.name)"
                    @click="toggleParticipant(player)"
                    @keydown.space.prevent="toggleParticipant(player)"
                    @keydown.enter.prevent="toggleParticipant(player)"
                >
                    <div class="ld-team-check"><i class="pi pi-check"></i></div>
                    <div class="ld-avatar"><img :src="player.logo" alt="" /></div>
                    <div class="ld-team-name">{{ player.name }}</div>
                    <div v-if="removedTeams.has(player.name)" class="ld-team-tag">ausgelost</div>
                </div>
            </div>

            <div class="ld-footer">
                <div class="ld-footer-hint">Tippe ein Team an, um es an- oder abzuwählen</div>
                <button type="button" class="ld-button ld-button-large" :disabled="draftParticipants.size < 2" @click="applyParticipants()">
                    {{ draftParticipants.size < 2 ? 'Mindestens 2 Teams wählen' : `Mit ${draftParticipants.size} Teams auslosen` }}
                </button>
            </div>
        </div>
    </BottomSheet>
</template>

<script setup lang="ts">
import BottomSheet from '@/components/shared/BottomSheet.vue';
import Select from 'primevue/select';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import LeagueWheel from './LeagueWheel.vue';
import { getPlayedOpponents, splitLeagueGamesByRound } from './LeagueUtilFunctions';

type Round = 'hinrunde' | 'rueckrunde';
type Phase = 'team' | 'opponent' | 'result';

const ROUND_OPTIONS: { label: string, value: Round }[] = [
    { label: 'Hinrunde', value: 'hinrunde' },
    { label: 'Rückrunde', value: 'rueckrunde' },
];

const REVEAL_DELAY = 1200;   // gezogenes Team kurz zeigen, bevor das Gegner-Rad kommt
const RESULT_DELAY = 600;

const drawerVisible = defineModel<boolean>('visible', { default: false });
const league = defineModel<number>('league', { required: true });

const props = defineProps<{
    leagueOptions: { label: string, value: number }[];
    leaguePlayers: LeaguePlayer[];
    leagueGames: Match[];
    regularSeasonGameCount: number;
}>();

const wheel = ref<InstanceType<typeof LeagueWheel> | null>(null);
const view = ref<'draw' | 'participants'>('draw');

// ─── Bisherige Spiele ───
// Nur die Hauptrunde zaehlt, die Final-Four-Spiele kommen danach (wie in LeagueTable).
const regularSeasonGames = computed(() => props.leagueGames.toReversed().toSpliced(props.regularSeasonGameCount));
const leagueGamesByRound = computed(() => splitLeagueGamesByRound(regularSeasonGames.value));

const round = ref<Round>('hinrunde');
const roundLabel = computed(() => ROUND_OPTIONS.find(option => option.value === round.value)!.label);

// Hinrunde: Gegner raus, gegen die schon 1x gespielt wurde. Rueckrunde: raus nach dem 2. Spiel.
const playedOpponents = computed(() => getPlayedOpponents(leagueGamesByRound.value[round.value]));

// ─── Auslosung ───
// Der Stand bleibt beim Schliessen erhalten, nur ein laufender Dreh wird verworfen.
const participants = ref(new Set<string>());
const removedTeams = ref(new Set<string>());
const pairings = ref<[LeaguePlayer, LeaguePlayer][]>([]);
const phase = ref<Phase>('team');
const teamA = ref<LeaguePlayer | null>(null);
const teamB = ref<LeaguePlayer | null>(null);
const isSpinning = ref(false);
const isRevealing = ref(false);
let revealTimeout: ReturnType<typeof setTimeout> | undefined;

const controlsLocked = computed(() => isSpinning.value || isRevealing.value);

const isAvailable = (player: LeaguePlayer) =>
    participants.value.has(player.name) && !removedTeams.value.has(player.name);

const getAvailableOpponents = (team: LeaguePlayer) => {
    const played = playedOpponents.value.get(team.name.toLocaleLowerCase());
    return props.leaguePlayers.filter(opponent =>
        opponent.name !== team.name && isAvailable(opponent) && !played?.has(opponent.name.toLocaleLowerCase())
    );
}

const availableTeams = computed(() => props.leaguePlayers.filter(isAvailable));
const teamEntries = computed(() => availableTeams.value.filter(team => getAvailableOpponents(team).length > 0));
const opponentEntries = computed(() => teamA.value ? getAvailableOpponents(teamA.value) : []);
const wheelEntries = computed(() => phase.value === 'team' ? teamEntries.value : opponentEntries.value);

const hiddenTeamCount = computed(() =>
    phase.value === 'team' && teamEntries.value.length ? availableTeams.value.length - teamEntries.value.length : 0
);

const emptyMessage = computed(() =>
    participants.value.size < 2
        ? 'Wähle mindestens zwei Teams aus.'
        : `Keine weiteren Paarungen in der ${roundLabel.value} möglich.`
);

const spinLabel = computed(() => {
    if (isSpinning.value) return 'Dreht...';
    return phase.value === 'opponent' ? 'Gegner drehen' : 'Drehen';
});

const onSpun = (entry: LeaguePlayer) => {
    isSpinning.value = false;
    isRevealing.value = true;

    if (phase.value === 'team') {
        teamA.value = entry;
        revealTimeout = setTimeout(() => {
            isRevealing.value = false;
            phase.value = 'opponent';
        }, REVEAL_DELAY);
        return;
    }

    teamB.value = entry;
    revealTimeout = setTimeout(() => {
        isRevealing.value = false;
        phase.value = 'result';
    }, RESULT_DELAY);
}

const clearCurrentPairing = () => {
    clearTimeout(revealTimeout);
    isSpinning.value = false;
    isRevealing.value = false;
    teamA.value = null;
    teamB.value = null;
    phase.value = 'team';
}

const nextPairing = () => {
    if (!teamA.value || !teamB.value) return;

    pairings.value.push([teamA.value, teamB.value]);
    removedTeams.value.add(teamA.value.name);
    removedTeams.value.add(teamB.value.name);
    clearCurrentPairing();
}

const resetDraw = () => {
    if (isSpinning.value) return;

    clearCurrentPairing();
    pairings.value = [];
    removedTeams.value.clear();
}

// Andere Runde -> andere moegliche Gegner, die offene Paarung ist damit hinfaellig
watch(round, clearCurrentPairing);

// Sind alle Hinrunden-Paarungen gespielt, startet die Auslosung in der Rueckrunde.
const setDefaultRound = () => {
    const hinrundeGameCount = props.leaguePlayers.length * (props.leaguePlayers.length - 1) / 2;
    round.value = leagueGamesByRound.value.hinrunde.length >= hinrundeGameCount ? 'rueckrunde' : 'hinrunde';
}

// Andere Liga -> komplett neu
watch(() => props.leaguePlayers.map(player => player.name).join('|'), () => {
    resetDraw();
    participants.value = new Set(props.leaguePlayers.map(player => player.name));
    setDefaultRound();
}, { immediate: true });

watch(drawerVisible, (visible) => {
    if (visible) {
        view.value = 'draw';
        // Runde nur vorbelegen, solange noch nichts ausgelost wurde (Spiele laden asynchron)
        if (!pairings.value.length && !teamA.value) setDefaultRound();
        return;
    }
    // Rad wird beim Schliessen entfernt, ein laufender Dreh kommt nie an
    if (isSpinning.value || isRevealing.value) clearCurrentPairing();
});

// ─── Teilnehmer ───
// Auswahl wird erst mit dem Button uebernommen, "Zurueck" verwirft sie.
const draftParticipants = ref(new Set<string>());

const openParticipants = () => {
    if (controlsLocked.value) return;
    draftParticipants.value = new Set(participants.value);
    view.value = 'participants';
}

const toggleParticipant = (player: LeaguePlayer) => {
    if (draftParticipants.value.has(player.name))
        draftParticipants.value.delete(player.name);
    else
        draftParticipants.value.add(player.name);
}

const selectAll = () => props.leaguePlayers.forEach(player => draftParticipants.value.add(player.name));
const selectNone = () => draftParticipants.value.clear();

const applyParticipants = () => {
    if (draftParticipants.value.size < 2) return;

    participants.value = new Set(draftParticipants.value);
    const current = [teamA.value, teamB.value].filter(team => team !== null);
    if (current.some(team => !participants.value.has(team.name))) clearCurrentPairing();
    view.value = 'draw';
}

onBeforeUnmount(() => clearTimeout(revealTimeout));
</script>

<style scoped>
.ld-title{
    font-size: 20px;
    font-weight: 700;
    color: #222222;
    line-height: 1.2;
}
.ld-subtitle{
    font-size: 13px;
    color: #777777;
}
.ld-header-back{
    display: flex;
    align-items: center;
    gap: 12px;
}
.ld-back{
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #F1F2F4;
    color: #222222;
    cursor: pointer;
}
.ld-back:hover{
    background: #E4E6E9;
}

/* Chips */
.ld-chips{
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.ld-chip{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px;
    border: 1px solid #DDDFE3;
    border-radius: 999px;
    background: white;
    color: #222222;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background .2s ease;
}
button.ld-chip:hover{
    background: #F6F7F9;
}
.ld-chip .pi{
    font-size: 13px;
}
.ld-chip-chevron{
    font-size: 11px !important;
}
.ld-chip:disabled,
.ld-select.p-disabled{
    opacity: .45;
    cursor: default;
}
.ld-select{
    padding: 0 6px 0 14px;
    box-shadow: none;
}
.ld-select :deep(.p-select-label){
    padding: 0;
    color: #222222;
}
.ld-select :deep(.p-select-dropdown){
    width: 26px;
    color: #222222;
}

/* Rad */
.ld-wheel{
    /* Volle Breite, auf breiten Bildschirmen begrenzt, damit die Ergebniskarte sichtbar bleibt */
    width: min(100%, 60dvh);
    margin: 22px auto 0;
}
.ld-empty,
.ld-hint{
    text-align: center;
    color: #777777;
}
.ld-empty{
    padding: 50px 20px;
}
.ld-hint{
    margin-top: 12px;
    font-size: 13px;
}

/* Ergebnis */
.ld-card{
    margin-top: 22px;
    padding: 16px 12px 12px;
    border-radius: 16px;
    background: #F6F7F9;
}
.ld-card-label{
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #777777;
}
.ld-matchup{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
}
.ld-slot{
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}
.ld-slot-name{
    max-width: 100%;
    font-weight: 700;
    color: #222222;
    text-align: center;
    overflow-wrap: anywhere;
}
.ld-slot-empty .ld-slot-name{
    color: #AAAAAA;
}
.ld-vs{
    font-weight: 700;
    color: var(--main-color);
}

.ld-avatar{
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: #ECEEF1;
    color: #999999;
    font-weight: 700;
    overflow: hidden;
}
.ld-avatar img{
    width: 100%;
    height: 100%;
    object-fit: contain;
}
/* Mit Logo: kein abgerundeter Rahmen, das Logo steht frei */
.ld-avatar:has(img){
    border-radius: 0;
    background: transparent;
    overflow: visible;
}
.ld-slot-empty .ld-avatar{
    border: 2px dashed #D4D6DA;
    background: transparent;
}

.ld-actions{
    display: flex;
    gap: 10px;
    margin-top: 16px;
}

/* Buttons */
.ld-button{
    flex: 1;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--main-color);
    border-radius: 12px;
    background: var(--main-color);
    color: white;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: background .2s ease, opacity .2s ease;
}
.ld-button:hover:not(:disabled){
    background: #D62F42;
}
.ld-button:disabled{
    opacity: .45;
    cursor: default;
}
.ld-button-secondary{
    border-color: #DDDFE3;
    background: white;
    color: #222222;
}
.ld-button-secondary:hover:not(:disabled){
    background: #F6F7F9;
}
.ld-button-large{
    width: 100%;
    min-height: 52px;
    font-size: 16px;
}

.ld-pills{
    display: flex;
    gap: 6px;
}
.ld-pill{
    padding: 6px 12px;
    border: 1px solid #DDDFE3;
    border-radius: 999px;
    background: white;
    color: #222222;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}
.ld-pill:hover:not(:disabled){
    background: #F6F7F9;
}
.ld-pill:disabled{
    opacity: .45;
    cursor: default;
}

/* Ausgeloste Spiele */
.ld-section-header{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}
.ld-draw .ld-section-header{
    margin: 24px 0 6px;
}
.ld-section-title,
.ld-count{
    font-weight: 700;
    color: #222222;
}
.ld-pairing{
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid #F0F0F0;
}
.ld-pairing img{
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    object-fit: contain;
}
.ld-pairing-name{
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: #222222;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ld-pairing-name-away{
    text-align: right;
}
.ld-pairing-vs{
    font-size: 13px;
}

/* Teilnehmer */
.ld-participants{
    display: flex;
    flex-direction: column;
    min-height: 100%;
}
.ld-grid{
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
}
.ld-team{
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 6px;
    border: 2px solid var(--main-color);
    border-radius: 12px;
    background: #FEF2F3;
    cursor: pointer;
    user-select: none;
    transition: opacity .2s ease, background .2s ease;
}
.ld-team:focus-visible{
    outline: 2px solid var(--main-color);
    outline-offset: 2px;
}
.ld-team-off{
    border: 2px dashed #D4D6DA;
    background: white;
    opacity: .5;
}
.ld-team-check{
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--main-color);
    color: white;
}
.ld-team-check .pi{
    font-size: 10px;
    font-weight: 700;
}
.ld-team-off .ld-team-check{
    border: 1.5px solid #AAAAAA;
    background: white;
}
.ld-team-off .ld-team-check .pi{
    display: none;
}
.ld-team-name{
    max-width: 100%;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
    color: #222222;
    overflow-wrap: anywhere;
}
.ld-team-tag{
    font-size: 11px;
    color: var(--main-color);
}

.ld-footer{
    position: sticky;
    bottom: 0;
    margin-top: auto;
    padding-top: 20px;
    background: white;
    text-align: center;
}
.ld-footer-hint{
    margin-bottom: 12px;
    font-size: 13px;
    color: #777777;
}

@media (min-width: 600px){
    .ld-grid{
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}
</style>
