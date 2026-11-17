<template>
    <div class="MultiplayerPage">
        <!-- Spiel laeuft: BiPo Knecht im Vollbild, jedes Handy aus Sicht seines Spielers -->
        <BiPoKnecht
            v-if="session && session.match && isInGame"
            ref="knecht"
            :key="knechtKey"
            :match="session.match"
            :startTeamIndex="session.startTeamIndex"
            :actions="session.actions"
            :refereeUsed="false"
            :phoneSide="myTeam"
            :phonePlayer="Math.max(0, myPlayerIndex)"
            :undoAllowed="session.authors.at(-1) === deviceId"
            :saveHandler="saveHandler"
            :savingText="savingText"
            :sessionCode="session.code"
            @change="onKnechtChange"
            @exit="onKnechtExit"
            @leave="onKnechtLeave"
        />

        <template v-else>
            <PageHeader title="Spiel starten" subtitle="Jeder spielt mit seinem eigenen Handy">
                <template v-if="session" #actions>
                    <span class="mp-status" :class="{ 'mp-status--offline': offline }">
                        <span class="mp-status-dot"></span>{{ offline ? 'Offline' : 'Verbunden' }}
                    </span>
                </template>
            </PageHeader>

            <div v-if="loading" class="bp-skeleton" style="height: 320px"></div>

            <ProfilePicker v-else-if="!profileName" @saved="onProfileSaved" />

            <MpLobby
                v-else-if="session"
                :session="session"
                :deviceId="deviceId"
                :options="gameOptions"
                :loadingOptions="loadingOptions"
                @move="movePlayer"
                @prepare="prepareStart"
                @start="startGame"
                @cancelOptions="gameOptions = null"
                @leave="leaveLobby"
                @share="share"
            />

            <MpConnect
                v-else
                :bumpState="bumpState"
                :isSupported="bumpSensor.isSupported"
                :isListening="bumpSensor.isListening.value"
                :denied="bumpSensor.denied.value"
                :hasSensor="bumpSensor.hasSensor.value"
                :busy="busy"
                :isLocal="api.kind === 'local'"
                @enable="bumpSensor.start()"
                @bump="bump()"
                @create="createLobby"
                @join="joinLobby"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useGrayPage } from '@/components/shared/useGrayPage';
import PageHeader from '@/components/shared/PageHeader.vue';
import BiPoKnecht from '../biPoKnecht/BiPoKnecht.vue';
import type { LiveProgress } from '../biPoKnecht/knechtLive';
import { replay, type KnechtAction } from '../biPoKnecht/knechtEngine';
import { formatPoints, getResultPath, getTeamName, saveKnechtGame, toRematch } from '../biPoKnecht/KnechtUtilFunctions';
import { isDemoMode } from '@/util/demoGames';
import ProfilePicker from './ProfilePicker.vue';
import MpConnect from './MpConnect.vue';
import MpLobby from './MpLobby.vue';
import { useProfile } from './useProfile';
import { useBump } from './useBump';
import { useMultiplayerSession } from './useMultiplayerSession';
import { getGameOptions, type MpGameOption } from './multiplayerGameOptions';
import { MAX_PLAYERS_PER_TEAM, MpError, getTeamPlayers, type MpPatch, type MpResult, type MpSession } from './multiplayerTypes';

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

const showError = (error: unknown, fallback: string) => {
    toast.add({ severity: 'error', summary: error instanceof MpError ? error.message : fallback, life: 4000 });
};

// ─── Anstossen ───
// Aktiv, solange man noch kein Spiel hat oder in der Lobby weitere Spieler holen kann
const bumpSensor = useBump(() => {
    if (profileName.value && (!session.value || session.value.status === 'lobby')) bump();
});

// URL zeigt den Code, damit Neuladen und Teilen funktionieren
watch(() => session.value?.code, (code) => {
    const path = code ? `/Mitspielen/${code}` : '/Mitspielen';
    if (route.path !== path) window.history.replaceState({ ...window.history.state, as: path, url: path }, '', path);
});

// ─── Beitreten ───
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

const createLobby = () => run(create, 'Spiel konnte nicht erstellt werden');
const joinLobby = (code: string) => run(() => join(code), 'Beitreten hat nicht geklappt');

const leaveLobby = async () => {
    await leave();
    router.push('/Profil');
};

const share = async () => {
    if (!session.value) return;
    const url = `${window.location.origin}/Mitspielen/${session.value.code}`;
    const text = `Spiel mit mir im BiPo Knecht – Code ${session.value.code}`;
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
        await run(() => join(code), 'Beitreten hat nicht geklappt');
    } else if (storedCode.value) {
        await resume();
    }
};

const onProfileSaved = () => { enterFromRoute(); };

