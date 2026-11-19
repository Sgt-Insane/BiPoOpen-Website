<template>
    <div class="MultiplayerPage">
        <PageHeader title="Anstoßen" subtitle="Jeder spielt mit seinem eigenen Handy">
            <template #title-extra><DevBadge feature="anstossen" /></template>
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

        <!-- Auch waehrend des Wechsels ins Spiel: sonst blitzt kurz die Anstoss-Seite auf (Lobby schon geschlossen) -->
        <div v-if="loading || starting || enteringGame" class="mp-loading">
            <i class="pi pi-spin pi-spinner"></i> {{ starting || enteringGame ? 'Spiel wird gestartet …' : 'Lade …' }}
        </div>

        <ProfilePicker v-else-if="!profileName" @saved="onProfileSaved" />

        <MpLobby
            v-else-if="session"
            :session="session"
            :deviceId="deviceId"
            :options="gameOptions"
            :loadingOptions="loadingOptions"
            :busy="busy"
            @swap="swapSides"
            @chooseKind="chooseKind"
            @leave="leaveLobby"
            @share="share"
            @addGuest="addGuest"
            @removeGuest="removeGuest"
            @ready="toggleReady"
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
import DevBadge from '@/components/shared/DevBadge.vue';
// Anstoss-Lobby: Handys aneinanderstossen (oder Code), Teams waehlen, Spieler ohne Handy dazunehmen, Spielart waehlen
// (offen, Liga, Cup). Sind alle bereit, legt ein Handy das Live-Spiel an (wie "+ Spiel" → "Spiel tracken"); jedes
// Handy der Lobby tritt dort als sein Spieler bei. Wer spaeter kommt, tritt mit dem Code bei (Lobby- oder Knecht-Code).
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
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
import { pendingBumpPermission, useBump } from './useBump';
import { useMultiplayerSession } from './useMultiplayerSession';
import { buildOpenMatch, getGameOptions, type MpGameKind, type MpGameOption } from './multiplayerGameOptions';
import { mpApi } from './multiplayerApi';
import { MAX_PLAYERS_PER_TEAM, MpError, allReady, getTeamPlayers, unready, type MpSession } from './multiplayerTypes';

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
const enteringGame = ref(false);
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
    enteringGame.value = true;
    const me = current.players.find(player => player.deviceId === deviceId);
    clear();
    if (!me) {
        router.push({ path: '/Knecht', query: { join: current.live.code } });
        return true;
    }
    const player = getTeamPlayers(current.players, me.team).findIndex(entry => entry.deviceId === deviceId);
    router.push({ path: '/Knecht', query: { join: current.live.code, team: String(me.team), player: String(Math.max(0, player)), lobby: current.code } });
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

// "+ Spiel" → "Anstoßen": immer eine neue Suche. Eine noch offene alte Lobby wird verlassen
// (sie wird dort extra mit "Fortsetzen" angeboten), ein laufendes Spiel bleibt im Knecht.
const startFresh = route.query.anstossen === '1';
const enterFromRoute = async () => {
    const code = String(route.params.Code ?? '').replace(/\D/g, '');
    if (!profileName.value) return;
    if (startFresh && !code) {
        window.history.replaceState({ ...window.history.state, as: '/Mitspielen', url: '/Mitspielen' }, '', '/Mitspielen');
        const old = storedCode.value;
        if (old) {
            const existing = await mpApi.get(old).catch(() => null);
            clear();
            if (existing?.status === 'lobby') {
                const left = await mpApi.leave(old, deviceId).catch(() => null);
                if (left) mpApi.publish(left);
            }
        }
        return;
    }
    if (code) {
        if (await resume(code)) return;
        await run(() => enterCode(code), 'Beitreten hat nicht geklappt');
    } else if (storedCode.value) {
        await resume();
    }
};

// Profil gespeichert (Antippen): Sensor gleich mit freischalten, sonst muesste man erst raus und wieder rein
const onProfileSaved = () => {
    bumpSensor.start();
    enterFromRoute();
};

