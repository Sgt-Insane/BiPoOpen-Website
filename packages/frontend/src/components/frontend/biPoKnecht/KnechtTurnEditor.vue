<template>
    <div class="KnechtTurnEditor">
        <template v-if="isEditable">
            <div class="kn-edit-section">
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
                <div class="kn-edit-section">
                    <div class="kn-edit-label">Becher</div>
                    <div class="kn-edit-pyramid">
                        <div v-for="(row, rowIndex) in CUP_ROWS" :key="rowIndex" class="kn-edit-row">
                            <button v-for="cup in row" :key="cup"
                                type="button"
                                class="kn-edit-cup"
                                :class="{ 'kn-edit-cup--active': draft.cup === cup }"
                                :style="{ '--kn-team-color': TEAM_COLORS[1 - stateBefore.activeTeamIndex] }"
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

        <div v-else class="kn-edit-info">
            {{ action ? 'Dieser Eintrag kann nur gelöscht werden.' : 'Eintrag nicht gefunden.' }}
        </div>

        <div v-if="error" class="kn-edit-error">{{ error }}</div>

        <div class="kn-edit-footer">
            <button type="button" class="kn-edit-button kn-edit-button-delete" @click="remove">
                <i class="pi pi-trash"></i> Löschen
            </button>
            <button v-if="isEditable" type="button" class="kn-edit-button kn-edit-button-save" :disabled="draft.outcome === 'hit' && draft.cup === undefined" @click="save">
                Übernehmen
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import KnechtIcon from './KnechtIcon.vue';
import { CUP_ROWS, getActionIndexOfTurn, getAllowedThrowers, getHittableCups, previewHit, type KnechtAction, type ThrowOutcome } from './knechtEngine';
import { TEAM_COLORS, getTeam } from './KnechtUtilFunctions';
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

const draft = reactive<{ player: number; outcome: EditOutcome; cup?: number; bouncer: boolean; catcher: number }>({ player: 0, outcome: 'miss', bouncer: false, catcher: 0 });
const error = ref('');

watch(action, (current) => {
    if (current?.type === 'throw')
        Object.assign(draft, { player: current.player, outcome: current.outcome, cup: current.cup, bouncer: !!current.bouncer, catcher: current.player });
    else if (current?.type === 'trickshot')
        Object.assign(draft, { player: current.player, outcome: 'trickshot', cup: undefined, bouncer: false, catcher: current.catcher });
    error.value = '';
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

    const preview = previewHit(stateBefore.value, draft.cup!, draft.bouncer, draft.player);
    const kept = (current.type === 'throw' ? current.extraCups ?? [] : []).filter(cup => preview.extraCandidates.includes(cup));
    const extraCups = [...kept, ...preview.extraCandidates.filter(cup => !kept.includes(cup))].slice(0, preview.extrasNeeded);
    return { type: 'throw', player: draft.player, outcome: 'hit', cup: draft.cup, bouncer: draft.bouncer, extraCups, time: current.time };
};

const apply = (newActions: KnechtAction[]) => {
    const message = props.game.replaceActions(newActions);
    if (message) {
        error.value = `Passt nicht zum weiteren Verlauf – ${message}. Spätere Würfe zuerst anpassen oder löschen.`;
        return;
    }
    emit('done');
};

const save = () => {
    const updated = buildAction();
    if (!updated) return;
    const actions = [...props.game.actions.value];
    const current = actions[actionIndex.value];
    actions[actionIndex.value] = updated;
    // Anderer Faenger: den Trickshot-Wurf danach hat dann dieser Spieler geworfen
    const next = actions[actionIndex.value + 1];
    if (current.type === 'trickshot' && updated.type === 'trickshot' && current.catcher !== updated.catcher
        && (next?.type === 'throw' || next?.type === 'trickshot') && next.player === current.catcher)
        actions[actionIndex.value + 1] = { ...next, player: updated.catcher };
    apply(actions);
};

const remove = () => apply(props.game.actions.value.filter((_, index) => index !== actionIndex.value));
</script>

<style scoped>
.KnechtTurnEditor{
    display: flex;
    flex-direction: column;
    gap: 14px;
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
    width: 40px;
    height: 40px;
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
}
.kn-edit-info{
    padding: 12px;
    border-radius: 12px;
    background: var(--page-gray);
    color: var(--bp-text-muted);
    font-size: 14px;
}
.kn-edit-error{
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--bp-primary-faint);
    color: var(--bp-primary-text);
    font-size: 13px;
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
