<template>
    <div class="MpConnect">
        <!-- Anstossen -->
        <div class="mc-bump" :class="`mc-bump--${bumpState}`">
            <div class="mc-phones" aria-hidden="true">
                <span class="mc-phone mc-phone--left"><Avatar :name="profileName ?? ''" class="mc-phone-avatar" :lazy="false" /></span>
                <span class="mc-spark">✦</span>
                <span class="mc-phone mc-phone--right"><i class="pi pi-user"></i></span>
            </div>
            <div class="mc-bump-title">{{ title }}</div>
            <div class="mc-bump-text">{{ text }}</div>

            <button v-if="!isListening && isSupported && !denied" type="button" class="mc-button mc-button--primary" @click="$emit('enable')">
                Anstoßen aktivieren
            </button>
            <button v-else-if="showTapFallback" type="button" class="mc-tap" :disabled="bumpState === 'searching'" @click="$emit('bump')">
                <span class="mc-tap-title">Gleichzeitig tippen</span>
                <span class="mc-tap-text">Kein Sensor? Zählt auf 3 und tippt beide gleichzeitig.</span>
            </button>
        </div>

        <div class="mc-divider"><span>oder mit Code</span></div>

        <form class="mc-code" @submit.prevent="submitCode">
            <input
                v-model="code"
                class="mc-code-input"
                inputmode="numeric"
                autocomplete="off"
                maxlength="4"
                placeholder="1234"
                aria-label="Code eingeben"
                @input="code = code.replace(/\D/g, '').slice(0, 4)"
            />
            <button type="submit" class="mc-button mc-button--primary" :disabled="code.length !== 4 || busy">Beitreten</button>
        </form>
        <button type="button" class="mc-button mc-create" :disabled="busy" @click="$emit('create')">
            <i class="pi pi-plus"></i> Neues Spiel – Code für die anderen anzeigen
        </button>

        <p v-if="isLocal" class="mc-demo">Demo-Modus: Mehrere Tabs in diesem Browser spielen gegeneinander. Anstoßen geht hier über „Gleichzeitig tippen“ in zwei Tabs.</p>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import { useProfile } from './useProfile';

const props = defineProps<{
    bumpState: 'idle' | 'searching' | 'found' | 'none';
    isSupported: boolean;
    isListening: boolean;
    denied: boolean;
    hasSensor: boolean | null;
    busy: boolean;
    isLocal: boolean;
}>();

const emit = defineEmits<{ enable: []; bump: []; create: []; join: [code: string] }>();

const { profileName } = useProfile();
const code = ref('');

const showTapFallback = computed(() => props.isLocal || !props.isSupported || props.denied || props.hasSensor === false);

const title = computed(() => {
    switch (props.bumpState) {
        case 'searching': return 'Suche Mitspieler …';
        case 'found': return 'Verbunden!';
        case 'none': return 'Niemanden gefunden';
        default: return 'Handys aneinanderstoßen';
    }
});

const text = computed(() => {
    if (props.bumpState === 'none') return 'Beide Handys gleichzeitig und kurz aneinanderstoßen – beide müssen diese Seite offen haben.';
    if (props.bumpState === 'searching') return 'Gleich geht’s los.';
    if (props.denied) return 'Bewegungssensor nicht erlaubt – nutzt „Gleichzeitig tippen“ oder einen Code.';
    if (props.isListening && props.hasSensor !== false) return 'Haltet eure Handys fest und stoßt sie kurz aneinander. Beide brauchen diese Seite offen.';
    return 'Öffnet beide diese Seite und stoßt eure Handys kurz aneinander.';
});

const submitCode = () => {
    if (code.value.length === 4) emit('join', code.value);
};
</script>

<style scoped>
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
.mc-bump--searching .mc-phone{ animation-duration: .5s; }
.mc-bump--searching .mc-spark{ animation-duration: .5s; }
.mc-bump--found .mc-phone, .mc-bump--found .mc-spark{ animation: none; }
.mc-bump--found .mc-phone{ border-color: var(--bp-success); }
.mc-bump--none .mc-bump-title{ color: var(--main-color); }

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
