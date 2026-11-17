<template>
    <div class="KnechtTurnEditor">
        <!-- Worum geht es: Minute, Team, Stand vor dem Wurf -->
        <div v-if="action" class="kn-edit-context">
            <span class="kn-edit-context-dot" :style="{ background: getTeamColor(game.match, stateBefore.activeTeamIndex) }"></span>
            <span>{{ contextLine }}</span>
        </div>

        <template v-if="isEditable && !confirmDelete">
            <div v-if="team.players.length > 1" class="kn-edit-section">
                <div class="kn-edit-label">Werfer</div>
                <div class="kn-edit-chips">
                    <button v-for="(player, playerIndex) in team.players" :key="playerIndex"
                        type="button"
                        class="kn-edit-chip"
                        :class="{ 'kn-edit-chip--active': draft.player === playerIndex }"
                        :disabled="!allowedThrowers.includes(playerIndex)"
                        @click="draft.player = playerIndex"
                    >{{ player.name }}</button>
                </div>
            </div>

            <div class="kn-edit-section">
                <div class="kn-edit-label">Ergebnis</div>
                <div class="kn-edit-chips">
                    <button v-for="option in OUTCOMES" :key="option.value"
                        type="button"
                        class="kn-edit-chip"
                        :class="{ 'kn-edit-chip--active': draft.outcome === option.value }"
                        @click="draft.outcome = option.value"
                    ><KnechtIcon :name="option.value" /> {{ option.label }}</button>
                </div>
            </div>

            <!-- Trickshot: wer hat den Ball gefangen? -->
            <div v-if="draft.outcome === 'trickshot'" class="kn-edit-section">
                <div class="kn-edit-label">Gefangen von</div>
                <div class="kn-edit-chips">
                    <button v-for="(player, playerIndex) in team.players" :key="playerIndex"
                        type="button"
                        class="kn-edit-chip"
                        :class="{ 'kn-edit-chip--active': draft.catcher === playerIndex }"
                        @click="draft.catcher = playerIndex"
                    >{{ player.name }}</button>
                </div>
            </div>

            <template v-if="draft.outcome === 'hit'">
                <div class="kn-edit-section kn-edit-cups">
                    <div class="kn-edit-label">Becher <span class="kn-edit-label-hint">gestrichelt = bisher eingetragen</span></div>
                    <div class="kn-edit-pyramid">
                        <div v-for="(row, rowIndex) in CUP_ROWS" :key="rowIndex" class="kn-edit-row">
                            <button v-for="cup in row" :key="cup"
                                type="button"
                                class="kn-edit-cup"
                                :class="{ 'kn-edit-cup--active': draft.cup === cup, 'kn-edit-cup--original': originalCup === cup && draft.cup !== cup }"
                                :style="{ '--kn-team-color': getTeamColor(game.match, 1 - stateBefore.activeTeamIndex) }"
                                :disabled="!hittable.includes(cup)"
                                @click="draft.cup = cup"
                            >{{ cup + 1 }}</button>
                        </div>
                    </div>
                </div>

                <label class="kn-edit-toggle">
                    <input v-model="draft.bouncer" type="checkbox" />
                    <span><KnechtIcon name="bouncer" /> Bouncer (zweiter Becher wird automatisch gewählt)</span>
                </label>
            </template>
        </template>

        <div v-else-if="!isEditable" class="kn-edit-info">
            {{ action ? 'Dieser Eintrag kann nur gelöscht werden.' : 'Eintrag nicht gefunden.' }}
        </div>

        <!-- Folgen der Aenderung, bevor sie uebernommen wird -->
        <div v-if="plan && (hasChange || confirmDelete)" class="kn-edit-impact" :class="{ 'kn-edit-impact--error': plan.error }">
            <template v-if="plan.error">
                <b>So geht es nicht</b>
                <span>{{ plan.error }}<template v-if="plan.errorTime && game.match.time"> (ab Minute {{ minuteOf(plan.errorTime) }})</template></span>
            </template>
            <template v-else>
                <div class="kn-edit-impact-score">
                    <span>Stand</span>
                    <b>{{ formatScore(plan.scoreBefore) }}</b>
                    <i class="pi pi-arrow-right"></i>
                    <b :class="{ 'kn-edit-impact-changed': formatScore(plan.scoreBefore) !== formatScore(plan.scoreAfter) }">{{ formatScore(plan.scoreAfter) }}</b>
                </div>
                <span v-if="plan.wasOver && !plan.isOver">Das Spiel ist dann noch nicht vorbei, es geht weiter.</span>
                <span v-else-if="plan.isOver && plan.winnerBefore !== plan.winnerAfter">Dann gewinnt {{ getTeamName(game.match, plan.winnerAfter ?? 0) }}.</span>
                <span v-if="plan.dropped">{{ plan.dropped }} {{ plan.dropped === 1 ? 'späterer Eintrag entfällt' : 'spätere Einträge entfallen' }}, weil das Spiel früher endet.</span>
                <template v-if="plan.changes.length">
                    <span>Automatisch angepasst:</span>
                    <ul>
                        <li v-for="(change, index) in plan.changes" :key="index"><template v-if="game.match.time">{{ minuteOf(change.time) }}' · </template>{{ change.text }}</li>
                    </ul>
                </template>
                <span v-if="!plan.changes.length && !plan.dropped && formatScore(plan.scoreBefore) === formatScore(plan.scoreAfter)" class="kn-edit-impact-calm">Sonst ändert sich nichts.</span>
            </template>
        </div>

        <div ref="footer" class="kn-edit-footer">
            <template v-if="confirmDelete">
                <button type="button" class="kn-edit-button kn-edit-button-cancel" @click="confirmDelete = false">Abbrechen</button>
                <button type="button" class="kn-edit-button kn-edit-button-save" :disabled="!!plan?.error" @click="apply">
                    <i class="pi pi-trash"></i> Wirklich löschen
                </button>
            </template>
            <template v-else>
                <button type="button" class="kn-edit-button kn-edit-button-delete" @click="confirmDelete = true">
                    <i class="pi pi-trash"></i> Löschen
                </button>
                <button v-if="isEditable" type="button" class="kn-edit-button kn-edit-button-save" :disabled="!canSave" @click="apply">
                    Übernehmen
                </button>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import KnechtIcon from './KnechtIcon.vue';
