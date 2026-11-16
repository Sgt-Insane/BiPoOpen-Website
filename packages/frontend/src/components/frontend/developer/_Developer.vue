<template>
    <div class="Developer">
        <div class="dv-content">
            <div class="dv-hero">
                <div class="dv-hero-head">
                    <button type="button" class="dv-back" aria-label="Zurück" @click="goBack()">
                        <i class="pi pi-chevron-left"></i>
                    </button>
                    <h1 class="dv-hero-title">Entwickler</h1>
                </div>
                <div class="dv-hero-hint">
                    Neue Funktionen auf der echten Seite testen, bevor sie für alle sichtbar sind. Gilt nur auf diesem Gerät.
                </div>
            </div>

            <!-- Entwicklermodus an/aus -->
            <section class="dv-card">
                <!-- Tipp auf die Beschriftung schaltet wie der Schalter selbst -->
                <div class="dv-row">
                    <div class="dv-row-text dv-row-text--toggle" @click="setDevMode(!devState.enabled)">
                        <div class="dv-row-title">Entwicklermodus</div>
                        <div class="dv-row-sub">{{ devState.enabled ? 'An – Features in Arbeit sind sichtbar' : 'Aus – du siehst die Seite wie alle anderen' }}</div>
                    </div>
                    <button type="button" role="switch" class="dv-switch" :aria-checked="devState.enabled" aria-label="Entwicklermodus" @click="setDevMode(!devState.enabled)"></button>
                </div>
            </section>

            <!-- Features -->
            <section class="dv-card">
                <h2 class="dv-card-title">Features</h2>
                <div v-for="feature in features" :key="feature.key" class="dv-row dv-row--feature">
                    <div class="dv-row-text" :class="{ 'dv-row-text--toggle': !feature.released && devState.enabled }"
                        @click="!feature.released && devState.enabled && setFeature(feature.key, !feature.on)">
                        <div class="dv-row-title">{{ feature.title }}</div>
                        <div class="dv-row-sub">{{ feature.description }}</div>
                        <span class="dv-chip" :class="{ 'dv-chip--released': feature.released }">
                            {{ feature.released ? `Seit v${feature.release} für alle` : `In Arbeit · geplant für v${feature.release}` }}
                        </span>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        class="dv-switch"
                        :aria-checked="feature.on"
                        :disabled="feature.released || !devState.enabled"
                        :aria-label="feature.title"
                        @click="setFeature(feature.key, !feature.on)"
                    ></button>
                </div>
            </section>

            <!-- Update-Push -->
            <section class="dv-card">
                <h2 class="dv-card-title">Update-Push</h2>
                <div class="dv-row-sub">So sieht die Benachrichtigung aus, die nach dem Deploy an alle mit „Updates“ geht.</div>
                <div class="dv-segmented" role="radiogroup" aria-label="Version">
                    <button
                        v-for="release in releases"
                        :key="release.version"
                        type="button"
                        role="radio"
                        :aria-checked="release.version === selectedVersion"
                        @click="selectedVersion = release.version"
                    >v{{ release.version }}<template v-if="release.draft"> · Entwurf</template></button>
                </div>

                <div v-if="push" class="dv-notification">
                    <img src="/pwa-icon-192.png" alt="" class="dv-notification-icon" />
                    <div class="dv-notification-body">
                        <div class="dv-notification-app">Weck BiPo Open · jetzt</div>
                        <div class="dv-notification-title">{{ push.title }}</div>
                        <div class="dv-notification-text">{{ push.body }}</div>
                    </div>
                </div>

                <div v-if="selected" class="dv-push-status">
                    <template v-if="selected.draft">Entwurf: kein Push. Verschickt wird er, sobald bei v{{ selected.version }} in releases.json „draft“ entfernt und gemergt wird.</template>
                    <template v-else-if="selected.version === latestPublished?.version">Wird beim nächsten Deploy einmal verschickt (falls noch nicht geschehen).</template>
                    <template v-else>Ältere Version – wurde bereits angekündigt oder wird übersprungen.</template>
                </div>

                <button type="button" class="dv-button" :disabled="!push" @click="sendTestPush()">
                    <i class="pi pi-bell"></i> Test-Push an dieses Gerät
                </button>
                <div v-if="testMessage" class="dv-row-sub">{{ testMessage }}</div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
    FEATURES, buildReleasePush, devState, draftReleases, isFeatureToggledOn, isReleased, publishedReleases,
    setDevMode, setFeature, type FeatureKey,
} from '@/util/featureFlags';

const router = useRouter();

const features = computed(() => (Object.keys(FEATURES) as FeatureKey[]).map(key => ({
    key,
    ...FEATURES[key],
    released: isReleased(key),
    on: isReleased(key) || (devState.enabled && isFeatureToggledOn(key)),
})));

