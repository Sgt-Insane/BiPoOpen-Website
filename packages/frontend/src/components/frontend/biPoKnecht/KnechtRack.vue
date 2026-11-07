<template>
    <div
        class="KnechtRack"
        :class="[`kn-rack--${direction}`, { 'kn-rack--target': isTarget, 'kn-rack--waiting': !isTarget, 'kn-rack--rotated': rotated, 'kn-rack--picking': !!game.pick.value }]"
        :style="{ '--kn-team-color': TEAM_COLORS[teamIndex] }"
        @click="onTableClick"
    >
        <!-- Hinter den Bechern: Airball (Ball ueber den Tisch) -->
        <div v-if="isTarget" class="kn-zone kn-zone-airball" @click.stop="onAirballClick">
            <span class="kn-zone-label"><KnechtIcon name="airball" /> Airball</span>
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
                    @click.stop="onCupClick(cup, $event)"
                >
                    <KnechtIcon v-if="getCupMark(cup)" :name="getCupMark(cup)!" class="kn-cup-mark" />
                    <span v-else-if="pending.has(cup)" class="kn-cup-ball"></span>
                </button>
            </div>
        </div>

        <!-- Vor und neben den Bechern: Nullwurf -->
        <div class="kn-front">
            <span v-if="isTarget && !game.pick.value" class="kn-zone-label kn-zone-label-miss"><KnechtIcon name="miss" /> Nullwurf · neben die Becher tippen</span>
            <slot name="front"></slot>
        </div>

        <!-- Zusatzbecher waehlen (Bouncer, Bombe) -->
        <div v-if="isTarget && game.pick.value" class="kn-pick" @click.stop>
            <KnechtIcon :name="pickIcon" />
            <span class="kn-pick-text">{{ pickText }}</span>
            <button type="button" class="kn-pick-cancel" @click="game.cancelPick()">Abbrechen</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KnechtIcon from './KnechtIcon.vue';
import { CUP_ROWS, getStandingCups } from './knechtEngine';
import type { KnechtIconName } from './knechtIcons';
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

// Bei der Auswahl der Zusatzbecher zeigen die gewaehlten Becher Bombe bzw. Bouncer
const pickIcon = computed<KnechtIconName>(() => props.game.pick.value?.type === 'bomb' ? 'bomb' : 'bouncer');

const getCupMark = (cup: number): KnechtIconName | null => {
    const pick = props.game.pick.value;
    if (pick && props.isTarget && (pick.chosen.includes(cup) || pick.cup === cup)) return pickIcon.value;
    if (pending.value.has(cup) && props.isTarget && props.game.hittableCups.value.has(cup) && !pick) return 'bomb';
    return null;
};

const pickText = computed(() => {
    const pick = props.game.pick.value;
    if (!pick) return '';
    const left = pick.needed - pick.chosen.length;
    if (pick.type === 'bomb') return `Bombe! Noch ${left} Becher wählen`;
    return 'Bouncer: zweiten Becher wählen';
});

// ─── Eingaben (Ball-Anzeige in Bildschirmkoordinaten, siehe useBiPoKnecht.markBall) ───
const onCupClick = (cup: number, event: MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (props.game.tapCup(cup)) props.game.markBall('hit', rect.left + rect.width / 2, rect.top + rect.height / 2);
};

// Tippen auf den freien Tisch = Nullwurf, nur auf dem Feld, auf das geworfen wird
const onTableClick = (event: MouseEvent) => {
    if (!props.isTarget || props.game.pick.value) return;
    if (props.game.throwMiss('miss')) props.game.markBall('miss', event.clientX, event.clientY);
};

// Airball: der Ball landet irgendwo hinter dem Tisch
const onAirballClick = (event: MouseEvent) => {
    if (props.game.pick.value) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (props.game.throwMiss('airball')) {
        props.game.markBall('airball', rect.left + rect.width * (.15 + Math.random() * .7), rect.top + rect.height * (.2 + Math.random() * .6));
    }
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
    background: var(--bp-fill);
    transition: background .25s ease, opacity .25s ease, filter .25s ease;
}
.kn-rack--up{ flex-direction: column; }
.kn-rack--down{ flex-direction: column-reverse; }
.kn-rack--left{ flex-direction: row; }
.kn-rack--right{ flex-direction: row-reverse; }
.kn-rack--rotated{ transform: rotate(180deg); }

.kn-rack--target{
    cursor: pointer;
    background: var(--bp-fill-strong);
    box-shadow: inset 0 0 0 1.5px rgba(31, 35, 40, .08);
}
.kn-rack--waiting{
    background: var(--bp-fill-soft);
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
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--bp-text-subtle);
    pointer-events: none;
}
.kn-zone-label .KnechtIcon{
    font-size: 15px;
}
.kn-rack--left .kn-zone-airball .kn-zone-label{ writing-mode: vertical-rl; transform: rotate(180deg); }
.kn-rack--right .kn-zone-airball .kn-zone-label{ writing-mode: vertical-rl; }

/* ─── Becher (Draufsicht: farbiger Rand, heller Boden) ─── */
.kn-pyramid{
    --kn-cup: min(16.5cqw, 11cqh);
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    justify-content: center;
    gap: calc(var(--kn-cup) * .14);
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
    gap: calc(var(--kn-cup) * .14);
}
.kn-rack--left .kn-row,
.kn-rack--right .kn-row{
    flex-direction: column;
}

.kn-cup{
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--kn-cup);
    height: var(--kn-cup);
    padding: 0;
    border: none;
    border-radius: 50%;
    background: color-mix(in srgb, var(--kn-team-color) 18%, var(--bp-surface));
    box-shadow: inset 0 0 0 calc(var(--kn-cup) * .11) var(--kn-team-color);
    color: var(--kn-team-color);
    cursor: default;
    transition: transform .12s ease, background .2s ease, box-shadow .2s ease, opacity .2s ease;
}
.kn-cup-mark{
    font-size: calc(var(--kn-cup) * .4);
}
.kn-cup-ball{
    width: 34%;
    height: 34%;
    border-radius: 50%;
    background: var(--bp-surface);
    box-shadow: 0 0 0 1px rgba(31, 35, 40, .15);
}

.kn-cup--hittable{
    cursor: pointer;
}
.kn-cup--hittable:active{
    transform: scale(.9);
}
.kn-cup--hit{
    background: transparent;
    box-shadow: inset 0 0 0 1.5px var(--bp-border-strong);
}
.kn-cup--pending{
    background: var(--bp-gold-weak);
    box-shadow: inset 0 0 0 calc(var(--kn-cup) * .11) #F5A524;
    color: var(--bp-gold);
}
.kn-cup--bomb,
.kn-cup--candidate{
    cursor: pointer;
    animation: kn-glow 1.2s ease-in-out infinite;
}
.kn-cup--chosen{
    background: var(--bp-inverse-bg);
    box-shadow: inset 0 0 0 calc(var(--kn-cup) * .11) var(--bp-inverse-bg);
    color: var(--bp-inverse-text);
}
.kn-rack--picking .kn-cup:not(.kn-cup--candidate):not(.kn-cup--chosen){
    opacity: .35;
}

@keyframes kn-glow{
    0%, 100%{ outline: 2px solid rgba(245, 165, 36, .9); outline-offset: 2px; }
    50%{ outline: 2px solid rgba(245, 165, 36, .3); outline-offset: 5px; }
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
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 8px;
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
