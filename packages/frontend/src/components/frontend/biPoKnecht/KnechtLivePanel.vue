<template>
    <!-- Live-Ticker und zweites Handy: Code zum Beitreten, Links teilen, Status -->
    <div class="KnechtLivePanel">
        <template v-if="!live || live.status === 'off'">
            <p class="kl-text">
                <b>Live-Ticker:</b> Zuschauer sehen das Spiel live auf der Webseite.<br>
                <b>Zweites Handy:</b> An der anderen Tischseite mitzählen – beide Handys tragen ins selbe Spiel ein.
            </p>
            <button type="button" class="kl-button kl-button--primary" @click="$emit('start')">
                <span class="kl-dot"></span> Live starten
            </button>
        </template>

        <template v-else>
            <div class="kl-status" :class="`kl-status--${live.status}`">
                <span class="kl-dot"></span>
                <span>{{ statusLabel }}</span>
            </div>

            <template v-if="live.code">
                <div class="kl-label">Code fürs zweite Handy</div>
                <div class="kl-code">{{ live.code }}</div>
                <div class="kl-hint">Auf dem zweiten Handy: „Spiel eintragen“ → „Mit Code beitreten“, oder den Link öffnen.</div>
                <button type="button" class="kl-button kl-button--primary" @click="share(getJoinLink(live.code), 'Beim BiPo Knecht mitzählen')">
                    <i class="pi pi-share-alt"></i> {{ copied === 'join' ? 'Link kopiert ✓' : 'Link fürs zweite Handy teilen' }}
                </button>
            </template>
            <button v-if="live.id" type="button" class="kl-button" @click="share(getWatchLink(live.id), 'BiPo Knecht live', 'watch')">
                <i class="pi pi-eye"></i> {{ copied === 'watch' ? 'Link kopiert ✓' : 'Zuschauer-Link teilen' }}
            </button>

            <button v-if="live.role === 'host'" type="button" class="kl-button kl-button--quiet" @click="$emit('stop')">
                Live beenden (Spiel läuft hier weiter)
            </button>
            <button v-else type="button" class="kl-button kl-button--quiet" @click="$emit('leave')">
                Dieses Handy abmelden (Spiel läuft auf dem anderen weiter)
            </button>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getJoinLink, getWatchLink } from './knechtLive';
import type { LiveStatus } from './useKnechtLiveSync';

export type KnechtLiveInfo = { status: LiveStatus; code: string | null; id: string | null; role: 'host' | 'guest' | null; devices: number };

const props = defineProps<{ live: KnechtLiveInfo | null }>();
defineEmits<{ start: []; stop: []; leave: [] }>();

const statusLabel = computed(() => {
    const live = props.live;
    if (!live) return '';
    if (live.status === 'connecting') return 'Verbinde …';
    if (live.status === 'offline') return 'Keine Verbindung – wird erneut versucht';
    return live.devices > 1 ? `Live · ${live.devices} Handys verbunden` : 'Live · nur dieses Handy';
});

// Teilen-Menue des Handys, sonst in die Zwischenablage
const copied = ref<'join' | 'watch' | null>(null);
const share = async (url: string, title: string, kind: 'join' | 'watch' = 'join') => {
    if (navigator.share) {
        try { await navigator.share({ title, url }); return; } catch { /* abgebrochen: kopieren */ }
    }
    try {
        await navigator.clipboard.writeText(url);
        copied.value = kind;
        setTimeout(() => { if (copied.value === kind) copied.value = null; }, 2000);
    } catch { /* nichts zu tun */ }
};
</script>

<style scoped>
.KnechtLivePanel{
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.kl-text{
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--bp-text);
}
.kl-status{
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.kl-dot{
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #E5484D;
    box-shadow: 0 0 0 0 rgba(229, 72, 77, .6);
    animation: kl-pulse 1.6s infinite;
}
.kl-status--offline .kl-dot,
.kl-status--connecting .kl-dot{
    background: var(--bp-text-faint);
    animation: none;
}
@keyframes kl-pulse{
    0%{ box-shadow: 0 0 0 0 rgba(229, 72, 77, .6); }
    70%{ box-shadow: 0 0 0 8px rgba(229, 72, 77, 0); }
    100%{ box-shadow: 0 0 0 0 rgba(229, 72, 77, 0); }
}
.kl-label{
    margin-top: 4px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--bp-text-secondary);
}
.kl-code{
    font-size: 40px;
    font-weight: 800;
    letter-spacing: .18em;
    color: var(--bp-text-strong);
    font-variant-numeric: tabular-nums;
}
.kl-hint{
    font-size: 13px;
    color: var(--bp-text-muted);
}
.kl-button{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 16px;
    border: 1px solid var(--bp-border);
    border-radius: 14px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
}
.kl-button--primary{
    border-color: var(--main-color);
    background: var(--main-color);
    color: white;
}
.kl-button--primary .kl-dot{
    background: white;
    animation: none;
}
.kl-button--quiet{
    border: none;
    background: none;
    color: var(--bp-text-muted);
    font-size: 13px;
    font-weight: 600;
}
</style>