// Neueste zuerst: Entwuerfe, dann die zuletzt veroeffentlichte Version
const latestPublished = publishedReleases.at(-1);
const releases = [...[...draftReleases].reverse(), ...(latestPublished ? [latestPublished] : [])];
const selectedVersion = ref(releases[0]?.version ?? '');
const selected = computed(() => releases.find(release => release.version === selectedVersion.value));
const push = computed(() => selected.value ? buildReleasePush(selected.value) : null);

// Lokale Benachrichtigung mit denselben Daten wie der echte Push (ohne Server, nur dieses Geraet)
const testMessage = ref('');
const sendTestPush = async () => {
    if (!push.value) return;
    testMessage.value = '';
    if (!('Notification' in window)) {
        testMessage.value = 'Dieser Browser kann keine Benachrichtigungen anzeigen.';
        return;
    }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') {
        testMessage.value = 'Benachrichtigungen sind für diese Seite blockiert.';
        return;
    }
    const { title, body, url, tag } = push.value;
    const options: NotificationOptions = { body, icon: '/pwa-icon-192.png', badge: '/push-badge.png', tag: `test-${tag}`, data: { url } };
    const registration = 'serviceWorker' in navigator
        ? await Promise.race([navigator.serviceWorker.ready, new Promise<null>(resolve => setTimeout(() => resolve(null), 2000))])
        : null;
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
    testMessage.value = 'Gesendet – schau in deine Benachrichtigungen.';
};

const goBack = () => {
    if (window.history.state?.back) router.back();
    else router.push('/');
};
</script>

<style scoped>
.Developer{
    margin-inline: calc(50% - 50vw);
    padding: 12px calc(50vw - 50%) 32px;
    background: var(--page-gray);
}
.dv-content{
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 640px;
    margin: 0 auto;
}
.dv-hero{
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 12px 18px;
    border-radius: 20px;
    background: var(--bp-hero);
    color: white;
}
.dv-hero-head{
    display: flex;
    align-items: center;
    gap: 4px;
    height: 44px;
}
.dv-back{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: white;
    cursor: pointer;
}
.dv-hero-title{
    margin: 0;
    font-size: 22px;
    font-weight: 800;
}
.dv-hero-hint{
    padding: 0 4px;
    font-size: 14px;
    color: #C9D2E6;
}
.dv-card{
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 16px;
    background: var(--bp-surface);
    box-shadow: 0 1px 2px rgba(16, 24, 40, .06);
}
.dv-card-title{
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.dv-row{
    display: flex;
    align-items: center;
    gap: 12px;
}
.dv-row--feature{
    align-items: flex-start;
    padding-top: 12px;
    border-top: 1px solid var(--bp-border);
}
.dv-row-text--toggle{
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.dv-row-text{
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-width: 0;
}
.dv-row-title{
    font-size: 15px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.dv-row-sub{
    font-size: 13px;
    color: var(--bp-text-muted);
}
.dv-chip{
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #FFF4DB;
    color: #9A6400;
    font-size: 11px;
    font-weight: 700;
}
.dv-chip--released{
    background: var(--bp-primary-weak);
    color: var(--main-color);
}
.dv-switch{
    position: relative;
    flex-shrink: 0;
    width: 48px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--bp-border-strong);
    transition: background .2s ease;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.dv-switch::after{
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--bp-surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
    transition: transform .2s ease;
}
.dv-switch[aria-checked="true"]{
    background: var(--main-color);
}
.dv-switch[aria-checked="true"]::after{
    transform: translateX(20px);
}
.dv-switch:disabled{
    opacity: .45;
    cursor: default;
}
.dv-segmented{
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: var(--page-gray);
}
.dv-segmented button{
    flex: 1;
    min-height: 36px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--bp-text-muted);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
}
.dv-segmented button[aria-checked="true"]{
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    box-shadow: 0 1px 2px rgba(0, 0, 0, .1);
}
/* Nachbau einer Handy-Benachrichtigung */
.dv-notification{
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 20px;
    background: #2B2D31;
    color: white;
    box-shadow: 0 6px 20px rgba(0, 0, 0, .18);
}
.dv-notification-icon{
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    border-radius: 9px;
}
.dv-notification-body{
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}
.dv-notification-app{
    font-size: 12px;
    color: #A9ACB3;
}
.dv-notification-title{
    font-size: 15px;
    font-weight: 700;
}
.dv-notification-text{
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    font-size: 14px;
    line-height: 1.35;
    color: #E3E5E8;
}
.dv-push-status{
    font-size: 13px;
    color: var(--bp-text);
}
.dv-button{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 46px;
    border: none;
    border-radius: 12px;
    background: var(--main-color);
    color: white;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
}
.dv-button:disabled{
    opacity: .5;
}
</style>
