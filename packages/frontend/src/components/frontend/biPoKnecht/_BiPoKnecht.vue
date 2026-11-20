<template>
    <div class="KnechtPage">
        <BiPoKnecht
            v-if="game"
            ref="knecht"
            :key="game.key"
            :match="game.match"
            :startTeamIndex="game.startTeamIndex"
            :actions="game.actions"
            :refereeUsed="game.refereeUsed"
            :initialPaused="!!game.paused"
            :live="isFeatureOn('live') || isFeatureOn('anstossen') || live.binding.value ? liveInfo : null"
            :saveHandler="live.binding.value ? saveShared : undefined"
            :savingText="savingText"
            @change="onChange"
            :fromLobby="!!game.lobby"
            @exit="abort"
            @lobby="backToLobby"
            @leave="leave"
            @saved="onSaved"
            @live="onLiveAction"
        />
        <!-- Weiteres Handy: wofuer traegt dieses Handy ein? -->
        <div v-else-if="seatChoice" class="KnechtJoining">
            <div class="kj-card">
                <div class="kj-title">Wer bist du?</div>
                <div class="kj-text">Dieses Handy trägt deine Würfe ein. Spieler ohne eigenes Handy trägt ein Handy ihres Teams mit ein.</div>
                <template v-for="teamIndex in [0, 1]" :key="teamIndex">
                    <div class="kj-team" :style="{ '--kj-color': getTeamColor(seatChoice.game.match, teamIndex) }">{{ getTeamName(seatChoice.game.match, teamIndex) }}</div>
                    <button v-for="seat in seatsOf(teamIndex)" :key="`${teamIndex}-${seat.player}`" type="button" class="kj-option"
                        :style="{ '--kj-color': getTeamColor(seatChoice.game.match, teamIndex) }" :disabled="!!seat.takenBy" @click="chooseSeat(teamIndex, seat.player)">
                        <span class="kj-dot"></span>
                        <span class="kj-option-text">
                            <b>{{ seat.label }}</b>
                            <small v-if="seat.takenBy">{{ seat.takenBy }}</small>
                            <small v-else-if="seat.player === null">Alle Spieler dieses Teams auf einem Handy</small>
                        </span>
                    </button>
                </template>
                <button type="button" class="kj-cancel" @click="cancelJoin">Abbrechen</button>
            </div>
        </div>
        <div v-else-if="joining" class="KnechtJoining"><i class="pi pi-spin pi-spinner"></i> Verbinde mit dem Spiel …</div>
    </div>
</template>

<script setup lang="ts">
// Nur Spielflaeche: gestartet wird ueber "Spiel eintragen" ("Spiel tracken": Teams waehlen, "Spiel starten") oder ueber die
// Anstoss-Lobby (/Mitspielen). Ein laufendes Spiel wird beim Oeffnen fortgesetzt. Ohne Spiel geht es zur Startseite.
// Mehrere Handys: jedes traegt fuer einen Spieler oder ein Tischende ein (liveDevices.ts), beitreten mit Code.
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import router from '@/router.js';
import BiPoKnecht from './BiPoKnecht.vue';
import type { KnechtAction } from './knechtEngine';
import { formatPoints, getResultPath, getTeamColor, getTeamName, normalizeTeams, saveKnechtGame, toRematch } from './KnechtUtilFunctions';
import { clearStoredGame, loadStoredGame, storeGame } from './knechtStorage';
import { useKnechtLaunch } from './useKnechtLaunch';
import { isDemoMode } from '@/util/demoGames';
import { isCurrentBinding, isLiveEnabled, LiveJoinError, peekLiveGame, setLiveEnabled, type LiveGame, type LiveProgress } from './knechtLive';
import { deviceName, useKnechtLiveSync } from './useKnechtLiveSync';
import type { LiveDeviceBinding } from './liveDevices';
import type { KnechtLiveInfo, KnechtLiveAction } from './KnechtLivePanel.vue';
import { isFeatureOn } from '@/util/featureFlags';
import { useProfile } from '../multiplayer/useProfile';
import { mpApi } from '../multiplayer/multiplayerApi';

