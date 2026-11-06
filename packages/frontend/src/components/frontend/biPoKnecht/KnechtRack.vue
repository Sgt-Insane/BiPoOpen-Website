<template>
    <div
        class="KnechtRack"
        :class="[`kn-rack--${direction}`, { 'kn-rack--target': isTarget, 'kn-rack--waiting': !isTarget, 'kn-rack--rotated': rotated, 'kn-rack--picking': !!game.pick.value }]"
        :style="{ '--kn-team-color': TEAM_COLORS[teamIndex] }"
        @click="onTableClick"
    >
        <!-- Hinter den Bechern: Airball (Ball ueber den Tisch) -->
        <div v-if="isTarget" class="kn-zone kn-zone-airball" @click.stop="onAirballClick">
            <span class="kn-zone-label">💨 Airball</span>
        </div>

        <div class="kn-pyramid">
            <div v-for="(row, rowIndex) in CUP_ROWS" :key="rowIndex" class="kn-row">
                <button
                    v-for="cup in row"
                    :key="cup"
                    type="button"
                    class="kn-cup"
                    :class="getCupClass(cup)"
                    :disabled="!isTarget"
                    :aria-label="`Becher ${cup + 1}`"
                    @click.stop="game.tapCup(cup)"
                >
                    <span class="kn-cup-inner">
                        <span v-if="getCupMark(cup)" class="kn-cup-mark">{{ getCupMark(cup) }}</span>
                    </span>
                </button>
            </div>
        </div>

        <!-- Vor und neben den Bechern: Nullwurf -->
        <div class="kn-front">
            <span v-if="isTarget && !game.pick.value" class="kn-zone-label kn-zone-label-miss">✕ Nullwurf · neben die Becher tippen</span>
            <slot name="front"></slot>
        </div>

        <!-- Zusatzbecher waehlen (Bouncer, Bombe) -->
        <div v-if="isTarget && game.pick.value" class="kn-pick" @click.stop>
            <span class="kn-pick-text">{{ pickText }}</span>
            <button type="button" class="kn-pick-cancel" @click="game.cancelPick()">Abbrechen</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CUP_ROWS, getStandingCups } from './knechtEngine';
import { TEAM_COLORS } from './KnechtUtilFunctions';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const props = defineProps<{
    game: BiPoKnechtGame;
    teamIndex: number;                              // wem die Becher gehoeren
    direction: 'up' | 'down' | 'left' | 'right';    // Richtung der Tischkante hinter den Bechern
    isTarget: boolean;                              // auf diese Becher wird gerade geworfen
    rotated?: boolean;                              // Spielermodus: fuer das Team am anderen Tischende gedreht
}>();

const rack = computed(() => props.game.state.value.racks[props.teamIndex]);
const standing = computed(() => new Set(getStandingCups(rack.value)));
const pending = computed(() => new Set(rack.value.pending));

const getCupClass = (cup: number) => {
    const pick = props.game.pick.value;
    const isHittable = props.isTarget && props.game.hittableCups.value.has(cup);
    return {
        'kn-cup--standing': standing.value.has(cup),
        'kn-cup--pending': pending.value.has(cup),
        'kn-cup--hit': !standing.value.has(cup) && !pending.value.has(cup),
        'kn-cup--hittable': isHittable && !pick,
        'kn-cup--bomb': isHittable && !pick && pending.value.has(cup),
        'kn-cup--candidate': !!pick && props.isTarget && pick.candidates.includes(cup) && !pick.chosen.includes(cup),
        'kn-cup--chosen': !!pick && props.isTarget && (pick.chosen.includes(cup) || pick.cup === cup),
    };
};

const getCupMark = (cup: number) => {
    const pick = props.game.pick.value;
    if (pick && props.isTarget && (pick.chosen.includes(cup) || pick.cup === cup)) return '✓';
    if (pending.value.has(cup)) return props.isTarget && props.game.hittableCups.value.has(cup) && !pick ? '💣' : '✓';
    if (!standing.value.has(cup)) return '';
    return '';
};

const pickText = computed(() => {
    const pick = props.game.pick.value;
    if (!pick) return '';
    const left = pick.needed - pick.chosen.length;
    if (pick.type === 'bomb') return `💣 Bombe! Noch ${left} Becher wählen`;
    return `⚡ Bouncer: zweiten Becher wählen`;
});

// Tippen auf den freien Tisch = Nullwurf, nur auf dem Feld, auf das geworfen wird
const onTableClick = () => {
    if (props.isTarget && !props.game.pick.value) props.game.throwMiss('miss');
};

const onAirballClick = () => {
    if (!props.game.pick.value) props.game.throwMiss('airball');
};
</script>

<style scoped>
.KnechtRack{
    position: relative;
    display: flex;
    align-items: stretch;
    width: 100%;
    height: 100%;
    container-type: size;
    background: #EEF1F4;
    transition: background .25s ease, opacity .25s ease, filter .25s ease;
}
.kn-rack--up{ flex-direction: column; }
.kn-rack--down{ flex-direction: column-reverse; }
.kn-rack--left{ flex-direction: row; }
.kn-rack--right{ flex-direction: row-reverse; }
.kn-rack--rotated{ transform: rotate(180deg); }

