<template>
    <div class="KnechtControls" @click.stop>
        <!-- Re-Rack oben, gleich gross wie die anderen Knoepfe, in Gruen -->
        <button v-if="game.canReRack.value" type="button" class="kn-control kn-control-rerack" :disabled="!!game.pick.value" @click="game.reRack()">
            <KnechtIcon name="reRack" /> <span>Re-Rack <small>({{ reRacksLeft }} übrig)</small></span>
        </button>

        <button
            type="button"
            class="kn-control kn-control-bouncer"
            :class="{ 'kn-control--armed': game.bouncerArmed.value }"
            :disabled="!!game.pick.value"
            @click="game.toggleBouncer()"
        >
            <KnechtIcon name="bouncer" />
            <span>{{ bouncerLabel }}</span>
        </button>

        <button
            type="button"
            class="kn-control kn-control-trickshot"
            :class="{ 'kn-control--armed': trickshotActive || game.trickshotPending.value }"
            :aria-pressed="trickshotActive || game.trickshotPending.value"
            :disabled="!!game.pick.value || trickshotLocked"
            @click="$emit('trickshot')"
        >
            <KnechtIcon name="trickshot" />
            <span>{{ trickshotLabel }}</span>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KnechtIcon from './KnechtIcon.vue';
import type { BiPoKnechtGame } from './useBiPoKnecht';

// pro: Knecht Pro. Trickshot erst, wenn der Ball auf den Tisch ging (catchReady), dann heisst Antippen "gefangen".
const props = defineProps<{ game: BiPoKnechtGame; trickshotActive?: boolean; pro?: boolean; catchReady?: boolean }>();
defineEmits<{ trickshot: [] }>();

const trickshotLocked = computed(() => !!props.pro && !props.catchReady && !props.trickshotActive && !props.game.trickshotPending.value);
const bouncerLabel = computed(() => {
    if (!props.game.bouncerArmed.value) return 'Bouncer';
    if (!props.pro) return 'Bouncer aktiv';
    return props.game.bounceSpot.value ? 'Bouncer: welcher Becher?' : 'Bouncer: wo kam er auf?';
});

const trickshotLabel = computed(() => {
    if (props.trickshotActive) return 'Trickshot: Fänger wählen';
    if (props.pro && props.catchReady && !props.game.trickshotPending.value) return 'Gefangen? Trickshot';
    return props.game.trickshotPending.value ? 'Trickshot aktiv' : 'Trickshot';
});

const reRacksLeft = computed(() => props.game.state.value.reRacksLeft[props.game.state.value.activeTeamIndex]);
</script>

<style scoped>
.KnechtControls{
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    width: min(240px, 100%);
}
.kn-control{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 40px;
    padding: 0 12px;
    border: 1.5px solid var(--bp-border);
    border-radius: 12px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, .06);
    transition: background .15s ease, border-color .15s ease, color .15s ease;
}
.kn-control:active:not(:disabled){
    transform: scale(.97);
}
.kn-control:disabled{
    opacity: .5;
    cursor: default;
}
.kn-control--armed{
    border-color: #F5A524;
    background: #F5A524;
    color: white;
}
.kn-control-rerack{
    border-color: #1F8A70;
    background: #1F8A70;
    color: white;
}
.kn-control-rerack small{
    font-weight: 600;
    opacity: .85;
}
</style>
