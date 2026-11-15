import { computed, ref, shallowRef, toRaw, watch } from 'vue';
import {
    applyAction, canReRack, continueReplay, createInitialState, getAllowedThrowers, getHittableCups, getPlayersDone, getStandingCups, previewHit, replay,
    type BannerEvent, type KnechtAction, type KnechtConfig, type KnechtState, type ReplayResult,
} from './knechtEngine';
import { useBiPoSound } from './biPoSound';
import { findFormation, type KnechtFormation } from './knechtFormations';
import { animationLevel } from './knechtAnimations';

// Verbindet das Regelwerk (knechtEngine) mit der Oberflaeche: Auswahl des Werfers, Bouncer,
// Auswahl der Zusatzbecher, Rueckgaengig, Bearbeiten im Verlauf, Banner und Sound.
// Gespeichert wird hier nichts - das passiert erst am Spielende (KnechtUtilFunctions.saveKnechtGame).

export type KnechtMode = 'player' | 'referee';

// Zusatzbecher waehlen (zweiter Becher beim Bouncer, Becher 2 und 3 bei der Bombe)
export type CupPick = {
    cup: number;
    bouncer: boolean;
    type: Turn['type'];
    needed: number;
    candidates: number[];
    chosen: number[];
};

const BANNER_DURATION = 1800;
const CELEBRATION_DURATION = 2200;
// Normaler Treffer: kurze Animation, damit sie beim schnellen Eintragen nicht stoert
const HIT_DURATION = 1400;

// Grosse Animation wie beim Bowling. Zusaetzlich zu den Bannern der Engine auch fuer Aktionen ohne Regelfolge.
export type KnechtCelebrationKind =
    | 'bomb' | 'on-fire' | 'heating-up' | 'ballsback' | 'deathcup' | 'nachwurf' | 'overtime'
    | 'bouncer' | 'rerack' | 'trickshot' | 'trickshot-hit' | 'lastcup' | 'formation' | 'yellow-card' | 'red-card' | 'hit';
// teamIndex: wem die Animation zugewandt ist (bei Formationen das Team, das auf diese Becher wirft)
export type KnechtCelebration = { id: number; kind: KnechtCelebrationKind; player: string; teamIndex: number; formation?: KnechtFormation };

// Neue benannte Formation der stehenden Becher, je Rack (Team, dem die Becher gehoeren)
export const getNewFormations = (before: KnechtState, next: KnechtState) => [0, 1].flatMap(rackIndex => {
    if (next.status !== 'playing') return [];
    const standing = getStandingCups(next.racks[rackIndex]);
    if (standing.join() === getStandingCups(before.racks[rackIndex]).join()) return [];
    const formation = findFormation(standing);
    return formation ? [{ rackIndex, formation }] : [];
});

// Folgen fuer den naechsten Ball/Zug: kommen nach dem Treffer und nach einer neuen Formation
const FOLLOW_UP_EVENTS: KnechtCelebrationKind[] = ['heating-up', 'on-fire', 'ballsback', 'nachwurf', 'overtime'];

