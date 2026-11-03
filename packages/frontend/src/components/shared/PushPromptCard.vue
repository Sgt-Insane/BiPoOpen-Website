<template>
    <!-- Hinweis auf Push an der Stelle, wo der Wunsch entsteht (Home nach Installation, Turniertag).
         Fuehrt nur auf die Einstellungsseite, die Browser-Abfrage kommt erst dort per Tipp. -->
    <div v-if="visible" class="PushPromptCard">
        <router-link :to="to" class="ppc-link">
            <span class="ppc-icon"><BellIcon/></span>
            <span class="min-w-0 flex-1">
                <span class="ppc-title">{{ title }}</span>
                <span class="ppc-text">{{ text }}</span>
            </span>
            <i class="pi pi-angle-right ppc-arrow"></i>
        </router-link>
        <button type="button" class="ppc-close" aria-label="Ausblenden" @click="dismiss">
            <i class="pi pi-times"></i>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import BellIcon from './BellIcon.vue';
import { usePushNotifications } from './usePushNotifications';

const props = defineProps<{
    title: string;
    text: string;
    to: RouteLocationRaw;
    dismissKey: string;     // localStorage: einmal weggeklickt, kommt der Hinweis nicht wieder
}>();

const { status } = usePushNotifications();

const readDismissed = () => {
    try { return localStorage.getItem(props.dismissKey) === '1'; } catch { return false; }
};
const dismissed = ref(readDismissed());

// Nur wenn Push hier noch moeglich ist (iPhone im Safari-Tab: Seite erklaert die Installation)
const visible = computed(() => !dismissed.value && (status.value === 'inactive' || status.value === 'iosInstall'));

const dismiss = () => {
    dismissed.value = true;
    try { localStorage.setItem(props.dismissKey, '1'); } catch { /* privater Modus */ }
};
</script>

<style scoped>
.PushPromptCard {
    position: relative;
    border-radius: 16px;
    background: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.ppc-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 44px 12px 14px;
    color: #1d1f23;
    text-decoration: none;
}
.ppc-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #fde9eb;
    color: var(--main-color);
    font-size: 18px;
}
.ppc-title {
    display: block;
    font-size: 15px;
    font-weight: 800;
    line-height: 1.25;
}
.ppc-text {
    display: block;
    margin-top: 1px;
    font-size: 13px;
    color: #6b717b;
}
.ppc-arrow {
    color: var(--main-color);
    font-size: 16px;
}
.ppc-close {
    position: absolute;
    top: 50%;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #8a9099;
    transform: translateY(-50%);

    .pi {
        font-size: 12px;
    }
}
.ppc-close:hover {
    background: rgba(0, 0, 0, 0.05);
}
</style>
