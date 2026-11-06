<template>
    <BottomSheet v-model:visible="visible">
        <template #header>
            <div class="pg-title">Pushes als Pop-up anzeigen</div>
        </template>

        <p class="pg-intro">
            Viele Handys zeigen Pushes von Websites erst nur als Symbol in der Statusleiste.
            Das lässt sich nur in den Handy-Einstellungen ändern – so geht's:
        </p>

        <div class="pg-tabs" role="tablist" aria-label="Handy-Typ">
            <button
                v-for="device in devices"
                :key="device.key"
                type="button"
                role="tab"
                :aria-selected="selected === device.key"
                :class="{ 'is-active': selected === device.key }"
                @click="selected = device.key"
            >{{ device.label }}</button>
        </div>

        <ol class="pg-steps">
            <li v-for="(step, i) in currentSteps" :key="`${selected}-${i}`">
                <span class="pg-step-number">{{ i + 1 }}</span>
                <span class="pg-step-text" v-html="step"></span>
            </li>
        </ol>

        <p v-if="currentDevice.hint" class="pg-hint">
            <i class="pi pi-info-circle"></i>
            <span v-html="currentDevice.hint"></span>
        </p>

        <div class="pg-actions">
            <button type="button" class="pg-test" :disabled="testing" @click="onTest">
                <i class="pi" :class="testing ? 'pi-spin pi-spinner' : 'pi-send'"></i>
                {{ testing ? 'Sende …' : 'Test-Push senden' }}
            </button>
            <button type="button" class="pg-done" @click="visible = false">Fertig</button>
        </div>
    </BottomSheet>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import BottomSheet from '@/components/shared/BottomSheet.vue';
import { usePushNotifications } from '@/components/shared/usePushNotifications';

type DeviceKey = 'android' | 'samsung' | 'xiaomi' | 'iphone';

const visible = defineModel<boolean>('visible', { default: false });

const toast = useToast();
const { sendTest } = usePushNotifications();

// Auf Android liegt die Einstellung bei Chrome (je Website), nur der Name des Schalters
// am Ende unterscheidet sich je Hersteller
const chromeSteps = [
    'In Chrome oben rechts auf <b>⋮</b> und dann auf <b>Einstellungen</b> tippen',
    '<b>Website-Einstellungen</b> → <b>Benachrichtigungen</b> öffnen',
    '<b>bipoopen.de</b> antippen',
    'Unter <b>Benachrichtigungskategorien</b> auf <b>Allgemein</b> tippen',
];

const devices: { key: DeviceKey, label: string, steps: string[], hint?: string }[] = [
    {
        key: 'android',
        label: 'Android',
        steps: [...chromeSteps, '<b>Pop-up auf dem Bildschirm</b> einschalten'],
        hint: 'Schneller: Eine Push in der Statusleiste lange gedrückt halten und über das Zahnrad direkt zu den Einstellungen springen.',
    },
    {
        key: 'samsung',
        label: 'Samsung',
        steps: [...chromeSteps, 'Auf <b>Benachrichtigen</b> stellen und <b>Als Pop-up anzeigen</b> einschalten'],
        hint: 'Nutzt du den Samsung Internet-Browser statt Chrome, findest du die Website unter <b>Einstellungen</b> → <b>Websites und Downloads</b> → <b>Benachrichtigungen</b>.',
    },
    {
        key: 'xiaomi',
        label: 'Xiaomi',
        steps: [...chromeSteps, '<b>Schwebende Benachrichtigungen</b> einschalten'],
        hint: 'Gilt auch für Redmi und POCO.',
    },
    {
        key: 'iphone',
        label: 'iPhone',
        steps: [
            'Die <b>Einstellungen</b> des iPhones öffnen',
            '<b>Mitteilungen</b> → <b>Weck BiPo Open</b> antippen',
            '<b>Mitteilungen erlauben</b> einschalten',
            'Unter <b>Hinweise</b> das <b>Banner</b> auswählen',
        ],
        hint: 'Kommt trotzdem nichts? Prüfe, ob gerade ein <b>Fokus</b> (z. B. Nicht stören) aktiv ist.',
    },
];

const selected = ref<DeviceKey>('android');
const currentDevice = computed(() => devices.find(device => device.key === selected.value)!);
const currentSteps = computed(() => currentDevice.value.steps);

// Passenden Tab vorauswaehlen. Chrome kuerzt den User-Agent, das Modell gibt es nur ueber userAgentData.
const detectDevice = async (): Promise<DeviceKey> => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'iphone';
    if (/samsungbrowser/.test(userAgent)) return 'samsung';

    let model = '';
    try {
        const data = await (navigator as any).userAgentData?.getHighEntropyValues(['model']);
        model = String(data?.model ?? '').toLowerCase();
    } catch {}
    model ||= userAgent;

    if (/\bsm-|samsung/.test(model)) return 'samsung';
    if (/xiaomi|redmi|poco|\bmi \d/.test(model)) return 'xiaomi';
    return 'android';
};

onMounted(async () => { selected.value = await detectDevice(); });

const testing = ref(false);
const onTest = async () => {
    testing.value = true;
    const sent = await sendTest();
    testing.value = false;
    if (!sent) toast.add({ severity: 'error', summary: 'Test nicht gesendet', life: 3000 });
};
</script>

<style scoped>
.pg-title {
    font-size: 18px;
    font-weight: bold;
    color: var(--bp-text-strong);
}

.pg-intro {
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--bp-text);
}

.pg-tabs {
    display: flex;
    gap: 4px;
    margin-top: 16px;
    padding: 4px;
    border-radius: 12px;
    background: var(--bp-fill);

    button {
        flex: 1;
        min-height: 34px;
        padding: 6px 4px;
        border: none;
        border-radius: 9px;
        background: transparent;
        color: var(--bp-text-secondary);
        font-size: 13px;
        font-weight: 700;
        transition: background .2s ease, color .2s ease;
    }
    button.is-active {
        background: var(--bp-surface);
        color: var(--bp-text-strong);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
}

.pg-steps {
    margin: 18px 0 0;
    padding: 0;
    list-style: none;

    li {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 7px 0;
    }
}
.pg-step-number {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--bp-primary-weak);
    color: var(--main-color);
    font-size: 12px;
    font-weight: 800;
}
.pg-step-text {
    padding-top: 2px;
    font-size: 15px;
    line-height: 1.35;
    color: var(--bp-text-strong);
}

.pg-hint {
    display: flex;
    gap: 10px;
    margin: 14px 0 0;
    padding: 12px;
    border-radius: 12px;
    background: var(--bp-info-weak);
    font-size: 13px;
    line-height: 1.4;
    color: var(--bp-text);

    .pi {
        margin-top: 2px;
        color: var(--bp-info);
        font-size: 14px;
    }
}

.pg-actions {
    display: flex;
    gap: 10px;
    margin-top: 22px;

    button {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 48px;
        padding: 10px 14px;
        border: none;
        border-radius: 14px;
        font-size: 15px;
        font-weight: 800;
    }
}
.pg-test {
    background: var(--bp-fill);
    color: var(--bp-text-strong);
}
.pg-test:disabled {
    opacity: .6;
}
.pg-done {
    background: var(--main-color);
    color: white;
}
</style>
