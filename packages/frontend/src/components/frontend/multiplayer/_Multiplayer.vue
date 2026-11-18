<template>
    <div class="MultiplayerPage">
        <PageHeader title="Anstoßen" subtitle="Jeder spielt mit seinem eigenen Handy">
            <template v-if="session" #actions>
                <span class="mp-status" :class="{ 'mp-status--offline': offline }">
                    <span class="mp-status-dot"></span>{{ offline ? 'Offline' : 'Verbunden' }}
                </span>
            </template>
        </PageHeader>

        <!-- Verbunden: kurz "Prost!", dann die Lobby -->
        <transition name="mp-cheers">
            <div v-if="cheers" class="mp-cheers" aria-live="polite">
                <div class="mp-cheers-cups" aria-hidden="true">
                    <span class="mp-cheers-cup mp-cheers-cup--left"><BeerCup :color="TEAM_COLORS[0]" slosh /></span>
                    <span class="mp-cheers-cup mp-cheers-cup--right"><BeerCup :color="TEAM_COLORS[1]" slosh /></span>
                </div>
                <div class="mp-cheers-title">Prost!</div>
                <div class="mp-cheers-text">Ihr seid in einer Lobby</div>
            </div>
        </transition>

        <div v-if="loading || starting" class="mp-loading">
            <i class="pi pi-spin pi-spinner"></i> {{ starting ? 'Spiel wird gestartet …' : 'Lade …' }}
        </div>

        <ProfilePicker v-else-if="!profileName" @saved="onProfileSaved" />

        <MpLobby
            v-else-if="session"
            :session="session"
            :deviceId="deviceId"
            :options="gameOptions"
            :busy="loadingOptions"
            @swap="swapSides"
            @prepare="prepareStart"
            @start="startGame"
            @cancelOptions="gameOptions = null"
            @leave="leaveLobby"
            @share="share"
            @addGuest="addGuest"
            @removeGuest="removeGuest"
        />

        <MpConnect
            v-else
            :bumpState="bumpState"
            :isSupported="bumpSensor.isSupported"
            :isListening="bumpSensor.isListening.value"
            :denied="bumpSensor.denied.value"
            :hasSensor="bumpSensor.hasSensor.value"
            :detectedAt="bumpSensor.detectedAt.value"
            :sway="bumpSensor.sway.value"
            :direction="bumpSensor.direction.value"
            :busy="busy"
            :isLocal="api.kind === 'local'"
            @enable="bumpSensor.start()"
            @bump="bump()"
            @create="createLobby"
            @join="joinLobby"
        />
    </div>
</template>

<script setup lang="ts">
// Anstoss-Lobby: Handys aneinanderstossen (oder Code), Teams und Farben waehlen, Spieler ohne Handy dazunehmen.
// "Spiel starten" legt ein Live-Spiel an (wie "+ Spiel" → "Spiel tracken"); jedes Handy der Lobby tritt
// dort als sein Spieler bei. Wer spaeter kommt, tritt mit dem Code bei (Lobby-Code oder Code im Knecht).
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useGrayPage } from '@/components/shared/useGrayPage';
import PageHeader from '@/components/shared/PageHeader.vue';
import { TEAM_COLORS, normalizeTeams } from '../biPoKnecht/KnechtUtilFunctions';
import { createLiveGame } from '../biPoKnecht/knechtLive';
import { clearStoredGame, loadStoredGame, storeGame } from '../biPoKnecht/knechtStorage';
import { isFeatureOn } from '@/util/featureFlags';
import ProfilePicker from './ProfilePicker.vue';
import MpConnect from './MpConnect.vue';
import MpLobby from './MpLobby.vue';
import BeerCup from './BeerCup.vue';
import { useProfile } from './useProfile';
import { useBump } from './useBump';
import { useMultiplayerSession } from './useMultiplayerSession';
import { getGameOptions, type MpGameOption } from './multiplayerGameOptions';
import { mpApi } from './multiplayerApi';
import { MAX_PLAYERS_PER_TEAM, MpError, getTeamPlayers, type MpSession } from './multiplayerTypes';

useGrayPage();

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { profileName } = useProfile();
const {
    api, session, storedCode, offline, bumpState, deviceId, myTeam, myPlayerIndex,
    create, join, resume, leave, suspend, clear, commit, bump, onEnded,
} = useMultiplayerSession();

const loading = ref(true);
const busy = ref(false);
const starting = ref(false);

const showError = (error: unknown, fallback: string) => {
    toast.add({ severity: 'error', summary: error instanceof MpError ? error.message : fallback, life: 4000 });
};

// ─── Anstossen ───
// Aktiv, solange man noch keine Lobby hat oder in der Lobby weitere Spieler holen kann
const bumpSensor = useBump(() => {
    if (profileName.value && (!session.value || session.value.status === 'lobby')) bump();
});

