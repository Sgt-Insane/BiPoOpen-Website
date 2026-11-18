<template>
    <!-- Live-Ticker und mehrere Handys: Code zum Beitreten, wer mit welchem Handy eintraegt, Links teilen -->
    <div class="KnechtLivePanel">
        <template v-if="!live || live.status === 'off'">
            <p class="kl-text">
                <b>Live-Ticker:</b> Zuschauer sehen das Spiel live auf der Webseite.<br>
                <b>Mehrere Handys:</b> Jeder Spieler oder jedes Tischende trägt auf dem eigenen Handy ein, alle im selben Spiel.
            </p>
            <button type="button" class="kl-button kl-button--primary" @click="emit('action', { type: 'start' })">
                <span class="kl-dot"></span> Live starten
            </button>
        </template>

        <template v-else>
            <div class="kl-status" :class="`kl-status--${live.status}`">
                <span class="kl-dot"></span>
                <span>{{ statusLabel }}</span>
            </div>

            <!-- Weitere Handys: beitreten auch waehrend des Spiels -->
            <template v-if="live.code">
                <div class="kl-label">PIN für weitere Handys</div>
                <div class="kl-code">{{ live.code }}</div>
                <div class="kl-hint">Auf dem anderen Handy: „+ Spiel“ → „Mit PIN beitreten“, oder den Link öffnen. Dort wählt man, für wen das Handy einträgt.</div>
                <div v-if="referee" class="kl-hint">Mit mehreren Handys geht nur der Spieler-Modus. Kommt ein Handy dazu, wechselt dieses Handy dorthin.</div>
                <button type="button" class="kl-button kl-button--primary" @click="share(getJoinLink(live.code), 'Mit dem BiPo Knecht mittracken')">
                    <i class="pi pi-share-alt"></i> {{ copied === 'join' ? 'Link kopiert ✓' : 'Link für weitere Handys teilen' }}
                </button>
            </template>

            <!-- Handys im Spiel -->
            <template v-if="live.devices.length > 1">
                <div class="kl-label">Handys im Spiel</div>
                <ul class="kl-devices">
                    <li v-for="device in live.devices" :key="device.id" class="kl-device" :class="{ 'kl-device--me': device.id === live.deviceId }">
                        <span class="kl-device-dot" :style="{ background: device.team === null ? 'var(--bp-text-faint)' : getTeamColor(match, device.team) }"></span>
                        <span class="kl-device-text">
                            <b>{{ device.id === live.deviceId ? 'Dieses Handy' : deviceName(device) }}</b>
                            <small>{{ bindingLabel(device) }}</small>
                        </span>
                        <button v-if="device.id !== live.deviceId" type="button" class="kl-device-remove" :aria-label="`${deviceName(device)} trennen`" @click="emit('action', { type: 'kick', deviceId: device.id })">
                            <i class="pi pi-times"></i>
                        </button>
                    </li>
                </ul>

                <div class="kl-label">Dieses Handy trägt ein für</div>
                <select class="kl-select" :value="ownKey" @change="onBind(($event.target as HTMLSelectElement).value)">
                    <option v-for="option in bindingOptions" :key="option.key" :value="option.key" :disabled="option.taken">
                        {{ option.label }}{{ option.taken ? ' (anderes Handy)' : '' }}
                    </option>
                </select>
                <div class="kl-hint">Spieler ohne eigenes Handy trägt ein Handy ihres Teams mit ein.</div>
            </template>

            <button v-if="live.id" type="button" class="kl-button" @click="share(getWatchLink(live.id), 'BiPo Knecht live', 'watch')">
                <i class="pi pi-eye"></i> {{ copied === 'watch' ? 'Link kopiert ✓' : 'Zuschauer-Link teilen' }}
            </button>

            <button v-if="live.devices.length > 1" type="button" class="kl-button kl-button--quiet" @click="emit('action', { type: 'leave' })">
                Dieses Handy abmelden (Spiel läuft auf den anderen weiter)
            </button>
            <button v-else type="button" class="kl-button kl-button--quiet" @click="emit('action', { type: 'stop' })">
                Live beenden (Spiel läuft hier weiter)
            </button>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { getJoinLink, getWatchLink } from './knechtLive';
