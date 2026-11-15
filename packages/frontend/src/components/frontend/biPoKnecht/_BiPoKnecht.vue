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
            :live="isFeatureOn('live') || live.binding.value ? liveInfo : null"
            :phoneSide="live.binding.value?.side ?? null"
            @change="onChange"
            @exit="abort"
            @leave="leave"
            @saved="onSaved"
            @live="onLiveAction"
        />
        <!-- Zweites Handy: an welchem Tischende steht dieses Handy? -->
        <div v-else-if="sideChoice" class="KnechtJoining">
            <div class="kj-card">
                <div class="kj-title">Wo liegt dieses Handy?</div>
                <div class="kj-text">Jedes Handy liegt an einem Tischende und zeigt die Becher, auf die dieses Team wirft.</div>
                <button v-for="teamIndex in [0, 1]" :key="teamIndex" type="button" class="kj-option"
                    :style="{ '--kj-color': getTeamColor(sideChoice.game.match, teamIndex) }" @click="chooseSide(teamIndex)">
                    <span class="kj-dot"></span>
                    <span>Bei <b>{{ getTeamName(sideChoice.game.match, teamIndex) }}</b></span>
                </button>
                <button type="button" class="kj-cancel" @click="cancelJoin">Abbrechen</button>
            </div>
        </div>
        <div v-else-if="joining" class="KnechtJoining"><i class="pi pi-spin pi-spinner"></i> Verbinde mit dem Spiel …</div>
    </div>
</template>

<script setup lang="ts">
// Nur Spielflaeche: gestartet wird ueber "Spiel eintragen" (Teams waehlen, "Mit BiPo Knecht spielen"),
// ein laufendes Spiel wird beim Oeffnen fortgesetzt. Ohne Spiel geht es zur Startseite.
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import router from '@/router.js';
import BiPoKnecht from './BiPoKnecht.vue';
import type { KnechtAction } from './knechtEngine';
import { formatPoints, getResultPath, getTeamColor, getTeamName, normalizeTeams } from './KnechtUtilFunctions';
import { clearStoredGame, loadStoredGame, storeGame } from './knechtStorage';
import { useKnechtLaunch } from './useKnechtLaunch';
import { isDemoMode } from '@/util/demoGames';
import { isLiveEnabled, LiveJoinError, peekLiveGame, setLiveEnabled, type LiveBinding, type LiveGame, type LiveProgress } from './knechtLive';
import { useKnechtLiveSync } from './useKnechtLiveSync';
import type { KnechtLiveInfo } from './KnechtLivePanel.vue';
import { isFeatureOn } from '@/util/featureFlags';

type ActiveGame = {
    key: number;
    match: Match;
    startTeamIndex: number | null;
    actions: KnechtAction[];
    refereeUsed: boolean;
    guest?: boolean;            // dieses Handy ist per Code beigetreten (andere Tischseite)
};

const toast = useToast();
const route = useRoute();
const { consumeLaunch, hasLaunch, onLaunch } = useKnechtLaunch();

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
    });
};

// ─── Live-Ticker / zweites Handy ───
const knecht = ref<{ getProgress: () => LiveProgress; applyRemote: (progress: LiveProgress) => boolean } | null>(null);
const joining = ref(false);

const live = useKnechtLiveSync({
    getProgress: () => knecht.value?.getProgress() ?? null,
    applyRemote: (progress) => knecht.value?.applyRemote(progress) ?? false,
    onBindingChange: () => persist(),
    onNotice: (message) => toast.add({ severity: 'info', summary: message, life: 3500 }),
    onKicked: () => {
        clearStoredGame();
        game.value = null;
        toast.add({ severity: 'warn', summary: 'Vom anderen Handy getrennt', detail: 'Das Spiel wird dort allein weitergezählt. Hier wird nichts gespeichert.', life: 6000 });
        router.push('/');
    },
    onEnded: (status, liveGame) => {
        clearStoredGame();
        game.value = null;
        if (status === 'done') {
            toast.add({ severity: 'success', summary: 'Das andere Handy hat das Spiel eingetragen', life: 3500 });
            router.push(`/Live/${liveGame.id}`);
        } else {
            toast.add({ severity: 'info', summary: 'Das Spiel wurde auf dem anderen Handy abgebrochen', life: 3500 });
            router.push('/');
        }
    },
});

