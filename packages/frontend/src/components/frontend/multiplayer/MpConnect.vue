<template>
    <div class="MpConnect">
        <!-- Anstossen -->
        <div class="mc-bump" :class="`mc-bump--${bumpState}`">
            <!-- Vor dem Freischalten: zwei Handys stossen an. Danach der Becher, das Bier folgt der Handybewegung -->
            <div v-if="needsActivation" class="mc-phones" aria-hidden="true">
                <span class="mc-phone mc-phone--left"><Avatar :name="profileName ?? ''" class="mc-phone-avatar" :lazy="false" /></span>
                <span class="mc-spark">✦</span>
                <span class="mc-phone mc-phone--right"><i class="pi pi-user"></i></span>
            </div>
            <BeerCup v-else :key="sloshKey" class="mc-cup" :color="cupColor" :slosh="sloshing" :sway="sloshing ? 0 : sway" :direction="direction" />
            <div class="mc-bump-title">{{ title }}</div>
            <div class="mc-bump-text">{{ text }}</div>

            <!-- Sensor aktiv: bereit oder (nach einem Stoss) Suche - immer passend zum Titel -->
            <div v-if="sensorActive" class="mc-sensor" :class="{ 'mc-sensor--hit': bumpState === 'searching' }">
                <span class="mc-sensor-dot" aria-hidden="true"></span>
                <span class="mc-sensor-label">{{ bumpState === 'searching' ? 'Angestoßen!' : 'Bereit – jetzt anstoßen' }}</span>
            </div>

            <button v-if="needsActivation" type="button" class="mc-button mc-button--primary" @click="$emit('enable')">
                Anstoßen aktivieren
            </button>
            <button v-else-if="showTapFallback" v-hint="'Kein Bewegungssensor? Zählt auf 3 und tippt beide gleichzeitig.'" type="button" class="mc-tap" :disabled="bumpState === 'searching'" @click="$emit('bump')">
                <span class="mc-tap-title">Gleichzeitig tippen</span>
            </button>
        </div>

        <div class="mc-divider"><span>oder mit PIN</span></div>

        <form class="mc-code" @submit.prevent="submitCode">
            <input
                v-model="code"
                class="mc-code-input"
                inputmode="numeric"
                autocomplete="off"
                maxlength="4"
                placeholder="PIN"
                aria-label="PIN eingeben"
                @input="code = code.replace(/\D/g, '').slice(0, 4)"
            />
            <button v-hint="'PIN aus der Lobby eines anderen Handys'" type="submit" class="mc-button mc-button--primary" :disabled="code.length !== 4 || busy">Beitreten</button>
        </form>
        <button v-hint="'Die anderen geben die PIN dieser Lobby ein'" type="button" class="mc-button mc-create" :disabled="busy" @click="$emit('create')">
            <i class="pi pi-plus"></i> Neue Lobby – PIN für die anderen anzeigen
        </button>

        <p v-if="isLocal" class="mc-demo">Demo-Modus: Mehrere Tabs in diesem Browser spielen gegeneinander. Anstoßen geht hier über „Gleichzeitig tippen“ in zwei Tabs.</p>
    </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { TEAM_COLORS } from '../biPoKnecht/KnechtUtilFunctions';
import Avatar from '@/components/shared/Avatar.vue';
import BeerCup from './BeerCup.vue';
import { useProfile } from './useProfile';

const props = defineProps<{
    bumpState: 'idle' | 'searching' | 'found' | 'none';
    isSupported: boolean;
    isListening: boolean;
    denied: boolean;
    hasSensor: boolean | null;
    busy: boolean;
    isLocal: boolean;
    detectedAt?: number;        // Zeitpunkt des letzten erkannten Stosses
    sway?: number;              // Bier im Becher, -1..1
    direction?: 1 | -1;         // Bewegungsrichtung beim Stoss
}>();

const emit = defineEmits<{ enable: []; bump: []; create: []; join: [code: string] }>();

const { profileName } = useProfile();
const code = ref('');
const needsActivation = computed(() => !props.isListening && props.isSupported && !props.denied);

// Becher mal rot, mal blau. Bei erkanntem Stoss (oder Gleichzeitig-Tippen) kippt er kurz und schwappt ueber
const cupColor = TEAM_COLORS[Math.random() < .5 ? 0 : 1];
const sloshKey = ref(0);
const sloshing = ref(false);
let sloshTimer: ReturnType<typeof setTimeout> | null = null;
let lastSlosh = 0;
const slosh = () => {
    if (Date.now() - lastSlosh < 1200) return;
    lastSlosh = Date.now();
    sloshKey.value++;
    sloshing.value = true;
    if (sloshTimer) clearTimeout(sloshTimer);
    sloshTimer = setTimeout(() => { sloshing.value = false; }, 1100);
};
watch(() => props.detectedAt, (at) => { if (at) slosh(); });
watch(() => props.bumpState, (state) => {
    if (state !== 'searching' || lastSlosh > Date.now() - 1200) return;
    navigator.vibrate?.(40);
    slosh();
});
onUnmounted(() => { if (sloshTimer) clearTimeout(sloshTimer); });