// ─── Lobby ───
const movePlayer = (playerId: string) => commit(current => {
    if (current.status !== 'lobby') return null;
    const player = current.players.find(entry => entry.deviceId === playerId);
    if (!player || getTeamPlayers(current.players, 1 - player.team).length >= MAX_PLAYERS_PER_TEAM) return null;
    return { players: current.players.map(entry => entry.deviceId === playerId ? { ...entry, team: 1 - entry.team, joinedAt: Date.now() } : entry) };
});

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

const startGame = async (option: MpGameOption) => {
    gameOptions.value = null;
    const result = await commit(current => current.status === 'lobby'
        ? { status: 'playing', match: option.match, startTeamIndex: null, actions: [], authors: [], savingBy: null }
        : null);
    if (result === 'failed') toast.add({ severity: 'error', summary: 'Start hat nicht geklappt – bitte nochmal', life: 3000 });
};

// ─── Spiel ───
const isInGame = computed(() => session.value?.status === 'playing' || session.value?.status === 'saving');
const knechtKey = computed(() => `${session.value?.code}-${session.value?.result?.id ?? 0}`);

const knecht = ref<{ getProgress: () => LiveProgress; applyRemote: (progress: LiveProgress) => boolean } | null>(null);

const nameOf = (id: string | null) => session.value?.players.find(player => player.deviceId === id)?.name ?? 'Ein anderes Handy';
const savingText = computed(() => {
    const current = session.value;
    return current?.status === 'saving' && current.savingBy !== deviceId ? `${nameOf(current.savingBy)} trägt ein …` : undefined;
});

// Reine Kopien: die Engine klont mit structuredClone, reaktive Objekte (z.B. spot) lassen sich nicht klonen
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const progressOf = (current: MpSession): LiveProgress => ({
    startTeamIndex: current.startTeamIndex,
    startedAt: current.match?.time ?? null,
    actions: plain(current.actions),
    match: current.match ? plain(current.match) : undefined,
    paused: !!current.paused,
});

// Gemeinsamen Stand in den Knecht uebernehmen (neue Wuerfe der anderen mit Animation und Ton)
const showShared = () => {
    const current = session.value;
    if (current && knecht.value) knecht.value.applyRemote(progressOf(current));
};
watch(() => session.value?.version, () => nextTick(showShared));

const sameAction = (a: KnechtAction, b: KnechtAction) => JSON.stringify(a) === JSON.stringify(b);
const commonPrefix = (a: KnechtAction[], b: KnechtAction[]) => {
    let index = 0;
    while (index < a.length && index < b.length && sameAction(a[index], b[index])) index++;
    return index;
};
const isValid = (current: MpSession, startTeamIndex: number, actions: KnechtAction[]) => !replay({
    playerCounts: [current.match?.team1.players.length ?? 1, current.match?.team2.players.length ?? 1],
    startTeamIndex,
}, actions).error;

// Eigene Eingabe ins gemeinsame Spiel. Neue Wuerfe werden auf den neuesten Stand gesetzt (zwei Mitspieler
// werfen gleichzeitig), Rueckgaengig/Korrekturen nur, wenn niemand dazwischen etwas eingetragen hat.
const onKnechtChange = async () => {
    const known = session.value;
    const progress = knecht.value?.getProgress();
    if (!known || !isInGame.value || !progress) return;
    const knownActions = known.actions;

    const result = await commit(current => {
        if (progress.startTeamIndex !== current.startTeamIndex) {
            if (current.startTeamIndex !== null || progress.startTeamIndex === null) return null;   // anderes Handy hat schon gestartet
            return {
                startTeamIndex: progress.startTeamIndex,
                actions: progress.actions,
                authors: progress.actions.map(() => deviceId),
                match: { ...current.match!, ...progress.match, time: progress.startedAt ?? current.match?.time ?? Date.now() },
            };
        }
        // Becherfarben und Pause gelten fuer alle
        const shared: MpPatch = {};
        if (progress.match?.cupColors && JSON.stringify(progress.match.cupColors) !== JSON.stringify(current.match?.cupColors))
            shared.match = { ...current.match!, cupColors: progress.match.cupColors };
        if (!!progress.paused !== !!current.paused) shared.paused = !!progress.paused;
        const withShared = (patch: MpPatch | null) => patch ? { ...shared, ...patch } : Object.keys(shared).length ? shared : null;

        if (progress.actions.length === current.actions.length && commonPrefix(progress.actions, current.actions) === current.actions.length) return withShared(null);

        const prefix = commonPrefix(knownActions, progress.actions);
        if (prefix === knownActions.length) {
            const added = progress.actions.slice(prefix);
            const merged = [...current.actions, ...added];
            if (!isValid(current, current.startTeamIndex ?? 0, merged)) return withShared(null);
            return withShared({ actions: merged, authors: [...current.authors, ...added.map(() => deviceId)] });
        }
        if (current.actions.length !== knownActions.length || commonPrefix(current.actions, knownActions) !== knownActions.length) return withShared(null);
        return withShared({
            actions: progress.actions,
            authors: progress.actions.map((_, index) => index < prefix ? current.authors[index] ?? deviceId : deviceId),
        });
    });

    // Eingabe passte nicht mehr zum gemeinsamen Stand: Knecht zeigt wieder den aktuellen Stand
    const shown = session.value;
    const differs = shown && (shown.startTeamIndex !== progress.startTeamIndex || commonPrefix(shown.actions, progress.actions) !== Math.max(shown.actions.length, progress.actions.length));
    if (result === 'failed' || (result === 'noop' && differs)) {
        showShared();
        if (result === 'failed') toast.add({ severity: 'warn', summary: 'Eintrag nicht übernommen – bitte nochmal', life: 3000 });
        else if (shown?.startTeamIndex === progress.startTeamIndex) toast.add({ severity: 'info', summary: 'Ein Mitspieler hat gleichzeitig eingetragen – bitte prüfen, ob dein Wurf fehlt', life: 3500 });
    }
};