// Animationen einer Aktion in der Reihenfolge, in der es am Tisch passiert:
// 1. der Wurf selbst (letzter Becher, Bombe, Bouncer, Trickshot ...)
// 2. neue benannte Formation der stehenden Becher
// 3. was daraus fuer den naechsten Ball/Zug folgt (Heaten Up, On Fire, Balls Back, Nachwurf, Verlaengerung)
export const getCelebrations = (before: KnechtState, next: KnechtState, action: KnechtAction, previous?: KnechtAction) => {
    const throwKinds: KnechtCelebrationKind[] = [];
    const newTurn = next.turns.length > before.turns.length ? next.turns[next.turns.length - 1] : null;
    if (newTurn?.type === 'lastCup' && next.status === 'playing') throwKinds.push('lastcup');
    if (next.events.includes('deathcup')) throwKinds.push('deathcup');
    else if (next.events.includes('bomb')) throwKinds.push('bomb');
    else if (action.type === 'reRack') throwKinds.push('rerack');
    else if (action.type === 'elbow') throwKinds.push(action.cups.length ? 'red-card' : 'yellow-card');
    else if (action.type === 'trickshot') throwKinds.push('trickshot');
    else if (action.type === 'throw' && action.outcome === 'hit') {
        if (previous?.type === 'trickshot' && previous.catcher === action.player) throwKinds.push('trickshot-hit');
        else if (action.bouncer) throwKinds.push('bouncer');
    }
    // Normaler Treffer ohne Besonderheit
    if (!throwKinds.length && action.type === 'throw' && action.outcome === 'hit') throwKinds.push('hit');
    const followUps = next.events.filter(event => (FOLLOW_UP_EVENTS as string[]).includes(event)) as KnechtCelebrationKind[];
    // Verlaengerung: neu aufgestellte Becher sind keine geworfene Formation
    const formations = followUps.includes('overtime') ? [] : getNewFormations(before, next);
    return { throwKinds, formations, followUps };
};

const BALL_DURATION = 1500;

// size: Balldurchmesser in Pixeln, passend zur Bechergroesse auf dem Bildschirm
export type BallMark = { id: number; kind: 'miss' | 'airball' | 'hit'; x: number; y: number; size: number };