import { getTeamColor, getTeamName } from './KnechtUtilFunctions';
import { isBindingTaken, type LiveDevice, type LiveDeviceBinding } from './liveDevices';
import { deviceName, type LiveStatus } from './useKnechtLiveSync';

// team: wofuer dieses Handy eintraegt (aus der gespeicherten Bindung, schon bevor die Geraeteliste geladen ist)
export type KnechtLiveInfo = { status: LiveStatus; code: string | null; id: string | null; devices: LiveDevice[]; deviceId: string | null; team?: number | null };
export type KnechtLiveAction =
    | { type: 'start' | 'stop' | 'leave' }
    | { type: 'kick'; deviceId: string }
    | { type: 'bind'; binding: LiveDeviceBinding };

const props = defineProps<{ live: KnechtLiveInfo | null; match: Match; referee?: boolean }>();
const emit = defineEmits<{ action: [action: KnechtLiveAction] }>();

const statusLabel = computed(() => {
    const live = props.live;
    if (!live) return '';
    if (live.status === 'connecting') return 'Verbinde …';
    if (live.status === 'offline') return 'Keine Verbindung – wird erneut versucht';
    return live.devices.length > 1 ? `Live · ${live.devices.length} Handys verbunden` : 'Live · nur dieses Handy';
});

const teamOf = (team: number) => team === 0 ? props.match.team1 : props.match.team2;
const bindingLabel = (binding: LiveDeviceBinding) => {
    if (binding.team === null) return 'Ganzer Tisch';
    if (binding.player === null) return `Tischende ${getTeamName(props.match, binding.team)}`;
    return teamOf(binding.team).players[binding.player]?.name ?? 'Spieler';
};

// Auswahl: jeder Spieler und (bei mehreren Spielern) das ganze Tischende eines Teams
const keyOf = (binding: LiveDeviceBinding) => `${binding.team}-${binding.player}`;
const bindingOptions = computed(() => {
    const devices = props.live?.devices ?? [];
    const myId = props.live?.deviceId ?? undefined;
    return [0, 1].flatMap(team => {
        const players = teamOf(team).players.map((_, player) => ({ team, player } as LiveDeviceBinding));
        const bindings = players.length > 1 ? [...players, { team, player: null }] : players;
        return bindings.map(binding => ({ key: keyOf(binding), binding, label: bindingLabel(binding), taken: isBindingTaken(devices, binding, myId) }));
    });
});
const ownKey = computed(() => {
    const me = props.live?.devices.find(device => device.id === props.live?.deviceId);
    if (!me) return '';
    // Ein Spieler pro Team: Tischende und Spieler sind dasselbe
    if (me.team !== null && me.player === null && teamOf(me.team).players.length === 1) return keyOf({ team: me.team, player: 0 });
    return keyOf(me);
});
const onBind = (key: string) => {
    const option = bindingOptions.value.find(entry => entry.key === key);
    if (option && key !== ownKey.value) emit('action', { type: 'bind', binding: option.binding });
};

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
.kl-devices{
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.kl-device{
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 4px 6px 4px 12px;
    border: 1px solid var(--bp-border);
    border-radius: 14px;
    background: var(--bp-surface);
}
.kl-device--me{ border-color: var(--main-color); }
.kl-device-dot{
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
}
.kl-device-text{
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: var(--bp-text-strong);
}
.kl-device-text small{
    font-size: 12px;
    color: var(--bp-text-muted);
}
.kl-device-remove{
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--bp-text-muted);
    cursor: pointer;
}
.kl-select{
    min-height: 48px;
    padding: 0 12px;
    border: 1px solid var(--bp-border);
    border-radius: 14px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
}
</style>