type ActiveGame = {
    key: number;
    match: Match;
    startTeamIndex: number | null;
    actions: KnechtAction[];
    refereeUsed: boolean;
    lobby?: string | null;      // PIN der Anstoss-Lobby, aus der das Spiel gestartet wurde
    paused?: boolean;           // pausiert (bleibt beim Fortsetzen pausiert)
};

const toast = useToast();
const route = useRoute();
const { consumeLaunch, hasLaunch, onLaunch } = useKnechtLaunch();
const { profileName, deviceId } = useProfile();

const game = ref<ActiveGame | null>(null);
let gameKey = 0;

// ─── Spiel starten / fortsetzen ───
const persist = () => {
    if (!game.value) return;
    storeGame({
        match: game.value.match,
        startTeamIndex: game.value.startTeamIndex,
        actions: game.value.actions,
        refereeUsed: game.value.refereeUsed,
        savedAt: new Date().getTime(),
        live: live.binding.value,
        lobby: game.value.lobby ?? null,
        paused: !!game.value.paused,
    });
};

const endHere = (path = '/') => {
    clearStoredGame();
    game.value = null;
    router.push(path);
};

// ─── Live-Ticker / mehrere Handys ───
const knecht = ref<{ getProgress: () => LiveProgress; applyRemote: (progress: LiveProgress) => boolean } | null>(null);
const joining = ref(false);

// Revanche auf einem anderen Handy: neues Spiel mit denselben Handys. Nur nach einem gespielten Spiel: direkt nach dem
// Anwurf kann noch ein Serverstand ohne Anwurf ankommen (z.B. ein anderes Handy ist gerade beigetreten) - das ist
// keine Revanche (sonst blitzte kurz wieder der Startbildschirm auf).
const applyRemote = (progress: LiveProgress) => {
    const current = game.value;
    if (current && progress.match && progress.startTeamIndex === null && !progress.actions.length && current.startTeamIndex !== null && current.actions.length > 0) {
        game.value = { key: ++gameKey, match: progress.match, startTeamIndex: null, actions: [], refereeUsed: false };
        persist();
        toast.add({ severity: 'success', summary: 'Revanche! Das letzte Spiel ist eingetragen', life: 3500 });
        return true;
    }
    return knecht.value?.applyRemote(progress) ?? false;
};

const live = useKnechtLiveSync({
    getProgress: () => knecht.value?.getProgress() ?? null,
    applyRemote,
    onBindingChange: () => persist(),
    onNotice: (message) => toast.add({ severity: 'info', summary: message, life: 3500 }),
    onKicked: () => {
        toast.add({ severity: 'warn', summary: 'Dieses Handy wurde von einem anderen getrennt', detail: 'Das Spiel läuft dort weiter. Hier wird nichts gespeichert.' });
        endHere();
    },
    onEnded: (status, liveGame) => {
        const who = liveGame.endedBy ?? 'Ein anderes Handy';
        if (status === 'done') {
            toast.add({ severity: 'success', summary: `${who} hat das Spiel eingetragen`, life: 3500 });
            endHere(`/Live/${liveGame.id}`);
        } else {
            // Vor dem ersten Wurf zurueck in die Lobby: alle gehen mit
            const lobby = game.value?.lobby;
            if (lobby && !game.value?.actions.length) {
                toast.add({ severity: 'info', summary: `${who} ist zurück in die Lobby`, life: 3000 });
                endHere(`/Mitspielen/${lobby}`);
                return;
            }
            toast.add({ severity: 'info', summary: `${who} hat das Spiel abgebrochen`, life: 3500 });
            endHere();
        }
    },
});

const liveInfo = computed<KnechtLiveInfo>(() => ({
    status: live.status.value,
    code: live.binding.value?.code ?? null,
    id: live.binding.value?.id ?? null,
    devices: live.devices.value,
    deviceId: live.binding.value?.deviceId ?? null,
    team: live.binding.value?.team ?? null,
}));