export const useBiPoKnecht = (match: Match, initialStartTeamIndex: number | null = null, initialActions: KnechtAction[] = []) => {
    const startTeamIndex = ref<number | null>(initialStartTeamIndex);
    // Fortgesetzte Spiele kommen als reaktive Proxys an - die Engine klont mit structuredClone und braucht reine Objekte
    const actions = shallowRef<KnechtAction[]>(toRaw(initialActions).map(action => toRaw(action)));
    const sound = useBiPoSound();

    const config = computed<KnechtConfig>(() => ({
        playerCounts: [match.team1.players.length, match.team2.players.length],
        startTeamIndex: startTeamIndex.value ?? 0,
    }));

    // Fortgesetztes Spiel aus einer aelteren Regelversion: nur den noch gueltigen Teil uebernehmen,
    // sonst kaemen neue Wuerfe hinter der ungueltigen Aktion nie im Spielstand an
    const loaded = replay(config.value, actions.value);
    const droppedActions = loaded.error ? actions.value.length - loaded.error.index : 0;
    if (loaded.error) actions.value = actions.value.slice(0, loaded.error.index);

    // ─── Spielstand ───
    // Zwischenstaende je Anzahl Aktionen: ein neuer Wurf, Rueckgaengig oder das Bearbeiten eines spaeten
    // Wurfs rechnen nur ab dem letzten passenden Stand weiter, statt das ganze Spiel nachzuspielen.
    const snapshots = new Map<number, KnechtState>();
    let snapshotActions: KnechtAction[] = [];
    let snapshotConfig: KnechtConfig | null = null;

    const replayCached = (list: KnechtAction[], count = list.length): ReplayResult => {
        if (snapshotConfig !== config.value) {
            snapshotConfig = config.value;
            snapshots.clear();
            snapshotActions = [];
            snapshots.set(0, createInitialState(config.value));
        }
        // Aktionen sind unveraenderlich: gleiches Objekt = gleiche Aktion
        let same = 0;
        while (same < list.length && same < snapshotActions.length && list[same] === snapshotActions[same]) same++;
        snapshots.forEach((_, key) => { if (key > same) snapshots.delete(key); });
        snapshotActions = list;

        const start = Math.max(...[...snapshots.keys()].filter(key => key <= count));
        const replayed = continueReplay(snapshots.get(start)!, list.slice(start, count), start);
        snapshots.set(replayed.error ? replayed.error.index : count, replayed.state);
        return replayed;
    };

    const result = computed(() => replayCached(actions.value));
    const state = computed<KnechtState>(() => result.value.state);
    // Stand nach den ersten count Aktionen (z.B. fuer das Bearbeiten eines Wurfs)
    const getStateAfter = (count: number) => replayCached(actions.value, count).state;
    const isStarted = computed(() => startTeamIndex.value !== null);
    const isOver = computed(() => state.value.status === 'over');

    // ─── Werfer ───
    const allowedThrowers = computed(() => getAllowedThrowers(state.value));
    const playersDone = computed(() => getPlayersDone(state.value));
    const chosenPlayer = ref(0);

    // Gewaehlter Spieler, solange er werfen darf, sonst der erste freie (synchron, ohne auf einen Watcher zu warten)
    const selectedPlayer = computed(() => {
        const allowed = allowedThrowers.value;
        return allowed.includes(chosenPlayer.value) ? chosenPlayer.value : allowed[0] ?? 0;
    });

    // Werfer-Reihenfolge merken: wer im letzten Zug seines Teams den ersten Ball geworfen hat,
    // ist im naechsten Zug des Teams wieder zuerst ausgewaehlt (sonst der erste freie Spieler)
    const firstThrower: (number | null)[] = [null, null];
    watch(() => state.value.activeTeamIndex, (team) => {
        const remembered = firstThrower[team];
        chosenPlayer.value = remembered !== null && allowedThrowers.value.includes(remembered) ? remembered : allowedThrowers.value[0] ?? 0;
    });

    const selectPlayer = (player: number) => {
        if (allowedThrowers.value.includes(player) && !pick.value) chosenPlayer.value = player;
    };

    // ─── Banner ───
    const banner = ref<BannerEvent>(null);
    let bannerTimer: ReturnType<typeof setTimeout> | null = null;
    const showBanner = (event: BannerEvent) => {
        if (bannerTimer) clearTimeout(bannerTimer);
        banner.value = event;
        if (event) bannerTimer = setTimeout(() => { banner.value = null; }, BANNER_DURATION);
    };

    // ─── Animationen ───
    // Mehrere Animationen nacheinander (z.B. Bombe, danach die neue Formation)
    const celebration = ref<KnechtCelebration | null>(null);
    let celebrationQueue: KnechtCelebration[] = [];
    let celebrationTimer: ReturnType<typeof setTimeout> | null = null;
    let celebrationId = 0;
    const showNextCelebration = () => {
        celebration.value = celebrationQueue.shift() ?? null;
        const duration = celebration.value?.kind === 'hit' ? HIT_DURATION : CELEBRATION_DURATION;
        celebrationTimer = celebration.value ? setTimeout(showNextCelebration, duration) : null;
    };
    const celebrate = (all: Omit<KnechtCelebration, 'id'>[]) => {
        // Einstellung im Menue: alle, nur besondere (ohne normale Treffer) oder keine Animationen
        const list = animationLevel.value === 'off' ? [] : animationLevel.value === 'special' ? all.filter(entry => entry.kind !== 'hit') : all;
        if (!list.length) return;
        // Neue Aktion: Animationen der vorigen Aktion nicht mehr nachholen
        if (celebrationTimer) clearTimeout(celebrationTimer);
        celebrationQueue = list.map(entry => ({ ...entry, id: now() * 100 + (++celebrationId % 100) }));
        showNextCelebration();
    };
    const clearCelebrations = () => {
        if (celebrationTimer) clearTimeout(celebrationTimer);
        celebrationTimer = null;
        celebrationQueue = [];
        celebration.value = null;
    };

    const FANFARE_EVENTS: BannerEvent[] = ['on-fire', 'overtime', 'win', 'nachwurf'];

    // Erst das Geraeusch des Wurfs, bei besonderen Momenten danach die Fanfare
    const playFeedback = (next: KnechtState, action: KnechtAction) => {
        if (next.banner === 'bomb' || action.type === 'deathcup') sound.playBomb();
        else if (action.type === 'throw' && action.outcome === 'hit') sound.playHit();
        else if (action.type === 'throw' && action.outcome === 'airball') sound.playAirball();
        else if (action.type !== 'reRack' && action.type !== 'turnStart') sound.playMiss();
        if (FANFARE_EVENTS.includes(next.banner)) setTimeout(sound.playFire, 350);
        showBanner(next.banner);
    };

    // ─── Aktionen ───
    const dispatch = (action: KnechtAction) => {
        let next: KnechtState;
        const before = state.value;
        const throwingTeam = before.activeTeamIndex;
        // Erster Ball eines normalen Zugs: Werfer fuer den naechsten Zug des Teams merken
        if ((action.type === 'throw' || action.type === 'trickshot') && before.round.ballsDone === 0 && !before.round.current
            && !before.round.ballsBack && before.nachwurfTeamIndex === null) firstThrower[throwingTeam] = action.player;
        try {
            next = applyAction(state.value, action);
        } catch {
            return false;
        }
        const newActions = [...actions.value, action];
        // Den neuen Stand direkt merken, dann muss nichts nachgespielt werden
        snapshotActions = newActions;
        snapshots.set(newActions.length, next);
        actions.value = newActions;
        bouncerArmed.value = false;
        pick.value = null;
        playFeedback(next, action);
        // Name unter der Animation: der Werfer, beim Trickshot der Faenger
        const playerIndex = action.type === 'trickshot' ? action.catcher : action.type === 'throw' || action.type === 'deathcup' || action.type === 'elbow' ? action.player : null;
        const nameTeam = action.type === 'elbow' ? action.team : throwingTeam;
        const name = playerIndex === null ? '' : (nameTeam === 0 ? match.team1 : match.team2).players[playerIndex]?.name ?? '';
        const { throwKinds, formations, followUps } = getCelebrations(before, next, action, newActions[newActions.length - 2]);
        const facing = action.type === 'elbow' ? 1 - action.team : throwingTeam;
        celebrate([
            ...throwKinds.map(kind => ({ kind, player: name, teamIndex: facing })),
            ...formations.map(({ rackIndex, formation }) => ({ kind: 'formation' as const, player: '', teamIndex: 1 - rackIndex, formation })),
            ...followUps.map(kind => ({ kind, player: name, teamIndex: facing })),
        ]);
        return true;
    };

    const now = () => new Date().getTime();

    const bouncerArmed = ref(false);
    const pick = ref<CupPick | null>(null);
    const hittableCups = computed(() => new Set(getHittableCups(state.value)));

    const toggleBouncer = () => {
        if (!pick.value) bouncerArmed.value = !bouncerArmed.value;
    };

    const throwHit = (cup: number, bouncer: boolean, extraCups: number[] = []) =>
        dispatch({ type: 'throw', player: selectedPlayer.value, outcome: 'hit', cup, bouncer, extraCups, time: now() });

    // Becher angetippt: Treffer, oder Zusatzbecher waehrend der Auswahl. true, wenn ein Wurf eingetragen wurde.
    const tapCup = (cup: number): boolean => {
        const current = pick.value;
        if (current) {
            if (!current.candidates.includes(cup)) return false;
            current.chosen = current.chosen.includes(cup) ? current.chosen.filter(other => other !== cup) : [...current.chosen, cup];
            return current.chosen.length === current.needed && throwHit(current.cup, current.bouncer, current.chosen);
        }
        if (!hittableCups.value.has(cup)) return false;

        const preview = previewHit(state.value, cup, bouncerArmed.value, selectedPlayer.value);
        if (preview.extrasNeeded === 0) return throwHit(cup, bouncerArmed.value);
        pick.value = { cup, bouncer: bouncerArmed.value, type: preview.type, needed: preview.extrasNeeded, candidates: preview.extraCandidates, chosen: [] };
        return false;
    };

    const cancelPick = () => { pick.value = null; };

    // detail: Landestelle und Kante eines Nullwurfs (siehe knechtEdges)
    const throwMiss = (outcome: 'miss' | 'airball', detail: { spot?: { x: number; y: number }; edge?: EdgeHit } = {}) => {
        if (pick.value) return false;
        return dispatch({ type: 'throw', player: selectedPlayer.value, outcome, time: now(), ...(outcome === 'miss' ? detail : {}) });
    };

    const trickshot = (catcher: number) => dispatch({ type: 'trickshot', player: selectedPlayer.value, catcher, time: now() });
    // Gefangen, aber noch nicht geworfen: der Trickshot-Knopf bleibt aktiv und nimmt ihn beim erneuten Tippen zurueck
    const trickshotPending = computed(() => actions.value.at(-1)?.type === 'trickshot');
    const reRack = () => dispatch({ type: 'reRack', time: now() });
    const startTurn = () => dispatch({ type: 'turnStart', time: now() });
    // Knecht Pro: neuer Zug (Runde) hat begonnen, aber noch kein "Zug starten" gedrueckt
    const waitingForTurnStart = computed(() => {
        const current = state.value;
        if (current.status !== 'playing' || !isStarted.value) return false;
        if (current.round.throwCount > 0) return false;
        const last = actions.value[actions.value.length - 1];
        return last?.type !== 'turnStart';
    });
    const deathcup = () => dispatch({ type: 'deathcup', player: selectedPlayer.value, time: now() });
    const ownCup = (team: number, player: number, cups: number[]) => dispatch({ type: 'ownCup', team, player, cups, time: now() });
    const elbow = (team: number, player: number, cups: number[]) => dispatch({ type: 'elbow', team, player, cups, time: now() });

    const canUndo = computed(() => !!pick.value || actions.value.length > 0);

    // ─── Ball-Anzeige ───
    // Bildschirmkoordinaten: der Ball bleibt dort, wo getippt wurde, auch wenn sich das Feld danach dreht
    const ballMark = ref<BallMark | null>(null);
    let ballTimer: ReturnType<typeof setTimeout> | null = null;
    const markBall = (kind: BallMark['kind'], x: number, y: number, size = 18) => {
        if (ballTimer) clearTimeout(ballTimer);
        ballMark.value = { id: now(), kind, x, y, size };
        ballTimer = setTimeout(() => { ballMark.value = null; }, BALL_DURATION);
    };

    const undo = () => {
        if (pick.value) return cancelPick();
        if (!actions.value.length) return;
        actions.value = actions.value.slice(0, -1);
        bouncerArmed.value = false;
        banner.value = null;
        clearCelebrations();
    };

    // Verlauf bearbeiten: neue Aktionsliste nur uebernehmen, wenn sie komplett gueltig ist
    const replaceActions = (newActions: KnechtAction[]): string | null => {
        const check = replay(config.value, newActions);
        if (check.error) return `Wurf ${check.error.index + 1}: ${check.error.message}`;
        actions.value = newActions;
        pick.value = null;
        bouncerArmed.value = false;
        return null;
    };

    const start = (teamIndex: number) => {
        startTeamIndex.value = teamIndex;
        actions.value = [];
    };

    return {
        match,
        config,
        startTeamIndex,
        actions,
        state,
        getStateAfter,
        droppedActions,
        isStarted,
        isOver,
        allowedThrowers,
        playersDone,
        selectedPlayer,
        selectPlayer,
        banner,
        celebration,
        bouncerArmed,
        toggleBouncer,
        pick,
        hittableCups,
        tapCup,
        cancelPick,
        throwMiss,
        trickshot,
        trickshotPending,
        reRack,
        startTurn,
        waitingForTurnStart,
        canReRack: computed(() => canReRack(state.value)),
        deathcup,
        ownCup,
        elbow,
        canUndo,
        undo,
        ballMark,
        markBall,
        replaceActions,
        start,
        sound,
    };
};

export type BiPoKnechtGame = ReturnType<typeof useBiPoKnecht>;