.kn-rack--target{
    cursor: pointer;
    background: #E9EDF1;
    box-shadow: inset 0 0 0 1.5px rgba(31, 35, 40, .08);
}
.kn-rack--waiting{
    background: #F3F4F6;
    filter: grayscale(.85);
    opacity: .5;
    pointer-events: none;
}

/* ─── Zonen ─── */
.kn-zone{
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 18%;
    margin: 6px;
    border: 1.5px dashed rgba(31, 35, 40, .18);
    border-radius: 14px;
    background: rgba(97, 195, 217, .06);
    transition: background .15s ease;
}
.kn-zone:active{
    background: rgba(97, 195, 217, .18);
}
.kn-rack--left .kn-zone,
.kn-rack--right .kn-zone{
    flex-basis: 14%;
}
.kn-zone-label{
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: #8A9099;
    pointer-events: none;
}
.kn-rack--left .kn-zone-airball .kn-zone-label{ writing-mode: vertical-rl; transform: rotate(180deg); }
.kn-rack--right .kn-zone-airball .kn-zone-label{ writing-mode: vertical-rl; }

/* ─── Becher ─── */
.kn-pyramid{
    --kn-cup: min(16.5cqw, 11cqh);
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    justify-content: center;
    gap: calc(var(--kn-cup) * .12);
    flex: 1;
    min-height: 0;
    min-width: 0;
}
.kn-rack--down .kn-pyramid{ flex-direction: column; }
.kn-rack--left .kn-pyramid,
.kn-rack--right .kn-pyramid{
    --kn-cup: min(10cqw, 17cqh);
    flex-direction: row-reverse;
}
.kn-rack--right .kn-pyramid{ flex-direction: row; }
.kn-rack--waiting .kn-pyramid{
    --kn-cup: min(12cqw, 17cqh);
}
.kn-rack--waiting.kn-rack--left .kn-pyramid,
.kn-rack--waiting.kn-rack--right .kn-pyramid{
    --kn-cup: min(17cqw, 14cqh);
}

.kn-row{
    display: flex;
    justify-content: center;
    gap: calc(var(--kn-cup) * .12);
}
.kn-rack--left .kn-row,
.kn-rack--right .kn-row{
    flex-direction: column;
}

.kn-cup{
    position: relative;
    width: var(--kn-cup);
    height: var(--kn-cup);
    padding: 0;
    border: calc(var(--kn-cup) * .07) solid var(--kn-team-color);
    border-radius: 50%;
    background: color-mix(in srgb, var(--kn-team-color) 70%, white);
    box-shadow: 0 3px 8px rgba(0, 0, 0, .14);
    cursor: default;
    transition: transform .12s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease, opacity .2s ease;
}
.kn-cup-inner{
    position: absolute;
    inset: 12%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, .5) 0%, rgba(255, 255, 255, 0) 60%);
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, .22);
}
.kn-cup-mark{
    font-size: calc(var(--kn-cup) * .34);
    font-weight: 800;
    line-height: 1;
    color: white;
}

.kn-cup--hittable{
    cursor: pointer;
}
.kn-cup--hittable:active{
    transform: scale(.9);
}
.kn-cup--hit{
    border-color: #D3D6DB;
    background: #E6E8EB;
    box-shadow: none;
    opacity: .55;
}
.kn-cup--hit .kn-cup-inner{
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, .12);
    background: none;
}
.kn-cup--pending{
    border-color: #F5A524;
    background: #FDE7B8;
}
.kn-cup--pending .kn-cup-mark{
    color: #8A5A00;
}
.kn-cup--bomb{
    animation: kn-glow 1.2s ease-in-out infinite;
}
.kn-cup--candidate{
    cursor: pointer;
    animation: kn-glow 1.2s ease-in-out infinite;
}
.kn-cup--chosen{
    border-color: #1F2328;
    background: #1F2328;
}
.kn-cup--chosen .kn-cup-mark{
    color: white;
}
.kn-rack--picking .kn-cup:not(.kn-cup--candidate):not(.kn-cup--chosen){
    opacity: .35;
}

@keyframes kn-glow{
    0%, 100%{ box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(245, 165, 36, .9); }
    50%{ box-shadow: 0 0 0 2px white, 0 0 0 7px rgba(245, 165, 36, .35); }
}

/* ─── Vorderer Bereich (Nullwurf + Steuerung) ─── */
.kn-front{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: 0 0 auto;
    min-height: 0;
    padding: 8px 10px 10px;
}
.kn-rack--left .kn-front,
.kn-rack--right .kn-front{
    width: 30%;
    padding: 10px 6px;
}
.kn-zone-label-miss{
    font-size: 10px;
    text-align: center;
}

/* ─── Zusatzbecher waehlen ─── */
.kn-pick{
    position: absolute;
    left: 50%;
    top: 8px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 14px;
    border-radius: 999px;
    background: #1F2328;
    color: white;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    transform: translateX(-50%);
    box-shadow: 0 6px 18px rgba(0, 0, 0, .2);
}
.kn-pick-cancel{
    padding: 6px 10px;
    border: none;
    border-radius: 999px;
    background: rgba(255, 255, 255, .15);
    color: white;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
}
</style>