// Nur ein Handy traegt ein: erst die Session fuer sich beanspruchen, dann speichern
const saveHandler = async (result: Match, rematch: boolean): Promise<boolean> => {
    const claim = await commit(current => current.status === 'playing' ? { status: 'saving', savingBy: deviceId } : null);
    if (claim !== 'applied') {
        toast.add({ severity: 'info', summary: `${nameOf(session.value?.savingBy ?? null)} trägt das Spiel gerade ein`, life: 3000 });
        return false;
    }

    let success = false;
    try {
        success = await saveKnechtGame(result);
    } catch {
        success = false;
    }
    if (!success) {
        await commit(current => current.savingBy === deviceId ? { status: 'playing', savingBy: null } : null);
        toast.add({ severity: 'error', summary: 'Spiel nicht gespeichert – bitte nochmal versuchen', life: 4000 });
        return false;
    }

    const saved: MpResult = { id: Date.now(), match: result, path: getResultPath(result), rematch, savedBy: deviceId };
    await commit(() => rematch
        ? { status: 'playing', savingBy: null, result: saved, match: toRematch(result), startTeamIndex: null, actions: [], authors: [] }
        : { status: 'saved', savingBy: null, result: saved });
    return true;
};

// Abbrechen: vor dem ersten Wurf zurueck in die Lobby, sonst fuer alle beenden
const onKnechtExit = () => commit(current => current.startTeamIndex === null
    ? { status: 'lobby', match: null, actions: [], authors: [] }
    : { status: 'aborted' });

const onKnechtLeave = () => {
    suspend();
    router.push('/');
};

// ─── Ergebnis und Ende (fuer alle Handys gleich) ───
let lastResultId = session.value?.result?.id ?? 0;
let lastStatus = session.value?.status;

watch(session, (current) => {
    if (!current) return;
    const result = current.result;
    if (result && result.id !== lastResultId) {
        lastResultId = result.id;
        const score = [result.match.team1, result.match.team2].map(team => formatPoints(team.players.reduce((sum, player) => sum + player.score, 0)));
        const suffix = isDemoMode ? ' (Demo, nur lokal gespeichert)' : ' eingetragen';
        toast.add({
            severity: 'success',
            summary: `${getTeamName(result.match, 0)} ${score[0]} : ${score[1]} ${getTeamName(result.match, 1)}${suffix}`,
            detail: result.savedBy !== deviceId ? `von ${nameOf(result.savedBy)}` : undefined,
            life: 3500,
        });
        if (!result.rematch) {
            clear();
            router.push(result.path);
            return;
        }
    }
    if (current.status === 'aborted' && lastStatus !== 'aborted') {
        clear();
        toast.add({ severity: 'info', summary: 'Das Spiel wurde abgebrochen', life: 3000 });
        router.push('/Profil');
    }
    lastStatus = current.status;
});

const stopEnded = onEnded((_, reason) => {
    toast.add({ severity: 'info', summary: reason, life: 3000 });
});

onMounted(async () => {
    // Android braucht keine Erlaubnis: sofort lauschen. iPhone: erst nach "Anstossen aktivieren".
    if (!bumpSensor.needsPermission) bumpSensor.start();
    try {
        await enterFromRoute();
    } finally {
        loading.value = false;
        lastResultId = session.value?.result?.id ?? 0;
        lastStatus = session.value?.status;
    }
});

onUnmounted(() => {
    stopEnded();
    // Lobby/Spiel laeuft weiter, die Seite fragt nur nicht mehr nach
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
</style>
