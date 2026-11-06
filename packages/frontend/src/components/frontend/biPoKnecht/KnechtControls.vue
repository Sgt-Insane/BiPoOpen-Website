<template>
    <div class="KnechtControls" @click.stop>
        <button
            type="button"
            class="kn-control kn-control-bouncer"
            :class="{ 'kn-control--armed': game.bouncerArmed.value }"
            :disabled="!!game.pick.value"
            @click="game.toggleBouncer()"
        >
            <KnechtIcon name="bouncer" />
            <span>{{ game.bouncerArmed.value ? 'Bouncer aktiv' : 'Bouncer' }}</span>
        </button>

        <button
            type="button"
            class="kn-control kn-control-trickshot"
            :class="{ 'kn-control--armed': trickshotActive }"
            :disabled="!!game.pick.value"
            @click="$emit('trickshot')"
        >
            <KnechtIcon name="trickshot" />
            <span>{{ trickshotActive ? 'Trickshot: Fänger wählen' : 'Trickshot' }}</span>
        </button>

        <button v-if="game.canReRack.value" type="button" class="kn-chip" :disabled="!!game.pick.value" @click="game.reRack()">
            <KnechtIcon name="reRack" /> Re-Rack <small>({{ reRacksLeft }} übrig)</small>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KnechtIcon from './KnechtIcon.vue';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const props = defineProps<{ game: BiPoKnechtGame; trickshotActive?: boolean }>();
defineEmits<{ trickshot: [] }>();

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
    border: 1.5px solid #E6E8EB;
    border-radius: 12px;
    background: white;
    color: #1F2328;
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
.kn-control-trickshot{
    height: 34px;
    font-size: 13px;
}
.kn-chip{
    display: flex;
    align-items: center;
    gap: 5px;
    align-self: center;
    padding: 6px 12px;
    border: none;
    border-radius: 999px;
    background: #1F8A70;
    color: white;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}
.kn-chip small{
    font-weight: 600;
    opacity: .85;
}
</style>