const sensorActive = computed(() => props.isListening && props.hasSensor === true && props.bumpState !== 'found');

const showTapFallback = computed(() => props.isLocal || !props.isSupported || props.denied || props.hasSensor === false);

const title = computed(() => {
    switch (props.bumpState) {
        case 'searching': return 'Suche Gegenüber …';
        case 'found': return 'Prost! 🍻';
        default: return 'Anstoßen 🍻';
    }
});

const text = computed(() => {
    // Kein Gegenueber: kein Fehler, einfach wieder bereit
    if (props.bumpState === 'none') return 'Niemand gefunden – einfach nochmal anstoßen.';
    if (props.bumpState === 'searching') return 'Gleich geht’s los.';
    if (props.denied) return 'Bewegungssensor nicht erlaubt.';
    return 'Wie mit dem Bier: Handys kurz aneinanderstoßen.';
});

const submitCode = () => {
    if (code.value.length === 4) emit('join', code.value);
};
</script>

<style scoped>
.mc-sensor{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding: 6px 14px 6px 8px;
    border-radius: 999px;
    background: var(--bp-success-weak);
    color: var(--bp-success-strong);
    font-size: 13px;
    font-weight: 700;
}
.mc-sensor-dot{
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: mc-pulse 1.4s ease-in-out infinite;
}
@keyframes mc-pulse{ 50%{ opacity: .3; } }
.mc-sensor--hit{
    background: var(--main-color);
    color: white;
}
.MpConnect{
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.mc-bump{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 26px 18px 20px;
    border-radius: 22px;
    background: var(--bp-surface);
    border: 1px solid var(--bp-border);
    text-align: center;
}
.mc-phones{
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 96px;
    margin-bottom: 6px;
}
.mc-phone{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 88px;
    border: 4px solid var(--bp-text-strong);
    border-radius: 12px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-muted);
}
.mc-phone-avatar{
    width: 32px !important;
    height: 32px !important;
    font-size: 12px;
}
.mc-phone--left{ animation: mc-left 1.6s ease-in-out infinite; }
.mc-phone--right{ animation: mc-right 1.6s ease-in-out infinite; }
.mc-spark{
    font-size: 20px;
    color: var(--main-color);
    opacity: 0;
    animation: mc-spark 1.6s ease-in-out infinite;
}
@keyframes mc-left{
    0%, 100%{ transform: translateX(-14px) rotate(-10deg); }
    45%, 55%{ transform: translateX(10px) rotate(0); }
}
@keyframes mc-right{
    0%, 100%{ transform: translateX(14px) rotate(10deg); }
    45%, 55%{ transform: translateX(-10px) rotate(0); }
}
@keyframes mc-spark{
    45%, 55%{ opacity: 1; transform: scale(1.4); }
}
.mc-cup{
    width: 200px;
    height: 240px;
    margin: 4px 0 8px;
}
.mc-bump--searching .mc-cup{ animation: mc-wait .8s ease-in-out infinite; }
@keyframes mc-wait{ 50%{ transform: translateY(-4px); } }

.mc-bump-title{
    font-size: 20px;
    font-weight: 900;
    color: var(--bp-text-strong);
}
.mc-bump-text{
    max-width: 340px;
    font-size: 14px;
    color: var(--bp-text-secondary);
}
.mc-button{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none;
    border-radius: 999px;
    padding: 11px 20px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-strong);
    font-weight: 800;
    font-size: 15px;
}
.mc-button--primary{
    background: var(--main-color);
    color: white;
}
.mc-button:disabled{ opacity: .5; }
.mc-tap{
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    margin-top: 6px;
    padding: 18px;
    border: 2px dashed var(--main-color);
    border-radius: 18px;
    background: var(--bp-primary-faint);
    color: var(--bp-text-strong);
}
.mc-tap:active{ transform: scale(.98); }
.mc-tap:disabled{ opacity: .6; }
.mc-tap-title{
    font-size: 17px;
    font-weight: 900;
    color: var(--main-color);
}
.mc-tap-text{
    font-size: 12px;
    color: var(--bp-text-secondary);
}
.mc-divider{
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--bp-text-muted);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
}
.mc-divider::before, .mc-divider::after{
    content: '';
    flex: 1;
    height: 1px;
    background: var(--bp-border-strong);
}
.mc-code{
    display: flex;
    gap: 10px;
}
.mc-code-input{
    flex: 1;
    min-width: 0;
    padding: 10px 14px;
    border: 1px solid var(--bp-border-strong);
    border-radius: 14px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font-size: 24px;
    font-weight: 800;
    letter-spacing: .4em;
    text-align: center;
}
.mc-create{ width: 100%; }
.mc-demo{
    margin: 0;
    font-size: 12px;
    color: var(--bp-text-secondary);
    text-align: center;
}
</style>