const savingText = computed(() => {
    const saving = live.savingBy.value;
    if (!saving || saving === live.binding.value?.deviceId) return undefined;
    return `${deviceName(live.devices.value.find(device => device.id === saving))} trägt ein …`;
});

// Nur ein Start gleichzeitig: Beim Oeffnen starten sonst neues Spiel und "Live nachholen" je ein eigenes
// Live-Spiel, bevor das erste fertig angelegt ist (Startseite zeigte jedes Spiel doppelt, einmal mit 0 : 0)
let liveStarting: Promise<void> | null = null;
const startLive = () => liveStarting ??= (async () => {
    if (!game.value || live.binding.value) return;
    await nextTick();
    const progress = knecht.value?.getProgress() ?? { startTeamIndex: game.value.startTeamIndex, startedAt: null, actions: game.value.actions };
    const ok = await live.host(game.value.match, progress, { name: profileName.value });
    if (!ok) toast.add({ severity: 'warn', summary: 'Live-Ticker gerade nicht erreichbar – das Spiel läuft trotzdem', life: 3500 });
})().finally(() => { liveStarting = null; });

const onLiveAction = async (action: KnechtLiveAction) => {
    switch (action.type) {
        case 'start':
            setLiveEnabled(true);
            startLive();
            break;
        case 'stop':
            setLiveEnabled(false);
            live.finish('aborted');
            break;
        case 'leave':
            // Dieses Handy steigt aus: das Spiel laeuft auf den anderen weiter, hier wird nichts gespeichert
            live.leave();
            endHere();
            break;
        case 'kick': {
            const name = deviceName(live.devices.value.find(device => device.id === action.deviceId));
            if (!confirm(`${name} trennen? Seine Spieler trägt dann wieder ein anderes Handy mit ein.`)) return;
            toast.add(await live.kick(action.deviceId)
                ? { severity: 'success', summary: `${name} getrennt`, life: 3000 }
                : { severity: 'error', summary: 'Trennen gerade nicht möglich – keine Verbindung', life: 3500 });
            break;
        }
        case 'bind':
            try {
                await live.bind(action.binding);
            } catch (error) {
                const taken = error instanceof LiveJoinError && error.reason === 'taken';
                toast.add({ severity: 'error', summary: taken ? 'Das macht schon ein anderes Handy' : 'Umstellen gerade nicht möglich', life: 3500 });
            }
            break;
    }
};

// ─── Weiteres Handy: /Knecht?join=CODE -> Spiel ansehen, Spieler oder Tischende waehlen, beitreten ───
const seatChoice = ref<{ code: string; game: LiveGame } | null>(null);

const seatsOf = (teamIndex: number) => {
    const choice = seatChoice.value;
    if (!choice) return [];
    const team = teamIndex === 0 ? choice.game.match.team1 : choice.game.match.team2;
    const takenBy = (binding: LiveDeviceBinding) => {
        const device = choice.game.devices.find(entry => entry.team === binding.team && entry.player === binding.player);
        return device ? `Schon dabei: ${deviceName(device)}` : null;
    };
    const players = team.players.map((player, index) => ({ player: index as number | null, label: player.name, takenBy: takenBy({ team: teamIndex, player: index }) }));
    // Ein Spieler pro Team: Spieler und Tischende sind dasselbe
    if (team.players.length === 1) return players;
    return [...players, { player: null, label: 'Ganzes Tischende', takenBy: takenBy({ team: teamIndex, player: null }) }];
};

const showJoinError = (error: unknown, code: string) => {
    const reason = error instanceof LiveJoinError ? error.reason : 'not-found';
    toast.add(reason === 'taken'
        ? { severity: 'error', summary: 'Dafür trägt schon ein anderes Handy ein', detail: 'Bitte etwas anderes wählen.', life: 4000 }
        : reason === 'full'
            ? { severity: 'error', summary: 'In diesem Spiel sind schon zu viele Handys', life: 4000 }
            : { severity: 'error', summary: `Kein laufendes Spiel mit der PIN ${code.toUpperCase()}`, life: 4000 });
};

