import { CUP_COUNT, getStandingCups, isHitTurnType, type KnechtState } from './knechtEngine';

// Wer hat welchen Becher abgeraeumt und wer muss ihn trinken?
// - Werfer: steht auf dem Platz des getroffenen Bechers (Profilbild)
// - Trinker: im Team des getroffenen Bechers immer abwechselnd. Wer im Team als Erster geworfen hat,
//   trinkt den ersten Becher, dann der Naechste usw. (Bombe: jeder Becher zaehlt einzeln).
// Ein getroffenes Feld behaelt das Profilbild bis zum Spielende. Steht dort (Re-Rack, letzter Becher an der Spitze,
// Verlaengerung) wieder ein Becher, wandert das Bild auf ein freies Feld: so sind immer alle Werfer zu sehen.

export type CupRemoval = {
    turnIndex: number;
    rackTeam: number;           // wessen Becher
    cup: number;
    thrower: { teamIndex: number; playerIndex: number };
    drinker: number;            // Spieler im Team rackTeam
};

export type CupOwners = {
    racks: [Map<number, CupRemoval>, Map<number, CupRemoval>];    // aktuelle Plaetze je Rack
    removals: CupRemoval[];                                        // alle Becher in Reihenfolge
};

const cupsOfTurn = (turn: Turn): { rackTeam: number; cups: number[] } | null => {
    const data = (turn.data ?? {}) as Record<string, unknown>;
    const enemy = 1 - turn.teamIndex;
    const listed = Array.isArray(data.cups) ? data.cups as number[] : [];
    if (turn.type === 'owncup' || turn.type === 'penalty') return { rackTeam: turn.teamIndex, cups: listed };
    if (turn.type === 'deathcup') return { rackTeam: enemy, cups: listed };
    if (!isHitTurnType(turn.type)) return null;
    if (turn.type === 'lastCup' && data.double) return null;     // zweiter Ball im selben Becher
    const keys = Object.keys(data).filter(key => key.startsWith('cupIndex')).sort();
    // Bombe: cupIndex1 ist der Becher des ersten Balls, der wurde schon mit dem ersten Wurf gezaehlt
    const cupKeys = turn.type === 'bomb' ? keys.filter(key => key !== 'cupIndex1') : keys;
    return { rackTeam: enemy, cups: cupKeys.map(key => data[key]).filter((cup): cup is number => typeof cup === 'number') };
};

// Reihenfolge der Trinker eines Teams: nach dem ersten eigenen Wurf, wer noch nicht geworfen hat, danach
const getDrinkOrder = (state: KnechtState, team: number) => {
    const order: number[] = [];
    state.turns.forEach(turn => {
        if (turn.teamIndex === team && !order.includes(turn.playerIndex)) order.push(turn.playerIndex);
    });
    for (let player = 0; player < state.config.playerCounts[team]; player++)
        if (!order.includes(player)) order.push(player);
    return order;
};

export const getCupOwners = (state: KnechtState): CupOwners => {
    const racks: CupOwners['racks'] = [new Map(), new Map()];
    const removals: CupRemoval[] = [];
    const orders = [getDrinkOrder(state, 0), getDrinkOrder(state, 1)];
    const drunk = [0, 0];

    state.turns.forEach((turn, turnIndex) => {
        const removed = cupsOfTurn(turn);
        if (!removed) return;
        removed.cups.forEach(cup => {
            const order = orders[removed.rackTeam];
            const removal: CupRemoval = {
                turnIndex,
                rackTeam: removed.rackTeam,
                cup,
                thrower: { teamIndex: turn.teamIndex, playerIndex: turn.playerIndex },
                drinker: order[drunk[removed.rackTeam]++ % order.length] ?? 0,
            };
            removals.push(removal);
        });
    });

    // Plaetze verteilen: zuerst bleibt jeder Treffer auf seinem Feld, solange es leer ist (bei mehreren Treffern auf
    // demselben Feld der neueste). Die uebrigen fuellen die freien Felder der Reihe nach, neueste zuerst.
    [0, 1].forEach(rackTeam => {
        const standing = new Set(getStandingCups(state.racks[rackTeam]));
        const empty = Array.from({ length: CUP_COUNT }, (_, cup) => cup).filter(cup => !standing.has(cup));
        const own = removals.filter(removal => removal.rackTeam === rackTeam).reverse();
        const placed = new Set<CupRemoval>();
        own.forEach(removal => {
            if (!standing.has(removal.cup) && !racks[rackTeam].has(removal.cup)) { racks[rackTeam].set(removal.cup, removal); placed.add(removal); }
        });
        const free = empty.filter(cup => !racks[rackTeam].has(cup));
        own.filter(removal => !placed.has(removal)).forEach(removal => {
            const cup = free.shift();
            if (cup !== undefined) racks[rackTeam].set(cup, removal);
        });
    });
    return { racks, removals };
};
