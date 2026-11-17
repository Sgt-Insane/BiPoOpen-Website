import {
    applyAction, getAllowedThrowers, getHittableCups, getStandingCups, getTeamPoints, previewHit, replay,
    type KnechtAction, type KnechtConfig, type KnechtState,
} from './knechtEngine';

// Nachbearbeiten: eine Aenderung an einem frueheren Eintrag uebernehmen und die spaeteren Eintraege
// so wenig wie moeglich anpassen, statt die ganze Aenderung abzulehnen.
//
// Reparaturen (nur wenn ein spaeterer Eintrag sonst ungueltig waere):
// - Becher getauscht: wurde Becher A als B korrigiert, wird ein spaeterer Treffer auf B zu A (und umgekehrt)
// - Werfer passt nicht mehr: der naechste erlaubte Spieler desselben Teams wirft
// - Zusatzbecher (Bouncer/Bombe) passen nicht mehr: neu gewaehlt
// - Re-Rack ist nicht mehr erlaubt: entfaellt
// - Spiel ist frueher vorbei: die Eintraege danach entfallen

export type RepairChange = { time: number; text: string };

export type EditPlan = {
    actions: KnechtAction[];
    changes: RepairChange[];        // angepasste spaetere Eintraege
    dropped: number;                // Eintraege nach dem (frueheren) Spielende
    error: string | null;           // nicht automatisch loesbar
    errorTime: number | null;       // Zeitpunkt des Eintrags, an dem es hakt (fuer "ab Minute X")
    scoreBefore: [number, number];
    scoreAfter: [number, number];
    wasOver: boolean;
    isOver: boolean;
    winnerBefore: number | null;
    winnerAfter: number | null;
};

type CupSwap = { rackTeam: number; a: number; b: number } | null;

const isThrow = (action: KnechtAction): action is Extract<KnechtAction, { type: 'throw' }> => action.type === 'throw';

// Welcher Becher war beim bearbeiteten Treffer gemeint und welcher ist es jetzt? (fuer den Tausch spaeterer Treffer)
const getCupSwap = (before: KnechtState, original: KnechtAction | undefined, edited: KnechtAction | undefined): CupSwap => {
    if (!original || !edited || !isThrow(original) || !isThrow(edited)) return null;
    if (original.outcome !== 'hit' || edited.outcome !== 'hit') return null;
    if (original.cup === undefined || edited.cup === undefined || original.cup === edited.cup) return null;
    return { rackTeam: 1 - before.activeTeamIndex, a: original.cup, b: edited.cup };
};

const swapCup = (cup: number, swap: CupSwap) => !swap ? cup : cup === swap.a ? swap.b : cup === swap.b ? swap.a : cup;

const TEAM_ACTIONS = new Set<KnechtAction['type']>(['throw', 'trickshot', 'deathcup']);

// Welches Team war vor jedem Eintrag am Wurf? (um verschobene Zuege zu erkennen)
const getTeamsBefore = (config: KnechtConfig, actions: KnechtAction[]) => {
    const teams: number[] = [];
    let state = replay(config, []).state;
    for (const action of actions) {
        teams.push(state.activeTeamIndex);
        const next = tryApply(state, action);
        if (!next) break;
        state = next;
    }
    return teams;
};

const tryApply = (state: KnechtState, action: KnechtAction): KnechtState | null => {
    try { return applyAction(state, action); } catch { return null; }
};