const joinGame = async (code: string) => {
    if ((game.value || loadStoredGame()) && !confirm('Das laufende Spiel auf diesem Handy wird verworfen. Dem anderen Spiel beitreten?')) return false;
    joining.value = true;
    try {
        seatChoice.value = { code, game: await peekLiveGame(code) };
        return true;
    } catch (error) {
        showJoinError(error, code);
        return false;
    } finally {
        joining.value = false;
    }
};

// Beitreten mit fester Wahl (Auswahl-Bildschirm oder aus der Lobby)
const enterGame = async (code: string, binding: LiveDeviceBinding, lobby: string | null = null) => {
    joining.value = true;
    try {
        if (live.binding.value) live.leave();
        const remote = await live.join(code, { name: profileName.value, ...binding });
        const match = remote.match;
        if (remote.startedAt) match.time = remote.startedAt;
        game.value = { key: ++gameKey, match, startTeamIndex: remote.startTeamIndex, actions: remote.actions, refereeUsed: false, lobby };
        persist();
        return true;
    } catch (error) {
        showJoinError(error, code);
        return false;
    } finally {
        joining.value = false;
    }
};

const chooseSeat = async (team: number, player: number | null) => {
    const choice = seatChoice.value;
    if (!choice) return;
    seatChoice.value = null;
    if (await enterGame(choice.code, { team, player })) {
        const label = player === null ? getTeamName(choice.game.match, team) : (team === 0 ? choice.game.match.team1 : choice.game.match.team2).players[player]?.name;
        toast.add({ severity: 'success', summary: `Verbunden – dieses Handy trägt für ${label} ein`, life: 3500 });
        leaveJoinUrl(true);
    } else {
        leaveJoinUrl(resume());
    }
};

// Nach dem Beitreten nur die Adresse aendern (/Knecht?join=... -> /Knecht), nicht die Route: die Seite haengt an der
// vollen Adresse und wuerde sonst komplett neu aufgebaut (Spielfeld blitzte kurz weg, Schnick-Schnack begann von vorn).
const leaveJoinUrl = (stay: boolean) => {
    if (!stay) return router.replace('/');
    window.history.replaceState({ ...window.history.state, as: '/Knecht', url: '/Knecht' }, '', '/Knecht');
};

const cancelJoin = () => {
    seatChoice.value = null;
    leaveJoinUrl(resume());
};

const newGame = (match: Match) => {
    if ((game.value || loadStoredGame()) && !confirm('Das laufende Spiel wird verworfen. Neues Spiel starten?')) return false;
    // Mit anderen Handys laeuft das alte Spiel dort weiter, allein wird es abgebrochen
    if (live.binding.value) live.devices.value.length > 1 ? live.leave() : live.finish('aborted');
    game.value = { key: ++gameKey, match: normalizeTeams(match), startTeamIndex: null, actions: [], refereeUsed: false };
    persist();
    if (isLiveEnabled()) startLive();
    return true;
};

const resume = () => {
    const stored = loadStoredGame();
    if (!stored) return false;
    const { match, startTeamIndex, actions, refereeUsed, lobby, paused } = stored;
    game.value = { key: ++gameKey, match, startTeamIndex, actions, refereeUsed, lobby, paused };
    // Bindung aus einer frueheren Version (erstes/zweites Handy) passt nicht mehr: ohne sie weiter, Live startet neu
    if (isCurrentBinding(stored.live)) live.resume(stored.live);
    return true;
};

const onChange = (progress: { startTeamIndex: number | null; actions: KnechtAction[]; refereeUsed: boolean; paused: boolean }) => {
    if (!game.value) return;
    Object.assign(game.value, progress);
    persist();
    live.schedulePush();
};

