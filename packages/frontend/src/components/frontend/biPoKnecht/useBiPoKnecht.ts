import { computed, ref, shallowRef, watch } from 'vue';
import {
    applyAction, canReRack, getAllowedThrowers, getHittableCups, getPlayersDone, previewHit, replay,
    type BannerEvent, type KnechtAction, type KnechtConfig, type KnechtState,
} from './knechtEngine';
import { useBiPoSound } from './biPoSound';

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

export const useBiPoKnecht = (match: Match, initialStartTeamIndex: number | null = null, initialActions: KnechtAction[] = []) => {
    const startTeamIndex = ref<number | null>(initialStartTeamIndex);
    const actions = shallowRef<KnechtAction[]>(initialActions);
    const sound = useBiPoSound();

    const config = computed<KnechtConfig>(() => ({
        playerCounts: [match.team1.players.length, match.team2.players.length],
        startTeamIndex: startTeamIndex.value ?? 0,
    }));

    const result = computed(() => replay(config.value, actions.value));
    const state = computed<KnechtState>(() => result.value.state);
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

    // Neues Team am Wurf: Auswahl beginnt wieder beim ersten freien Spieler
    watch(() => state.value.activeTeamIndex, () => { chosenPlayer.value = allowedThrowers.value[0] ?? 0; });

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

    const playFeedback = (next: KnechtState, action: KnechtAction) => {
        const turn = next.turns.at(-1);
        if (next.banner === 'bomb' || next.banner === 'deathcup') sound.playBomb();
        else if (next.banner === 'on-fire' || next.banner === 'overtime' || next.banner === 'win' || next.banner === 'nachwurf') sound.playFire();
        else if (action.type === 'throw' && action.outcome === 'hit') sound.playHit();
        else if (action.type === 'throw' && action.outcome === 'airball') sound.playAirball();
        else if (turn && action.type !== 'reRack') sound.playMiss();
        showBanner(next.banner);
    };

    // ─── Aktionen ───
    const dispatch = (action: KnechtAction) => {
        let next: KnechtState;
        try {
            next = applyAction(state.value, action);
        } catch {
            return false;
        }
        actions.value = [...actions.value, action];
        bouncerArmed.value = false;
        pick.value = null;
        playFeedback(next, action);
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

    // Becher angetippt: Treffer, oder Zusatzbecher waehrend der Auswahl
    const tapCup = (cup: number) => {
        const current = pick.value;
        if (current) {
            if (!current.candidates.includes(cup)) return;
            current.chosen = current.chosen.includes(cup) ? current.chosen.filter(other => other !== cup) : [...current.chosen, cup];
            if (current.chosen.length === current.needed) throwHit(current.cup, current.bouncer, current.chosen);
            return;
        }
        if (!hittableCups.value.has(cup)) return;

        const preview = previewHit(state.value, cup, bouncerArmed.value, selectedPlayer.value);
        if (preview.extrasNeeded === 0) {
            throwHit(cup, bouncerArmed.value);
            return;
        }
        pick.value = { cup, bouncer: bouncerArmed.value, type: preview.type, needed: preview.extrasNeeded, candidates: preview.extraCandidates, chosen: [] };
    };

    const cancelPick = () => { pick.value = null; };

    const throwMiss = (outcome: 'miss' | 'airball') => {
        if (pick.value) return;
        dispatch({ type: 'throw', player: selectedPlayer.value, outcome, time: now() });
    };

    const trickshot = (catcher: number) => dispatch({ type: 'trickshot', player: selectedPlayer.value, catcher, time: now() });
    const reRack = () => dispatch({ type: 'reRack', time: now() });
    const deathcup = () => dispatch({ type: 'deathcup', player: selectedPlayer.value, time: now() });
    const ownCup = (team: number, player: number, cups: number[]) => dispatch({ type: 'ownCup', team, player, cups, time: now() });

    const canUndo = computed(() => !!pick.value || actions.value.length > 0);

    const undo = () => {
        if (pick.value) return cancelPick();
        if (!actions.value.length) return;
        actions.value = actions.value.slice(0, -1);
        bouncerArmed.value = false;
        banner.value = null;
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
        isStarted,
        isOver,
        allowedThrowers,
        playersDone,
        selectedPlayer,
        selectPlayer,
        banner,
        bouncerArmed,
        toggleBouncer,
        pick,
        hittableCups,
        tapCup,
        cancelPick,
        throwMiss,
        trickshot,
        reRack,
        canReRack: computed(() => canReRack(state.value)),
        deathcup,
        ownCup,
        canUndo,
        undo,
        replaceActions,
        start,
        sound,
    };
};

export type BiPoKnechtGame = ReturnType<typeof useBiPoKnecht>;