const liveInfo = computed<KnechtLiveInfo>(() => ({
    status: live.status.value,
    code: live.binding.value?.code ?? null,
    id: live.binding.value?.id ?? null,
    role: live.binding.value?.role ?? null,
    devices: live.devices.value,
}));

// Nur ein Start gleichzeitig: Beim Oeffnen starten sonst neues Spiel und "Live nachholen" je ein eigenes
// Live-Spiel, bevor das erste fertig angelegt ist (Startseite zeigte jedes Spiel doppelt, einmal mit 0 : 0)
let liveStarting: Promise<void> | null = null;
const startLive = () => liveStarting ??= (async () => {
    if (!game.value || live.binding.value) return;
    await nextTick();
    const progress = knecht.value?.getProgress() ?? { startTeamIndex: game.value.startTeamIndex, startedAt: null, actions: game.value.actions };
    const ok = await live.host(game.value.match, progress);
    if (!ok) toast.add({ severity: 'warn', summary: 'Live-Ticker gerade nicht erreichbar – das Spiel läuft trotzdem', life: 3500 });
})().finally(() => { liveStarting = null; });

const onLiveAction = async (action: 'start' | 'stop' | 'leave' | 'kick') => {
    if (action === 'kick') {
        if (!confirm('Zweites Handy trennen? Es wird dort beendet, du zählst hier allein weiter. Der Code ändert sich.')) return;
        const ok = await live.kick();
        toast.add(ok
            ? { severity: 'success', summary: 'Zweites Handy getrennt', detail: `Neuer Code: ${live.binding.value?.code ?? ''}`, life: 4000 }
            : { severity: 'error', summary: 'Trennen gerade nicht möglich – keine Verbindung', life: 3500 });
    } else if (action === 'start') {
        setLiveEnabled(true);
        startLive();
    } else if (action === 'stop') {
        setLiveEnabled(false);
        live.finish('aborted');
    } else {
        // Zweites Handy steigt aus: das Spiel laeuft auf dem anderen weiter, hier wird nichts gespeichert
        live.leave();
        clearStoredGame();
        game.value = null;
        router.push('/');
    }
};

// Zweites Handy: /Knecht?join=CODE -> Spiel ansehen, Tischseite waehlen, beitreten
const sideChoice = ref<{ code: string; game: LiveGame } | null>(null);

const showJoinError = (error: unknown, code: string) => {
    const busy = error instanceof LiveJoinError && error.reason === 'busy';
    toast.add(busy
        ? { severity: 'error', summary: 'Dieses Spiel zählen schon zwei Handys', detail: 'Ein drittes Handy geht nicht. Das erste Handy kann das andere unter „Live & zweites Handy“ trennen.', life: 6000 }
        : { severity: 'error', summary: `Kein laufendes Spiel mit dem Code ${code.toUpperCase()}`, life: 4000 });
};

const joinGame = async (code: string) => {
    if ((game.value || loadStoredGame()) && !confirm('Das laufende Spiel auf diesem Handy wird verworfen. Dem anderen Spiel beitreten?')) return false;
    joining.value = true;
    try {
        sideChoice.value = { code, game: await peekLiveGame(code) };
        return true;
    } catch (error) {
        showJoinError(error, code);
        return false;
    } finally {
        joining.value = false;
    }
};

const chooseSide = async (side: number) => {
    const choice = sideChoice.value;
    if (!choice) return;
    sideChoice.value = null;
    joining.value = true;
    try {
        const remote = await live.join(choice.code, side);
        const match = remote.match;
        if (remote.startedAt) match.time = remote.startedAt;
        game.value = { key: ++gameKey, match, startTeamIndex: remote.startTeamIndex, actions: remote.actions, refereeUsed: false, guest: true };
        persist();
        toast.add({ severity: 'success', summary: `Verbunden – dieses Handy zählt für ${getTeamName(match, side)}`, life: 3500 });
        router.replace('/Knecht');
    } catch (error) {
        showJoinError(error, choice.code);
        router.replace(resume() ? '/Knecht' : '/');
    } finally {
        joining.value = false;
    }
};