// ─── Spiel verlassen ───
// Abbrechen gilt fuer alle Handys
const abort = () => {
    live.finish('aborted');
    endHere();
};

// Vor dem Start zurueck in die Anstoss-Lobby: Lobby wieder oeffnen, dann das Live-Spiel beenden
// (in dieser Reihenfolge, sonst schickt die Lobby die anderen Handys gleich wieder ins alte Spiel)
// Lobby gibt es nicht mehr (z.B. abgelaufen oder Server neu gestartet): neue Lobby mit denselben Teams anlegen.
// Spieler ohne eigenes Handy (nicht unter den Handys im Spiel) kommen als "ohne Handy" mit.
const recreateLobby = async (match: Match): Promise<string | null> => {
    const name = profileName.value;
    if (!name) return null;
    try {
        const created = await mpApi.create(deviceId, name);
        const myTeam = live.binding.value?.team ?? 0;
        const phones = new Set(live.devices.value.map(device => device.name?.toLocaleLowerCase()).filter(Boolean));
        const now = Date.now();
        const guests = [0, 1].flatMap(team => (team === 0 ? match.team1 : match.team2).players
            .filter(player => player.name.toLocaleLowerCase() !== name.toLocaleLowerCase() && !phones.has(player.name.toLocaleLowerCase()))
            .map((player, index) => ({ deviceId: `np-${now.toString(36)}-${team}${index}`, name: player.name, team, joinedAt: now + 1 + team * 10 + index, phone: false })));
        const players = [{ ...created.players[0], team: myTeam, ready: false }, ...guests];
        const result = await mpApi.update(created.code, created.version, { players, ...(match.cupColors && { cupColors: match.cupColors }) });
        if (result.ok) mpApi.publish(result.session);
        return created.code;
    } catch {
        return null;
    }
};

const backToLobby = async () => {
    let code = game.value?.lobby;
    if (!code) return abort();
    const existing = await mpApi.get(code).catch(() => null);
    if (!existing || existing.status === 'aborted' || !existing.players.some(player => player.deviceId === deviceId)) {
        const match = game.value!.match;
        live.finish('aborted');
        code = await recreateLobby(match);
        if (!code) {
            toast.add({ severity: 'warn', summary: 'Die Lobby gibt es nicht mehr', life: 3500 });
            return endHere('/Mitspielen');
        }
        toast.add({ severity: 'info', summary: 'Die alte Lobby war weg – neue Lobby mit denselben Teams', life: 3500 });
        return endHere(`/Mitspielen/${code}`);
    }
    for (let attempt = 0; attempt < 3; attempt++) {
        const current = attempt === 0 ? existing : await mpApi.get(code).catch(() => null);
        if (!current || current.status !== 'started') break;
        // Zurueck in der Lobby muessen alle wieder "Bereit" druecken
        const result = await mpApi.update(code, current.version, { status: 'lobby', live: null, players: current.players.map(player => ({ ...player, ready: false })) }).catch(() => null);
        if (result?.ok) {
            mpApi.publish(result.session);
            break;
        }
    }
    live.finish('aborted');
    endHere(`/Mitspielen/${code}`);
};

const leave = () => {
    persist();
    router.push('/');
};

// Mehrere Handys: nur eines traegt ein. Erst beanspruchen, dann speichern (bei Fehler wieder freigeben).
const saveShared = async (result: Match): Promise<boolean> => {
    if (!await live.claim()) {
        toast.add({ severity: 'info', summary: savingText.value ?? 'Ein anderes Handy trägt das Spiel gerade ein', life: 3000 });
        return false;
    }
    let success = false;
    try {
        success = await saveKnechtGame(result);
    } catch {
        success = false;
    }
    if (!success) {
        await live.release();
        toast.add({ severity: 'error', summary: 'Spiel nicht gespeichert – bitte nochmal versuchen', life: 4000 });
    }
    return success;
};