import { CUP_ROWS, getActionIndexOfTurn, getAllowedThrowers, getHittableCups, getTeamPoints, previewHit, type KnechtAction, type ThrowOutcome } from './knechtEngine';
import { planEdit } from './knechtEditRepair';
import { formatPoints, getPlayerName, getTeam, getTeamColor, getTeamName } from './KnechtUtilFunctions';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const props = defineProps<{ game: BiPoKnechtGame; turnIndex: number }>();
const emit = defineEmits<{ done: [] }>();

// Ein Wurf kann auch nachtraeglich zum Trickshot werden (Ball verfehlt und gefangen) und umgekehrt
type EditOutcome = ThrowOutcome | 'trickshot';
const OUTCOMES: { value: EditOutcome; label: string }[] = [
    { value: 'hit', label: 'Treffer' },
    { value: 'miss', label: 'Nullwurf' },
    { value: 'airball', label: 'Airball' },
    { value: 'trickshot', label: 'Gefangen (Trickshot)' },
];

const actionIndex = computed(() => getActionIndexOfTurn(props.game.actions.value, props.turnIndex));
const action = computed(() => props.game.actions.value[actionIndex.value]);
const isEditable = computed(() => action.value?.type === 'throw' || action.value?.type === 'trickshot');

// Spielstand direkt vor diesem Wurf: welche Werfer und Becher waren da moeglich?
const stateBefore = computed(() => props.game.getStateAfter(actionIndex.value));
const team = computed(() => getTeam(props.game.match, stateBefore.value.activeTeamIndex));
const allowedThrowers = computed(() => {
    const allowed = getAllowedThrowers(stateBefore.value);
    const current = action.value;
    return current?.type === 'throw' || current?.type === 'trickshot' ? [...new Set([...allowed, current.player])] : allowed;
});
const hittable = computed(() => getHittableCups(stateBefore.value));
const originalCup = computed(() => action.value?.type === 'throw' ? action.value.cup : undefined);