// ─── Lobby ───
// Pfeil in der Mitte: zwei Spieler tauschen die Seiten, sonst wechselt nur man selbst (wenn drueben Platz ist)
const swapSides = () => commit(current => {
    if (current.status !== 'lobby') return null;
    if (current.players.length === 2 && current.players[0].team !== current.players[1].team)
        return { players: unready(current.players.map(entry => ({ ...entry, team: 1 - entry.team }))) };
    const player = current.players.find(entry => entry.deviceId === deviceId);
    if (!player || getTeamPlayers(current.players, 1 - player.team).length >= MAX_PLAYERS_PER_TEAM) return null;
    return { players: unready(current.players.map(entry => entry.deviceId === deviceId ? { ...entry, team: 1 - entry.team, joinedAt: Date.now() } : entry)) };
});

const addGuest = (team: number, name: string) => commit(current => {
    if (current.status !== 'lobby' || getTeamPlayers(current.players, team).length >= MAX_PLAYERS_PER_TEAM) return null;
    if (current.players.some(player => player.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return null;
    const guest = { deviceId: `np-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name, team, joinedAt: Date.now(), phone: false };
    return { players: unready([...current.players, guest]) };
});

const removeGuest = (playerId: string) => commit(current => current.status === 'lobby' && current.players.some(player => player.deviceId === playerId && player.phone === false)
    ? { players: unready(current.players.filter(player => player.deviceId !== playerId)) }
    : null);

// Bereit / doch nicht bereit. Laeuft auf diesem Handy noch ein Knecht-Spiel, wird schon hier gefragt
// (sind alle bereit, startet das Spiel von selbst).
const toggleReady = () => {
    const me = session.value?.players.find(player => player.deviceId === deviceId);
    if (me && !me.ready && loadStoredGame() && !confirm('Auf diesem Handy läuft noch ein Knecht-Spiel. Es wird beim Start verworfen. Bereit?')) return;
    return commit(current => current.status === 'lobby' && current.players.some(player => player.deviceId === deviceId)
        ? { players: current.players.map(player => player.deviceId === deviceId ? { ...player, ready: !player.ready } : player) }
        : null);
};

// ─── Spielart: offen (Standard), Liga oder Cup ───
// Was moeglich ist, haengt von den Spielern ab (1 gegen 1, beide in Liga-Teams mit offenem Spiel / offener Paarung)
const teamsKey = computed(() => {
    const players = session.value?.players ?? [];
    return [0, 1].map(team => getTeamPlayers(players, team).map(player => player.name.toLocaleLowerCase()).join('|')).join('/');
});
const gameOptions = ref<MpGameOption[]>([]);
const loadingOptions = ref(false);
let optionsRun = 0;
const loadOptions = async () => {
    const players = session.value?.players ?? [];
    const run = ++optionsRun;
    // Sofort: offenes Spiel. Liga/Cup kommen dazu, sobald die Daten da sind.
    gameOptions.value = [{ kind: 'open', label: 'Offenes Spiel', detail: 'Zählt für die Weltrangliste', match: buildOpenMatch(players) }];
    loadingOptions.value = true;
    try {
        const options = await getGameOptions(players);
        if (run === optionsRun) gameOptions.value = options;
    } catch {
        /* nur offen */
    } finally {
        if (run === optionsRun) loadingOptions.value = false;
    }
};
watch(teamsKey, () => { if (session.value) loadOptions(); }, { immediate: true });

const chooseKind = (kind: MpGameKind) => commit(current => current.status === 'lobby' && (current.gameKind ?? 'open') !== kind
    ? { gameKind: kind, players: unready(current.players) }
    : null);

// Gewaehlte Spielart passt nicht mehr (andere Spieler): zurueck auf offen
watch([gameOptions, loadingOptions, () => session.value?.gameKind], () => {
    const kind = session.value?.gameKind ?? 'open';
    if (kind === 'open' || loadingOptions.value || session.value?.status !== 'lobby') return;
    if (!gameOptions.value.some(option => option.kind === kind)) chooseKind('open');
});

// ─── Start von selbst, sobald alle bereit sind ───
// Das Host-Handy legt sofort an, die anderen nur, wenn es nach kurzer Zeit noch nicht passiert ist (z.B. Host offline).
// Die Lobby wird dabei beansprucht (commit): nie legt mehr als ein Handy ein Spiel an.
const AUTO_START_BACKUP_MS = 3000;
let autoStartTimer: ReturnType<typeof setTimeout> | null = null;
const canAutoStart = (current: MpSession | null) => !!current && current.status === 'lobby' && allReady(current.players)
    && [0, 1].every(team => getTeamPlayers(current.players, team).length > 0)
    && current.players.some(player => player.deviceId === deviceId);
watch([session, loadingOptions], () => {
    if (!canAutoStart(session.value) || loadingOptions.value) {
        if (autoStartTimer) clearTimeout(autoStartTimer);
        autoStartTimer = null;
        return;
    }
    if (autoStartTimer || starting.value) return;
    autoStartTimer = setTimeout(() => {
        autoStartTimer = null;
        if (canAutoStart(session.value) && !loadingOptions.value) startGame();
    }, session.value!.hostId === deviceId ? 300 : AUTO_START_BACKUP_MS);
});

// Start: Lobby fuer sich beanspruchen (nur ein Handy legt das Spiel an), Live-Spiel anlegen, Code in die Lobby
const startGame = async () => {
    const current = session.value;
    if (!current || starting.value) return;
    const option = gameOptions.value.find(entry => entry.kind === (current.gameKind ?? 'open'));
    if (!option) return;
    starting.value = true;
    try {
        const claimed = await commit(latest => canAutoStart(latest) && (latest.gameKind ?? 'open') === option.kind ? { status: 'started', live: null } : null);
        // Ein anderes Handy war schneller (oder jemand ist doch nicht bereit): nichts zu tun
        if (claimed !== 'applied') return;
        const base = option.kind === 'open' ? buildOpenMatch(current.players) : option.match;
        const match = normalizeTeams({ ...base, ...(current.cupColors && { cupColors: current.cupColors }) });
        // Liga/Cup: ein Team = ein Spieler
        const player = option.kind === 'open' ? Math.max(0, myPlayerIndex.value) : 0;
        try {
            const progress = { startTeamIndex: null, startedAt: null, actions: [] };
            const { game, binding } = await createLiveGame(match, progress, { name: profileName.value, team: myTeam.value, player });
            clearStoredGame();
            storeGame({ match: game.match, startTeamIndex: null, actions: [], refereeUsed: false, savedAt: Date.now(), live: binding, lobby: current.code });
            await commit(() => ({ live: { id: game.id, code: binding.code } }));
        } catch {
            // Zurueck in die Lobby, alle muessen nochmal bestaetigen (sonst versucht es sofort wieder)
            await commit(latest => latest.status === 'started' && !latest.live ? { status: 'lobby', players: unready(latest.players) } : null);
            toast.add({ severity: 'error', summary: 'Start hat nicht geklappt – bitte nochmal', life: 3500 });
            return;
        }
        enteringGame.value = true;
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
    if (!isFeatureOn('anstossen')) {
        router.replace('/');
        return;
    }
    // Android braucht keine Erlaubnis: sofort lauschen. iPhone: erst nach "Anstossen aktivieren" - oder sofort, wenn
    // "+ Spiel" → "Anstoßen" die Erlaubnis schon geholt hat (die Anfrage laeuft evtl. noch).
    if (!bumpSensor.needsPermission) bumpSensor.start();
    else pendingBumpPermission()?.then(granted => { if (granted) bumpSensor.start(); });
    try {
        await enterFromRoute();
        if (session.value?.status === 'started' && session.value.live) goToGame(session.value);
    } finally {
        loading.value = false;
    }
});

onUnmounted(() => {
    stopEnded();
    if (autoStartTimer) clearTimeout(autoStartTimer);
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