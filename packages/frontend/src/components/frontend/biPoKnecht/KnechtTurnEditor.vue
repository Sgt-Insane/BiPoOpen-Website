<template>
    <div class="KnechtTurnEditor">
        <template v-if="action?.type === 'throw'">
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
            <button v-if="action?.type === 'throw'" type="button" class="kn-edit-button kn-edit-button-save" :disabled="draft.outcome === 'hit' && draft.cup === undefined" @click="save">
                Übernehmen
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import KnechtIcon from './KnechtIcon.vue';
import { CUP_ROWS, getActionIndexOfTurn, getAllowedThrowers, getHittableCups, previewHit, replay, type KnechtAction, type ThrowOutcome } from './knechtEngine';
import { TEAM_COLORS, getTeam } from './KnechtUtilFunctions';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const props = defineProps<{ game: BiPoKnechtGame; turnIndex: number }>();
const emit = defineEmits<{ done: [] }>();

const OUTCOMES: { value: ThrowOutcome; label: string }[] = [
    { value: 'hit', label: 'Treffer' },
    { value: 'miss', label: 'Nullwurf' },
    { value: 'airball', label: 'Airball' },
];

const actionIndex = computed(() => getActionIndexOfTurn(props.game.actions.value, props.turnIndex));
const action = computed(() => props.game.actions.value[actionIndex.value]);

// Spielstand direkt vor diesem Wurf: welche Werfer und Becher waren da moeglich?
const stateBefore = computed(() => replay(props.game.config.value, props.game.actions.value.slice(0, actionIndex.value)).state);
const team = computed(() => getTeam(props.game.match, stateBefore.value.activeTeamIndex));
const allowedThrowers = computed(() => {
    const allowed = getAllowedThrowers(stateBefore.value);
    return action.value?.type === 'throw' ? [...new Set([...allowed, action.value.player])] : allowed;
});
const hittable = computed(() => getHittableCups(stateBefore.value));

const draft = reactive<{ player: number; outcome: ThrowOutcome; cup?: number; bouncer: boolean }>({ player: 0, outcome: 'miss', bouncer: false });
const error = ref('');

watch(action, (current) => {
    if (current?.type !== 'throw') return;
    Object.assign(draft, { player: current.player, outcome: current.outcome, cup: current.cup, bouncer: !!current.bouncer });
    error.value = '';
}, { immediate: true });

// Zusatzbecher behalten, solange sie noch passen, sonst die ersten moeglichen nehmen
const buildAction = (): KnechtAction | null => {
    const current = action.value;
    if (current?.type !== 'throw') return null;
    if (draft.outcome !== 'hit') return { type: 'throw', player: draft.player, outcome: draft.outcome, time: current.time };

    const preview = previewHit(stateBefore.value, draft.cup!, draft.bouncer, draft.player);
    const kept = (current.extraCups ?? []).filter(cup => preview.extraCandidates.includes(cup));
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
    actions[actionIndex.value] = updated;
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
    color: #555B63;
}
.kn-edit-chips{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.kn-edit-chip{
    padding: 8px 12px;
    border: 1.5px solid #E6E8EB;
    border-radius: 10px;
    background: white;
    color: #1F2328;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}
.kn-edit-chip--active{
    border-color: var(--main-color);
    background: #FFF5F6;
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
    background: white;
    color: #1F2328;
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
    border-color: #E6E8EB;
    color: #B5B9C0;
    cursor: default;
}
.kn-edit-toggle{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #1F2328;
}
.kn-edit-info{
    padding: 12px;
    border-radius: 12px;
    background: #F6F7F9;
    color: #6B7079;
    font-size: 14px;
}
.kn-edit-error{
    padding: 10px 12px;
    border-radius: 12px;
    background: #FFF5F6;
    color: #B42318;
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
    border: 1px solid #F3C4C9;
    background: #FFF5F6;
    color: var(--main-color);
}
.kn-edit-button-save{
    flex: 1;
    background: var(--main-color);
    color: white;
}
.kn-edit-button-save:disabled{
    background: #CDD0D6;
    cursor: default;
}
</style>
