import { CUP_COUNT, OVERTIME_FORMATION, RE_RACK_FORMATIONS } from '@/components/frontend/biPoKnecht/knechtEngine';
import { getScoringTeam } from '@/components/frontend/biPoKnecht/knechtStats';

// Becher-Dreieck "was fiel wann": fuer jedes Team-Rack, welcher Becher wann und von wem abgeraeumt wurde.
// Re-Rack und Verlaengerung stellen die Becher neu auf: dann beginnt fuer das Rack ein neuer Abschnitt.

export type CupFall = { order: number; minute: number | null; teamIndex: number; playerIndex: number; kind: Turn['type'] };

export type RackPhase = {
    label: string;                      // "Start", "Re-Rack 12'", "Verlängerung"
    standingAtStart: number[];          // Becherpositionen (0-9), die zu Beginn stehen
    falls: Record<number, CupFall>;     // Position -> wann sie fiel
};

export type RackHistory = { ownerIndex: number; phases: RackPhase[] };

// Welche Becherpositionen ein Eintrag abraeumt
export const getTurnCupPositions = (turn: Turn): number[] => {
    const data = (turn.data ?? {}) as Record<string, unknown>;
    if (turn.type === 'deathcup' || turn.type === 'owncup' || turn.type === 'penalty') return (data.cups as number[] | undefined) ?? [];
    if (turn.type === 'lastCup' && data.double) return [];
    const keys = Object.keys(data).filter(key => key.startsWith('cupIndex')).sort();
    // Bombe: cupIndex1 ist der Becher des ersten Balls, der schon beim ersten Wurf gefallen ist
    const cups = keys.map(key => data[key] as number).filter(cup => typeof cup === 'number');
    return turn.type === 'bomb' ? cups.slice(1) : cups;
};

// null: der Verlauf passt nicht zusammen (z.B. alte Knecht-Spiele ohne Re-Rack-Eintraege) - dann kein Dreieck
export const buildCupHistory = (match: Match): RackHistory[] | null => {
    const turns = match.turns ?? [];
    const events = [...(match.events ?? [])].filter(event => event.kind === 'reRack' || event.kind === 'overtime');
    const start = match.time ?? turns[0]?.time;
    const minuteOf = (time?: number) => start && time ? Math.max(0, Math.floor((time - start) / 60000)) : null;

    const all = Array.from({ length: CUP_COUNT }, (_, cup) => cup);
    const racks: RackHistory[] = [0, 1].map(ownerIndex => ({ ownerIndex, phases: [{ label: 'Start', standingAtStart: [...all], falls: {} }] }));
    const standing = [new Set(all), new Set(all)];
    // Der Knecht stellt den letzten stehenden Becher an die Spitze (Position 0): angezeigt wird er an seiner alten Stelle
    const lastCupFrom: (number | null)[] = [null, null];

    const newPhase = (owner: number, label: string, formation: number[]) => {
        standing[owner] = new Set(formation);
        lastCupFrom[owner] = null;
        racks[owner].phases.push({ label, standingAtStart: [...formation], falls: {} });
    };
    const applyEvents = (index: number) => events.filter(event => event.afterTurnIndex === index).forEach(event => {
        const minute = minuteOf(event.time);
        const suffix = minute !== null ? ` ${minute}'` : '';
        if (event.kind === 'overtime') {
            [0, 1].forEach(owner => newPhase(owner, `Verlängerung${suffix}`, OVERTIME_FORMATION));
        } else {
            // Re-Rack: das Team, das es verlangt, wirft auf das Rack des Gegners
            const owner = 1 - event.teamIndex;
            newPhase(owner, `Re-Rack${suffix}`, RE_RACK_FORMATIONS[standing[owner].size] ?? [...standing[owner]]);
        }
    });

    let order = 0;
    let valid = true;
    turns.forEach((turn, index) => {
        applyEvents(index);
        const cups = getTurnCupPositions(turn);
        if (!cups.length) return;
        const owner = 1 - getScoringTeam(turn);
        const phase = racks[owner].phases[racks[owner].phases.length - 1];
        cups.forEach(cup => {
            const position = cup === 0 && lastCupFrom[owner] !== null ? lastCupFrom[owner]! : cup;
            if (!standing[owner].has(position)) { valid = false; return; }
            standing[owner].delete(position);
            phase.falls[position] = { order: ++order, minute: minuteOf(turn.time), teamIndex: turn.teamIndex, playerIndex: turn.playerIndex, kind: turn.type };
        });
        const [last] = [...standing[owner]];
        if (standing[owner].size === 1 && last !== 0 && lastCupFrom[owner] === null) lastCupFrom[owner] = last;
    });
    applyEvents(turns.length);
    return valid ? racks : null;
};