const cancelJoin = () => {
    sideChoice.value = null;
    router.replace(resume() ? '/Knecht' : '/');
};

const newGame = (match: Match) => {
    if ((game.value || loadStoredGame()) && !confirm('Das laufende Spiel wird verworfen. Neues Spiel starten?')) return false;
    if (live.binding.value) live.binding.value.role === 'host' ? live.finish('aborted') : live.leave();
    game.value = { key: ++gameKey, match: normalizeTeams(match), startTeamIndex: null, actions: [], refereeUsed: false };
    persist();
    if (isLiveEnabled()) startLive();
    return true;
};

const resume = () => {
    const stored = loadStoredGame();
    if (!stored) return false;
    const { match, startTeamIndex, actions, refereeUsed } = stored;
    game.value = { key: ++gameKey, match, startTeamIndex, actions, refereeUsed, guest: stored.live?.role === 'guest' };
    if (stored.live) live.resume(stored.live as LiveBinding);
    return true;
};

const onChange = (progress: { startTeamIndex: number | null; actions: KnechtAction[]; refereeUsed: boolean }) => {
    if (!game.value) return;
    Object.assign(game.value, progress);
    persist();
    live.schedulePush();
};

// ─── Spiel verlassen ───
const abort = () => {
    if (live.binding.value?.role === 'host') live.finish('aborted');
    else live.leave();
    clearStoredGame();
    game.value = null;
    router.push('/');
};

const leave = () => {
    persist();
    router.push('/');
};

// Revanche: gleiche Teams und gleicher Wettbewerb, neues Spiel
const toRematch = (match: Match): Match => ({
    _id: 'placeholder',
    team1: { ...match.team1, players: match.team1.players.map(player => ({ ...player, score: 0 })) },
    team2: { ...match.team2, players: match.team2.players.map(player => ({ ...player, score: 0 })) },
    ...(match.season !== undefined && { season: match.season }),
    ...(match.league !== undefined && { league: match.league }),
    ...(match.cupId !== undefined && { cupId: match.cupId, cupRound: match.cupRound }),
    ...(match.cupColors && { cupColors: match.cupColors }),
});

const onSaved = (result: Match, rematch: boolean) => {
    live.finish('done');
    clearStoredGame();
    const score = [result.team1, result.team2].map(team => formatPoints(team.players.reduce((sum, player) => sum + player.score, 0)));
    const suffix = isDemoMode ? ' (Demo, nur lokal gespeichert)' : ' eingetragen';
    toast.add({ severity: 'success', summary: `${getTeamName(result, 0)} ${score[0]} : ${score[1]} ${getTeamName(result, 1)}${suffix}`, life: 3500 });

    if (rematch) {
        game.value = { key: ++gameKey, match: toRematch(result), startTeamIndex: null, actions: [], refereeUsed: false };
        persist();
        if (isLiveEnabled()) startLive();
        return;
    }
    game.value = null;
    router.push(getResultPath(result));
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
        // Erfolgreich angesehen: weiter geht es mit der Seitenwahl (chooseSide / cancelJoin). Die Adresse
        // bleibt bis dahin stehen - ein Wechsel auf /Knecht laedt die Seite neu und die Wahl waere weg.
        if (await joinGame(code)) return;
        router.replace(resume() ? '/Knecht' : '/');
        return;
    }
    // Neues Spiel abgelehnt: das laufende geht weiter
    const started = hasLaunch() ? takeLaunch() || resume() : resume();
    if (!started) router.replace('/');
    // Fortgesetztes Spiel ohne Live (z.B. vor dem Update gestartet): Live nachholen
    else if (!live.binding.value && isLiveEnabled() && !game.value?.guest) startLive();
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