// URL zeigt den Code, damit Neuladen und Teilen funktionieren
watch(() => session.value?.code, (code) => {
    const path = code ? `/Mitspielen/${code}` : '/Mitspielen';
    if (route.path !== path) window.history.replaceState({ ...window.history.state, as: path, url: path }, '', path);
});

// Anstossen hat geklappt: kurz "Prost!" ueber der Lobby
const cheers = ref(false);
let cheersTimer: ReturnType<typeof setTimeout> | null = null;
watch(bumpState, (state) => {
    if (state !== 'found') return;
    cheers.value = true;
    if (cheersTimer) clearTimeout(cheersTimer);
    cheersTimer = setTimeout(() => { cheers.value = false; }, 1700);
});

const run = async (action: () => Promise<unknown>, fallback: string) => {
    if (busy.value) return;
    busy.value = true;
    try {
        await action();
    } catch (error) {
        showError(error, fallback);
    } finally {
        busy.value = false;
    }
};

// ─── Spiel laeuft schon: ins Live-Spiel ───
// Mitglied der Lobby: mit dem eigenen Platz. Sonst: Auswahl, fuer wen dieses Handy eintraegt.
const goToGame = (current: MpSession) => {
    if (!current.live) return false;
    const me = current.players.find(player => player.deviceId === deviceId);
    clear();
    if (!me) {
        router.push({ path: '/Knecht', query: { join: current.live.code } });
        return true;
    }
    const player = getTeamPlayers(current.players, me.team).findIndex(entry => entry.deviceId === deviceId);
    router.push({ path: '/Knecht', query: { join: current.live.code, team: String(me.team), player: String(Math.max(0, player)) } });
    return true;
};

// Code eingeben: Lobby beitreten oder, wenn das Spiel schon laeuft, direkt ins Spiel
const enterCode = async (code: string) => {
    const existing = await mpApi.get(code).catch(() => null);
    if (existing?.status === 'started' && existing.live) {
        goToGame(existing);
        return;
    }
    await join(code);
};

const createLobby = () => run(create, 'Lobby konnte nicht erstellt werden');
const joinLobby = (code: string) => run(() => enterCode(code.replace(/\D/g, '')), 'Beitreten hat nicht geklappt');

const leaveLobby = async () => {
    await leave();
    router.push('/Profil');
};

const share = async () => {
    if (!session.value) return;
    const url = `${window.location.origin}/Mitspielen/${session.value.code}`;
    const text = `Spiel mit uns BiPo! Lobby-PIN ${session.value.code}`;
    try {
        if (navigator.share) await navigator.share({ title: 'BiPo Knecht', text, url });
        else {
            await navigator.clipboard.writeText(url);
            toast.add({ severity: 'success', summary: 'Link kopiert', life: 2000 });
        }
    } catch { /* abgebrochen */ }
};

const enterFromRoute = async () => {
    const code = String(route.params.Code ?? '').replace(/\D/g, '');
    if (!profileName.value) return;
    if (code) {
        if (await resume(code)) return;
        await run(() => enterCode(code), 'Beitreten hat nicht geklappt');
    } else if (storedCode.value) {
        await resume();
    }
};

const onProfileSaved = () => { enterFromRoute(); };

// ─── Lobby ───
// Pfeil in der Mitte: zwei Spieler tauschen die Seiten, sonst wechselt nur man selbst (wenn drueben Platz ist)
const swapSides = () => commit(current => {
    if (current.status !== 'lobby') return null;
    if (current.players.length === 2 && current.players[0].team !== current.players[1].team)
        return { players: current.players.map(entry => ({ ...entry, team: 1 - entry.team })) };
    const player = current.players.find(entry => entry.deviceId === deviceId);
    if (!player || getTeamPlayers(current.players, 1 - player.team).length >= MAX_PLAYERS_PER_TEAM) return null;
    return { players: current.players.map(entry => entry.deviceId === deviceId ? { ...entry, team: 1 - entry.team, joinedAt: Date.now() } : entry) };
});