// Einen ungueltigen spaeteren Eintrag passend machen; null = nicht moeglich
const fixAction = (state: KnechtState, action: KnechtAction, swap: CupSwap, names: (team: number, player: number) => string): { action: KnechtAction | 'drop'; text: string } | null => {
    if (action.type === 'reRack') return { action: 'drop', text: 'Re-Rack entfällt (passt nicht mehr)' };
    if (action.type === 'turnStart') return { action: 'drop', text: '„Zug starten“ entfällt' };

    const team = state.activeTeamIndex;
    const notes: string[] = [];
    let fixed: KnechtAction = action;

    if (fixed.type === 'throw' || fixed.type === 'trickshot' || fixed.type === 'deathcup') {
        const allowed = getAllowedThrowers(state);
        if (allowed.length && !allowed.includes(fixed.player)) {
            const player = allowed[0];
            notes.push(`Werfer ${names(team, fixed.player)} → ${names(team, player)}`);
            fixed = { ...fixed, player };
        }
    }

    if (fixed.type === 'throw' && fixed.outcome === 'hit' && fixed.cup !== undefined) {
        const hittable = getHittableCups(state);
        let cup = fixed.cup;
        if (!hittable.includes(cup) && swap?.rackTeam === 1 - team && hittable.includes(swapCup(cup, swap))) {
            cup = swapCup(cup, swap);
            notes.push(`Becher ${fixed.cup + 1} → ${cup + 1}`);
        }
        if (!hittable.includes(cup)) return null;
        const preview = previewHit(state, cup, !!fixed.bouncer, fixed.player);
        const extras = (fixed.extraCups ?? []).map(extra => swap?.rackTeam === 1 - team ? swapCup(extra, swap) : extra);
        const kept = extras.filter(extra => extra !== cup && preview.extraCandidates.includes(extra));
        const extraCups = [...kept, ...preview.extraCandidates.filter(extra => extra !== cup && !kept.includes(extra))].slice(0, preview.extrasNeeded);
        if (extraCups.join() !== (fixed.extraCups ?? []).join() && preview.extrasNeeded) notes.push('Zusatzbecher neu gewählt');
        fixed = { ...fixed, cup, extraCups: preview.extrasNeeded ? extraCups : undefined };
    }

    if ((fixed.type === 'elbow' || fixed.type === 'ownCup') && fixed.cups.length) {
        const rackTeam = fixed.team;
        const standing = getStandingCups(state.racks[rackTeam]);
        const cups = fixed.cups.map(cup => standing.includes(cup) ? cup : swap?.rackTeam === rackTeam ? swapCup(cup, swap) : cup);
        if (cups.some(cup => !standing.includes(cup))) return null;
        if (cups.join() !== fixed.cups.join()) notes.push(`Becher ${fixed.cups.map(cup => cup + 1).join(', ')} → ${cups.map(cup => cup + 1).join(', ')}`);
        fixed = { ...fixed, cups };
    }

    return notes.length ? { action: fixed, text: notes.join(' · ') } : null;
};

export const planEdit = (
    config: KnechtConfig,
    actions: KnechtAction[],
    editIndex: number,
    replacement: KnechtAction | null,      // null = Eintrag loeschen
    names: (team: number, player: number) => string,
): EditPlan => {
    const original = replay(config, actions).state;
    const teamsBefore = getTeamsBefore(config, actions);
    const head = actions.slice(0, editIndex);
    let state = replay(config, head).state;
    const swap = getCupSwap(state, actions[editIndex], replacement ?? undefined);

    const result: KnechtAction[] = [...head];
    const changes: RepairChange[] = [];
    let dropped = 0;
    let error: string | null = null;
    let errorTime: number | null = null;

    const tail = replacement ? [replacement, ...actions.slice(editIndex + 1)] : actions.slice(editIndex + 1);
    for (let offset = 0; offset < tail.length; offset++) {
        const action = tail[offset];
        const isEdited = replacement !== null && offset === 0;
        if (state.status === 'over') { dropped = tail.length - offset; break; }

        // Zug verschoben (z.B. Balls Back entsteht oder faellt weg): spaetere Wuerfe gehoerten dann zum anderen Team
        const originalIndex = editIndex + offset + (replacement ? 0 : 1);
        if (!isEdited && TEAM_ACTIONS.has(action.type) && teamsBefore[originalIndex] !== undefined && teamsBefore[originalIndex] !== state.activeTeamIndex) {
            error = 'Dadurch wäre danach das andere Team am Wurf (z. B. weil Balls Back entsteht oder wegfällt). Die späteren Würfe bitte von hinten her anpassen oder löschen.';
            errorTime = action.time;
            break;
        }

        const next = tryApply(state, action);
        if (next) { result.push(action); state = next; continue; }

        if (isEdited) { error = 'Diese Änderung ist an dieser Stelle nicht möglich.'; break; }
        const fix = fixAction(state, action, swap, names);
        if (fix?.action === 'drop') { changes.push({ time: action.time, text: fix.text }); continue; }
        const fixedState = fix ? tryApply(state, fix.action) : null;
        if (!fix || !fixedState) {
            error = 'Ein späterer Wurf passt dann nicht mehr. Ihn zuerst anpassen oder löschen.';
            errorTime = action.time;
            break;
        }
        changes.push({ time: action.time, text: fix.text });
        result.push(fix.action);
        state = fixedState;
    }

    return {
        actions: result,
        changes,
        dropped,
        error,
        errorTime,
        scoreBefore: getTeamPoints(original),
        scoreAfter: getTeamPoints(state),
        wasOver: original.status === 'over',
        isOver: state.status === 'over',
        winnerBefore: original.winnerTeamIndex,
        winnerAfter: state.winnerTeamIndex,
    };
};