const minuteOf = (time: number) => props.game.match.time ? Math.max(0, Math.floor((time - props.game.match.time) / 60000)) : 0;
const formatScore = (score: [number, number]) => `${formatPoints(score[0])} : ${formatPoints(score[1])}`;
const contextLine = computed(() => {
    const parts: string[] = [];
    if (props.game.match.time && action.value) parts.push(`Minute ${minuteOf(action.value.time)}`);
    parts.push(getTeamName(props.game.match, stateBefore.value.activeTeamIndex));
    parts.push(`Stand davor ${formatScore(getTeamPoints(stateBefore.value))}`);
    return parts.join(' · ');
});

const draft = reactive<{ player: number; outcome: EditOutcome; cup?: number; bouncer: boolean; catcher: number }>({ player: 0, outcome: 'miss', bouncer: false, catcher: 0 });
const confirmDelete = ref(false);

watch(action, (current) => {
    if (current?.type === 'throw')
        Object.assign(draft, { player: current.player, outcome: current.outcome, cup: current.cup, bouncer: !!current.bouncer, catcher: current.player });
    else if (current?.type === 'trickshot')
        Object.assign(draft, { player: current.player, outcome: 'trickshot', cup: undefined, bouncer: false, catcher: current.catcher });
    confirmDelete.value = false;
}, { immediate: true });

// Zusatzbecher behalten, solange sie noch passen, sonst die ersten moeglichen nehmen
const buildAction = (): KnechtAction | null => {
    const current = action.value;
    if (current?.type !== 'throw' && current?.type !== 'trickshot') return null;
    if (draft.outcome === 'trickshot') return { type: 'trickshot', player: draft.player, catcher: draft.catcher, time: current.time };
    if (draft.outcome !== 'hit') {
        // Landestelle und Kante eines Nullwurfs bleiben beim Korrigieren erhalten
        const keep = draft.outcome === 'miss' && current.type === 'throw' && current.outcome === 'miss' ? { spot: current.spot, edge: current.edge } : {};
        return { type: 'throw', player: draft.player, outcome: draft.outcome, time: current.time, ...keep };
    }
    if (draft.cup === undefined || !hittable.value.includes(draft.cup)) return null;

    const preview = previewHit(stateBefore.value, draft.cup, draft.bouncer, draft.player);
    const kept = (current.type === 'throw' ? current.extraCups ?? [] : []).filter(cup => preview.extraCandidates.includes(cup));
    const extraCups = [...kept, ...preview.extraCandidates.filter(cup => !kept.includes(cup))].slice(0, preview.extrasNeeded);
    return { type: 'throw', player: draft.player, outcome: 'hit', cup: draft.cup, bouncer: draft.bouncer, extraCups, time: current.time };
};

const names = (teamIndex: number, playerIndex: number) => getPlayerName(props.game.match, teamIndex, playerIndex);

// Neue Aktionsliste fuer den Entwurf (bzw. das Loeschen); der Trickshot-Wurf danach geht mit dem Faenger mit
const plan = computed(() => {
    const index = actionIndex.value;
    if (index < 0) return null;
    let actions = props.game.actions.value;
    if (confirmDelete.value) return planEdit(props.game.config.value, actions, index, null, names);

    const updated = buildAction();
    if (!updated) return null;
    const current = action.value;
    const next = actions[index + 1];
    if (current?.type === 'trickshot' && updated.type === 'trickshot' && current.catcher !== updated.catcher
        && (next?.type === 'throw' || next?.type === 'trickshot') && next.player === current.catcher)
        actions = actions.map((item, itemIndex) => itemIndex === index + 1 ? { ...next, player: updated.catcher } : item);
    return planEdit(props.game.config.value, actions, index, updated, names);
});

const hasChange = computed(() => {
    const updated = buildAction();
    return !!updated && JSON.stringify(updated) !== JSON.stringify(action.value);
});