const onSaved = async (result: Match, rematch: boolean) => {
    const score = [result.team1, result.team2].map(team => formatPoints(team.players.reduce((sum, player) => sum + player.score, 0)));
    const suffix = isDemoMode ? ' (Demo, nur lokal gespeichert)' : ' eingetragen';
    toast.add({ severity: 'success', summary: `${getTeamName(result, 0)} ${score[0]} : ${score[1]} ${getTeamName(result, 1)}${suffix}`, life: 3500 });
    if (rematch) {
        game.value = { key: ++gameKey, match: toRematch(result), startTeamIndex: null, actions: [], refereeUsed: false };
        persist();
        if (live.binding.value) {
            // Gleiche Handys, neues Spiel: Live-Spiel freigeben und zuruecksetzen (neuer Knecht muss erst stehen)
            await nextTick();
            await live.restart();
        } else if (isLiveEnabled()) {
            startLive();
        }
        return;
    }
    live.finish('done');
    endHere(getResultPath(result));
};

// ─── Uebergabe aus dem "Spiel eintragen"-Drawer ───
const takeLaunch = () => {
    const match = consumeLaunch();
    return !!match && newGame(match);
};
const stopListening = onLaunch(takeLaunch);
onUnmounted(stopListening);

onMounted(async () => {
    const code = typeof route.query.join === 'string' ? route.query.join : null;
    if (code) {
        // Aus der Lobby: der Platz steht schon fest
        const team = Number(route.query.team);
        if (route.query.team !== undefined && (team === 0 || team === 1)) {
            const player = route.query.player === undefined ? null : Number(route.query.player);
            const lobby = typeof route.query.lobby === 'string' ? route.query.lobby : null;
            const joined = await enterGame(code, { team, player: Number.isInteger(player) ? player : null }, lobby);
            leaveJoinUrl(joined || resume());
            return;
        }
        // Erfolgreich angesehen: weiter geht es mit der Auswahl (chooseSeat / cancelJoin). Die Adresse
        // bleibt bis dahin stehen - ein Wechsel auf /Knecht laedt die Seite neu und die Wahl waere weg.
        if (await joinGame(code)) return;
        leaveJoinUrl(resume());
        return;
    }
    // Neues Spiel abgelehnt: das laufende geht weiter
    const started = hasLaunch() ? takeLaunch() || resume() : resume();
    if (!started) router.replace('/');
    // Fortgesetztes Spiel ohne Live (z.B. vor dem Update gestartet): Live nachholen
    else if (!live.binding.value && isLiveEnabled()) startLive();
});
</script>

<style scoped>
.KnechtJoining{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 80px 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--bp-text-muted);
}
.kj-card{
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(420px, 100%);
    padding: 20px 16px 12px;
    border-radius: 20px;
    background: var(--bp-surface);
    box-shadow: 0 12px 40px rgba(0, 0, 0, .14);
    text-align: left;
}
.kj-title{
    font-size: 22px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.kj-text{
    margin-top: -4px;
    font-size: 13px;
    font-weight: 500;
    color: var(--bp-text-muted);
}
.kj-option{
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 14px;
    border: 2px solid var(--kj-color);
    border-radius: 16px;
    background: color-mix(in srgb, var(--kj-color) 8%, var(--bp-surface));
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 16px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
}
.kj-option:disabled{
    opacity: .5;
    cursor: default;
}
.kj-option-text{
    display: flex;
    flex-direction: column;
    gap: 1px;
}
.kj-option-text small{
    font-size: 12px;
    font-weight: 500;
    color: var(--bp-text-muted);
}
.kj-team{
    margin-top: 6px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--kj-color);
}
.kj-dot{
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--kj-color) 22%, var(--bp-surface));
    box-shadow: inset 0 0 0 4px var(--kj-color);
}
.kj-cancel{
    height: 44px;
    border: none;
    background: none;
    color: var(--bp-text-muted);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}
.KnechtPage{
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(560px, 100%);
    margin: 0 auto;
    padding: 0 16px 32px;
}
</style>
