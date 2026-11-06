<template>
    <div class="NotificationsIntro">
        <!-- Vorschau: so sehen die Pushes aus (Texte wie in backend/src/util/notify.ts) -->
        <div class="ni-preview" aria-hidden="true">
            <div v-for="(example, i) in examples" :key="i" class="ni-push" :class="{ 'ni-push--back': i > 0 }">
                <img :src="appIcon" alt="" class="ni-push-icon">
                <div class="min-w-0 flex-1">
                    <div class="ni-push-head">
                        <span>Weck BiPo Open</span>
                        <span class="ni-push-time">jetzt</span>
                    </div>
                    <div class="ni-push-title">{{ example.title }}</div>
                    <div class="ni-push-body">{{ example.body }}</div>
                </div>
            </div>
        </div>

        <button type="button" class="ni-activate" :disabled="loading" @click="emit('activate')">
            <i v-if="loading" class="pi pi-spin pi-spinner"></i>
            <BellIcon v-else/>
            {{ followNames.length ? `Aktivieren & ${followLabel} folgen` : 'Benachrichtigungen aktivieren' }}
        </button>
        <p class="ni-note">Dein Browser fragt danach einmal nach der Erlaubnis.</p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BellIcon from '@/components/shared/BellIcon.vue';

const props = defineProps<{ followNames: string[], loading: boolean }>();
const emit = defineEmits<{ activate: [] }>();

const appIcon = '/pwa-icon-192.png';

const examples = [
    { title: '🍺 Jonas & Leon gewinnen 10 : 9', body: 'gegen Simon & Patrick · Offenes Spiel' },
    { title: '🏆 Don Promillo 10 : 3 BPC Likör', body: '1. Liga · BiPo League' },
];

// Vorname reicht auf dem Button, bei mehreren die Anzahl
const followLabel = computed(() => props.followNames.length === 1 ? props.followNames[0].split(' ')[0] : `${props.followNames.length} Spielern`);
</script>

<style scoped>
.ni-preview {
    position: relative;
    overflow: hidden;
    padding: 22px 16px 20px;
    border-radius: 20px;
    background: radial-gradient(circle at 85% 30%, rgba(255, 255, 255, 0.08) 0 22%, transparent 23%),
                linear-gradient(160deg, #1f3a6b 0%, #142650 55%, #0f1d3f 100%);
}
.ni-push {
    display: flex;
    gap: 10px;
    padding: 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.86);
    backdrop-filter: blur(10px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}
/* Zweite Push etwas kleiner und dahinter, wie im Sperrbildschirm */
.ni-push--back {
    margin: 12px 8px 0;
    background: rgba(255, 255, 255, 0.62);
    transform: scale(.97);
}
.ni-push-icon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
}
.ni-push-head {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 700;
    color: var(--bp-text);
}
.ni-push-time {
    font-weight: 400;
    color: var(--bp-text-muted);
}
.ni-push-title {
    margin-top: 1px;
    font-size: 14px;
    font-weight: 800;
    color: var(--bp-text-strong);
    overflow-wrap: anywhere;
}
.ni-push-body {
    font-size: 13px;
    color: var(--bp-text);
}

.ni-activate {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    min-height: 52px;
    margin-top: 20px;
    padding: 12px 16px;
    border: none;
    border-radius: 14px;
    background: var(--main-color);
    color: white;
    font-size: 16px;
    font-weight: 800;
    transition: background .2s ease;
}
.ni-activate:hover {
    background: #d4434f;
}
.ni-activate:disabled {
    opacity: .75;
}
.ni-note {
    margin: 12px 0 0;
    font-size: 12px;
    text-align: center;
    color: var(--bp-text-subtle);
}
</style>