const canSave = computed(() => hasChange.value && !!plan.value && !plan.value.error);

// Folgen sichtbar machen, sobald sie sich aendern (im Querformat liegen sie sonst unter dem Rand)
const footer = ref<HTMLElement | null>(null);
watch(() => plan.value && (hasChange.value || confirmDelete.value) ? JSON.stringify([plan.value.error, plan.value.scoreAfter, plan.value.changes.length, confirmDelete.value]) : '', async (key) => {
    if (!key) return;
    await nextTick();
    footer.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

const apply = () => {
    if (!plan.value || plan.value.error) return;
    const message = props.game.replaceActions(plan.value.actions);
    if (!message) emit('done');
};
</script>

<style scoped>
.KnechtTurnEditor{
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.kn-edit-context{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--bp-text-secondary);
}
.kn-edit-context-dot{
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
}
.kn-edit-section{
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.kn-edit-label{
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--bp-text-secondary);
}
.kn-edit-label-hint{
    margin-left: 6px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: var(--bp-text-faint);
}
.kn-edit-chips{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.kn-edit-chip{
    padding: 8px 12px;
    border: 1.5px solid var(--bp-border);
    border-radius: 10px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}
.kn-edit-chip--active{
    border-color: var(--main-color);
    background: var(--bp-primary-faint);
    color: var(--main-color);
}
.kn-edit-chip:disabled{
    opacity: .4;
    cursor: default;
}
.kn-edit-pyramid{
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 6px;
}
.kn-edit-row{
    display: flex;
    gap: 6px;
}
.kn-edit-cup{
    width: 44px;
    height: 44px;
    border: 3px solid var(--kn-team-color);
    border-radius: 50%;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
}
.kn-edit-cup--active{
    background: var(--kn-team-color);
    color: white;
}
.kn-edit-cup--original{
    border-style: dashed;
}
.kn-edit-cup:disabled{
    border-color: var(--bp-border);
    color: var(--bp-text-faint);
    cursor: default;
}
.kn-edit-toggle{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--bp-text-strong);

    span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }
}
/* Handy quer: Becher rechts neben der Auswahl, damit Vorschau und Knoepfe ohne Scrollen sichtbar sind */
@media (orientation: landscape) and (max-height: 520px){
    .KnechtTurnEditor{
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        column-gap: 24px;
        row-gap: 12px;
        align-items: start;
    }
    .KnechtTurnEditor > *{
        grid-column: 1;
    }
    .KnechtTurnEditor > .kn-edit-cups{
        position: sticky;
        top: 0;
        grid-column: 2;
        grid-row: 1 / span 6;
    }
}
.kn-edit-info{
    padding: 12px;
    border-radius: 12px;
    background: var(--page-gray);
    color: var(--bp-text-muted);
    font-size: 14px;
}
.kn-edit-impact{
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--page-gray);
    color: var(--bp-text);
    font-size: 13px;

    ul {
        margin: 0;
        padding-left: 18px;
    }
}
.kn-edit-impact--error{
    background: var(--bp-primary-faint);
    color: var(--bp-primary-text);
}
.kn-edit-impact-score{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;

    i { font-size: 11px; color: var(--bp-text-muted); }
}
.kn-edit-impact-changed{
    color: var(--main-color);
}
.kn-edit-impact-calm{
    color: var(--bp-text-muted);
}
.kn-edit-footer{
    display: flex;
    gap: 8px;
}
.kn-edit-button{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 48px;
    padding: 0 16px;
    border: none;
    border-radius: 14px;
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
}
.kn-edit-button-delete{
    border: 1px solid var(--bp-primary-weak);
    background: var(--bp-primary-faint);
    color: var(--main-color);
}
.kn-edit-button-cancel{
    border: 1px solid var(--bp-border);
    background: var(--bp-surface);
    color: var(--bp-text-strong);
}
.kn-edit-button-save{
    flex: 1;
    background: var(--main-color);
    color: white;
}
.kn-edit-button-save:disabled{
    background: var(--bp-fill-strong);
    cursor: default;
}
</style>