const addGuest = (team: number, name: string) => commit(current => {
    if (current.status !== 'lobby' || getTeamPlayers(current.players, team).length >= MAX_PLAYERS_PER_TEAM) return null;
    if (current.players.some(player => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return null;
    const guest = { deviceId: `np-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name, team, joinedAt: Date.now(), phone: false };
    return { players: [...current.players, guest] };
});

const removeGuest = (playerId: string) => commit(current => current.status === 'lobby' && current.players.some(player => player.deviceId === playerId && player.phone === false)
    ? { players: current.players.filter(player => player.deviceId !== playerId) }
    : null);

const gameOptions = ref<MpGameOption[] | null>(null);
const loadingOptions = ref(false);

// Offen, Liga oder Cup? Gibt es nur das offene Spiel, geht es direkt los.
const prepareStart = async () => {
    if (!session.value) return;
    loadingOptions.value = true;
    try {
        const options = await getGameOptions(session.value.players);
        if (options.length === 1) await startGame(options[0]);
        else gameOptions.value = options;
    } finally {
        loadingOptions.value = false;
    }
};

// Start: Lobby fuer sich beanspruchen (nur ein Handy legt das Spiel an), Live-Spiel anlegen, Code in die Lobby
const startGame = async (option: MpGameOption) => {
    gameOptions.value = null;
    const current = session.value;
    if (!current || starting.value) return;
    if (loadStoredGame() && !confirm('Auf diesem Handy läuft noch ein Knecht-Spiel. Es wird verworfen. Neues Spiel starten?')) return;
    starting.value = true;
    try {
        const claimed = await commit(latest => latest.status === 'lobby' ? { status: 'started', live: null } : null);
        if (claimed !== 'applied') {
            toast.add({ severity: 'info', summary: 'Ein anderes Handy startet gerade', life: 3000 });
            return;
        }
        const match = normalizeTeams({ ...option.match, ...(current.cupColors && { cupColors: current.cupColors }) });
        // Liga/Cup: ein Team = ein Spieler
        const player = option.kind === 'open' ? Math.max(0, myPlayerIndex.value) : 0;
        try {
            const progress = { startTeamIndex: null, startedAt: null, actions: [] };
            const { game, binding } = await createLiveGame(match, progress, { name: profileName.value, team: myTeam.value, player });
            clearStoredGame();
            storeGame({ match: game.match, startTeamIndex: null, actions: [], refereeUsed: false, savedAt: Date.now(), live: binding });
            await commit(() => ({ live: { id: game.id, code: binding.code } }));
        } catch {
            await commit(latest => latest.status === 'started' && !latest.live ? { status: 'lobby' } : null);
            toast.add({ severity: 'error', summary: 'Start hat nicht geklappt – bitte nochmal', life: 3500 });
            return;
        }
        clear();
        router.push('/Knecht');
    } finally {
        starting.value = false;
    }
};

// Ein anderes Handy hat gestartet: als eigener Spieler beitreten
watch(session, (current) => {
    if (current?.status === 'started' && current.live && !starting.value) goToGame(current);
});

const stopEnded = onEnded((_, reason) => {
    toast.add({ severity: 'info', summary: reason, life: 3000 });
});

onMounted(async () => {
    if (!isFeatureOn('mitspielen')) {
        router.replace('/');
        return;
    }
    // Android braucht keine Erlaubnis: sofort lauschen. iPhone: erst nach "Anstossen aktivieren".
    if (!bumpSensor.needsPermission) bumpSensor.start();
    try {
        await enterFromRoute();
        if (session.value?.status === 'started' && session.value.live) goToGame(session.value);
    } finally {
        loading.value = false;
    }
});

onUnmounted(() => {
    stopEnded();
    // Lobby laeuft weiter, die Seite fragt nur nicht mehr nach
    if (session.value) suspend();
});
</script>

<style scoped>
.MultiplayerPage{
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 560px;
    margin: 0 auto;
    padding-top: 8px;
    color: var(--bp-text-strong);
}
.mp-status{
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--bp-success-weak);
    color: var(--bp-success-strong);
    font-size: 12px;
    font-weight: 700;
}
.mp-status--offline{
    background: var(--bp-danger-weak);
    color: var(--bp-danger-strong);
}
.mp-status-dot{
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
}
.mp-cheers{
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
}
.mp-cheers-cups{
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
}
.mp-cheers-cup{
    display: block;
    width: 96px;
    height: 116px;
}
.mp-cheers-cup :deep(svg){ width: 100%; height: 100%; }
.mp-cheers-cup--left{ animation: mp-cheers-left .5s ease-out both; }
.mp-cheers-cup--right{ animation: mp-cheers-right .5s ease-out both; }
@keyframes mp-cheers-left{ from{ transform: scaleX(-1) translateX(40px); opacity: 0; } to{ transform: scaleX(-1); opacity: 1; } }
@keyframes mp-cheers-right{ from{ transform: translateX(40px); opacity: 0; } to{ transform: none; opacity: 1; } }
.mp-cheers-cup--left{ transform: scaleX(-1); }
.mp-cheers-title{
    font-size: 40px;
    font-weight: 900;
}
.mp-cheers-text{
    font-size: 15px;
    font-weight: 600;
    opacity: .9;
}
.mp-cheers-enter-active, .mp-cheers-leave-active{ transition: opacity .25s ease; }
.mp-cheers-enter-from, .mp-cheers-leave-to{ opacity: 0; }
@media (prefers-reduced-motion: reduce){ .mp-cheers-cup{ animation: none; } }
.mp-loading{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 60px 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--bp-text-muted);
}
</style>