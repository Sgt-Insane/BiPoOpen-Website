<template>
    <div class="NotificationsUnavailable">
        <!-- iPhone im Safari-Tab: Push gibt es erst als installierte App -->
        <template v-if="status === 'iosInstall'">
            <div class="nu-ios">
                <span class="nu-ios-emoji" aria-hidden="true">📱</span>
                <div>
                    <div class="nu-ios-title">Auf dem iPhone nur in der App</div>
                    <div class="nu-ios-text">Apple erlaubt Push nur, wenn die Seite auf dem Home-Bildschirm liegt. Dauert 10 Sekunden:</div>
                </div>
            </div>

            <ol class="nt-card nu-steps">
                <li class="nu-step">
                    <span class="nu-step-number">1</span>
                    <span class="nu-step-text">In Safari unten auf <strong>Teilen</strong> tippen</span>
                    <span class="nt-icon nu-step-icon nu-step-icon--share">
                        <!-- iOS-Teilen-Symbol -->
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                </li>
                <li class="nu-step">
                    <span class="nu-step-number">2</span>
                    <span class="nu-step-text"><strong>Zum Home-Bildschirm</strong> wählen</span>
                    <span class="nt-icon nu-step-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </span>
                </li>
                <li class="nu-step">
                    <span class="nu-step-number">3</span>
                    <span class="nu-step-text">Die App über das neue Icon öffnen und hier aktivieren</span>
                    <img src="/pwa-icon-192.png" alt="" class="nu-step-app-icon">
                </li>
            </ol>

            <div class="nu-ios-pointer">
                Teilen-Symbol sitzt in der Safari-Leiste
                <i class="pi pi-arrow-down"></i>
            </div>
        </template>

        <!-- Einmal abgelehnt: Browser fragt nie wieder, nur ueber die Einstellungen -->
        <div v-else-if="status === 'denied'" class="nt-card nu-message">
            <span class="nt-icon nu-message-icon"><i class="pi pi-lock"></i></span>
            <div>
                <div class="nt-row-title">Benachrichtigungen sind blockiert</div>
                <div class="nt-row-text">Erlaube sie in den Einstellungen deines Browsers für {{ host }} und lade die Seite neu.</div>
            </div>
        </div>

        <div v-else class="nt-card nu-message">
            <span class="nt-icon nu-message-icon"><i class="pi pi-bell-slash"></i></span>
            <div>
                <div class="nt-row-title">Dein Browser kann keine Benachrichtigungen</div>
                <div class="nt-row-text">Probier es mit Chrome, Edge oder Firefox – auf dem iPhone mit der App vom Home-Bildschirm.</div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { PushStatus } from '@/components/shared/usePushNotifications';

defineProps<{ status: PushStatus }>();

const host = window.location.hostname.replace(/^www\./, '');
</script>

<style scoped>
/* ─── iPhone ─── */
.nu-ios {
    display: flex;
    gap: 12px;
    padding: 14px;
    border-radius: 16px;
    background: #fdf6e3;
}
.nu-ios-emoji {
    font-size: 26px;
    line-height: 1;
}
.nu-ios-title {
    font-size: 15px;
    font-weight: 800;
}
.nu-ios-text {
    margin-top: 2px;
    font-size: 13px;
    line-height: 1.35;
    color: #5f5636;
}

.nu-steps {
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
}
.nu-step {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
}
.nu-step + .nu-step {
    border-top: 1px solid #f0f1f3;
}
.nu-step-number {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #1d1f23;
    color: white;
    font-size: 12px;
    font-weight: 800;
}
.nu-step-text {
    flex: 1;
    font-size: 14px;
    line-height: 1.35;
}
.nu-step-icon {
    background: #f1f2f4;
    color: #1d1f23;

    svg {
        width: 20px;
        height: 20px;
    }
}
.nu-step-icon--share {
    background: #e8f0fe;
    color: #2f6fe4;
}
.nu-step-app-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
}

.nu-ios-pointer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 18px;
    font-size: 12px;
    color: #8a9099;

    .pi {
        font-size: 14px;
    }
}

/* ─── Blockiert / nicht unterstuetzt ─── */
.nu-message {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
}
.nu-message-icon {
    background: #fde9eb;
    color: var(--main-color);
}
</style>
