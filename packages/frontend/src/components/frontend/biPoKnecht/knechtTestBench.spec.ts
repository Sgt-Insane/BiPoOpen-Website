/**
 * Testbench fuer den BiPo Knecht: spielt alle (bzw. sehr viele) moeglichen Spiele gegen das Regelwerk
 * und prueft nach jeder Aktion die Invarianten. Aufruf nach jeder Aenderung am Knecht:
 *
 *   npm run test:knecht                       (im Ordner packages/frontend)
 *   KNECHT_DEPTH=6 KNECHT_GAMES=2000 npm run test:knecht   (gruendlicher)
 *   KNECHT_SIM_GAMES=10000 npm run test:knecht             (10.000 realistische Spielverlaeufe mit Bericht)
 *
 * Schreibt nie in die Datenbank: axios ist gemockt und jeder Aufruf laesst den Test scheitern.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
    applyAction, canReRack, createInitialState, getActionIndexOfTurn, getAllowedThrowers, getBombTargets, getHittableCups, getStandingCups,
    getTeamPoints, getPlayerPoints, previewHit, replay, CUP_COUNT, RE_RACKS_PER_TEAM,
    type KnechtAction, type KnechtConfig, type KnechtState,
} from './knechtEngine';

const networkCalls: string[] = [];
vi.mock('axios', () => {
    const record = (method: string) => (...args: unknown[]) => {
        networkCalls.push(`${method} ${String(args[0])}`);
        return Promise.reject(new Error('Testbench: keine Netzwerkzugriffe'));
    };
    const instance = { get: record('GET'), post: record('POST'), patch: record('PATCH'), put: record('PUT'), delete: record('DELETE'), defaults: {} };
    return { default: instance, ...instance };
});

const DEPTH = Number(process.env.KNECHT_DEPTH ?? 4);
const GAMES = Number(process.env.KNECHT_GAMES ?? 300);
const SIM_GAMES = Number(process.env.KNECHT_SIM_GAMES ?? 400);
const TIMEOUT = 10 * 60 * 1000;
const MAX_ACTIONS = 3000;

const CONFIGS: Record<string, KnechtConfig> = {
    '1v1': { playerCounts: [1, 1], startTeamIndex: 0 },
    '2v2': { playerCounts: [2, 2], startTeamIndex: 1 },
    '2v1': { playerCounts: [2, 1], startTeamIndex: 0 },
    '3v3': { playerCounts: [3, 3], startTeamIndex: 0 },
};

// ─── Zufall mit Seed, damit Fehler reproduzierbar sind ───
const createRandom = (seed: number) => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

// ─── Alle erlaubten Aktionen eines Spielstands ───
// limitCups: nur die ersten n Becher (plus Bombe / letzter Becher), damit die Suche endlich bleibt
const getLegalActions = (state: KnechtState, limitCups = Infinity, pickExtras: (candidates: number[], count: number) => number[] = (c, n) => c.slice(0, n)): KnechtAction[] => {
    if (state.status !== 'playing') return [];
    const actions: KnechtAction[] = [];
    const team = state.activeTeamIndex;
    const hittable = getHittableCups(state);
    const standing = getStandingCups(state.racks[1 - team]);
    const special = hittable.filter(cup => !standing.includes(cup));
    const cups = [...new Set([...standing.slice(0, limitCups), ...special])];

    getAllowedThrowers(state).forEach(player => {
        actions.push({ type: 'throw', player, outcome: 'miss', time: 0 });
        actions.push({ type: 'throw', player, outcome: 'airball', time: 0 });
        cups.forEach(cup => [false, true].forEach(bouncer => {
            const preview = previewHit(state, cup, bouncer, player);
            if (bouncer && preview.type !== 'bouncer' && preview.extrasNeeded === 0 && !['ballsback', 'onfire'].includes(preview.type)) return;
            actions.push({ type: 'throw', player, outcome: 'hit', cup, bouncer, extraCups: pickExtras(preview.extraCandidates, preview.extrasNeeded), time: 0 });
        }));
        for (let catcher = 0; catcher < state.config.playerCounts[team]; catcher++)
            actions.push({ type: 'trickshot', player, catcher, time: 0 });
        actions.push({ type: 'deathcup', player, time: 0 });
    });

    if (canReRack(state)) actions.push({ type: 'reRack', time: 0 });

    [0, 1].forEach(ownTeam => {
        const ownStanding = getStandingCups(state.racks[ownTeam]);
        if (ownStanding.length) actions.push({ type: 'ownCup', team: ownTeam, player: 0, cups: [ownStanding[0]], time: 0 });
    });
    return actions;
};

// ─── Invarianten ───
const cupsOfTurn = (turn: Turn): number => {
    const data = turn.data as Record<string, unknown>;
    if (turn.type === 'deathcup' || turn.type === 'owncup') return (data.cups as number[]).length;
    if (turn.type === 'lastCup' && data.double) return 0;
    const keys = turn.type === 'bomb' ? ['cupIndex2', 'cupIndex3', 'cupIndex4'] : ['cupIndex', 'cupIndex1', 'cupIndex2', 'cupIndex3'];
    return keys.filter(key => typeof data[key] === 'number').length;
};

const checkInvariants = (state: KnechtState, previous: KnechtState | null, action: KnechtAction | null) => {
    const context = () => JSON.stringify({ action, turns: state.turns.slice(-6).map(t => `${t.teamIndex}.${t.playerIndex}:${t.type}`) });

    // 1. Becher: getrunken, getroffen und stehend ergeben immer genau 10
    state.racks.forEach(rack => {
        const all = [...rack.hit, ...rack.pending];
        expect(new Set(all).size, `doppelte Becher ${context()}`).toBe(all.length);
        expect(all.every(cup => cup >= 0 && cup < CUP_COUNT), context()).toBe(true);
        expect(all.length + getStandingCups(rack).length, context()).toBe(CUP_COUNT);
    });

    // 2. Punkte = genommene Becher (+ Siegpunkt), je Team
    const cupsPerTeam = [0, 0];
    state.turns.forEach(turn => {
        const owner = turn.type === 'owncup' ? 1 - turn.teamIndex : turn.teamIndex;
        cupsPerTeam[owner] += cupsOfTurn(turn);
    });
    const points = getTeamPoints(state);
    [0, 1].forEach(team => {
        const bonus = state.winnerTeamIndex === team ? state.victoryBonus : 0;
        expect(points[team], `Punkte Team ${team} ${context()}`).toBeCloseTo(cupsPerTeam[team] + bonus, 6);
    });
    expect(getPlayerPoints(state).flat().every(value => value >= 0), context()).toBe(true);

    // 3. Ende: immer ein Sieger, der mehr Punkte hat
    if (state.status === 'over') {
        expect(state.winnerTeamIndex === 0 || state.winnerTeamIndex === 1, context()).toBe(true);
        expect(points[state.winnerTeamIndex!], `Sieger vorne ${context()}`).toBeGreaterThan(points[1 - state.winnerTeamIndex!]);
        expect(state.racks.every(rack => rack.pending.length === 0), context()).toBe(true);
    } else {
        // 4. Kein Stillstand: es gibt immer jemanden, der werfen darf
        expect(getAllowedThrowers(state).length, `niemand darf werfen ${context()}`).toBeGreaterThan(0);
        // 5. Getroffene Becher dieser Runde liegen nur beim Gegner des werfenden Teams
        expect(state.racks[state.activeTeamIndex].pending, context()).toEqual([]);
    }

    // 6. Kein On Fire im Einzel
    state.turns.forEach(turn => {
        if (turn.type === 'onfire') expect(state.config.playerCounts[turn.teamIndex], context()).toBeGreaterThan(1);
    });

    // 7. Re-Racks hoechstens zweimal pro Team, in der Verlaengerung keine
    state.reRacksLeft.forEach(left => expect(left >= 0 && left <= RE_RACKS_PER_TEAM, context()).toBe(true));
    if (state.overtimeCount > 0) expect(state.reRacksLeft, `Re-Rack in der Verlaengerung ${context()}`).toEqual([0, 0]);

    if (state.status === 'playing') {
        // 10. Ein einzelner Becher steht vor dem ersten Wurf an der Spitze
        const target = state.racks[1 - state.activeTeamIndex];
        if (state.round.throwCount === 0 && target.pending.length === 0 && getStandingCups(target).length === 1)
            expect(getStandingCups(target), `letzter Becher nicht an der Spitze ${context()}`).toEqual([0]);
        // 11. Nach dem letzten Becher endet der Ball: den Doppeltreffer wirft ein anderer Ball
        const newest = state.turns.at(-1);
        if (previous && newest && state.turns.length > previous.turns.length && newest.type === 'lastCup' && !(newest.data as { double?: boolean }).double)
            expect(state.round.current, `Ball laeuft nach letztem Becher weiter ${context()}`).toBeNull();
    }

    if (!previous || !action) return;

    // 12. Serien enden mit dem Teamwechsel und mit der Verlaengerung
    if (state.status === 'playing' && (state.activeTeamIndex !== previous.activeTeamIndex || state.overtimeCount !== previous.overtimeCount))
        expect(state.streaks.flat().every(streak => streak === 0), `Serie nicht zurueckgesetzt ${context()}`).toBe(true);

    // 13. Die Verlaengerung beginnt das Team, das vorgelegt hat
    if (state.overtimeCount > previous.overtimeCount && previous.nachwurfTeamIndex !== null)
        expect(state.activeTeamIndex, `falsches Startteam der Verlaengerung ${context()}`).toBe(1 - previous.nachwurfTeamIndex);

    // 8. Zusatzbecher nehmen nie den letzten Becher: ein Rack wird nur durch letzten Becher, Deathcup oder eigene Becher leer
    const lastTurn = state.turns.at(-1);
    [0, 1].forEach(team => {
        const before = getStandingCups(previous.racks[team]).length;
        const after = getStandingCups(state.racks[team]).length;
        if (before > 0 && after === 0 && state.overtimeCount === previous.overtimeCount)
            expect(['lastCup', 'deathcup', 'owncup'], `Rack ohne letzten Becher geleert ${context()}`).toContain(lastTurn?.type);
    });

    // 9. Turns kommen nur dazu, nie weg
    expect(state.turns.length, context()).toBeGreaterThanOrEqual(previous.turns.length);
};

// Rueckgaengig = letzte Aktion weglassen: muss exakt den vorherigen Stand ergeben
const checkReplay = (config: KnechtConfig, actions: KnechtAction[], state: KnechtState) => {
    const result = replay(config, actions);
    expect(result.error).toBeNull();
    expect(JSON.stringify(result.state)).toBe(JSON.stringify(state));
};

// ─── Erschoepfende Suche ───
// Gleiche Spielstaende (z.B. Nullwurf vs. Airball) werden nur einmal weiter verfolgt.
const stateKey = (state: KnechtState) => JSON.stringify([
    state.racks, state.activeTeamIndex, state.round, state.nachwurfTeamIndex, state.cleared, state.decider,
    state.reRacksLeft, state.overtimeCount, state.streaks, state.status, state.winnerTeamIndex, getPlayerPoints(state),
]);

const explore = (state: KnechtState, depth: number, counter: { nodes: number; ended: number }, seen = new Map<string, number>()) => {
    if (depth === 0 || state.status !== 'playing') {
        if (state.status === 'over') counter.ended++;
        return;
    }
    const key = stateKey(state);
    if ((seen.get(key) ?? -1) >= depth) return;
    seen.set(key, depth);

    getLegalActions(state, 2).forEach(action => {
        const next = applyAction(state, action);
        counter.nodes++;
        checkInvariants(next, state, action);
        explore(next, depth - 1, counter, seen);
    });
};

// Endspiel-Startpunkte: ein Team kurz vor dem letzten Becher, Nachwurf, Verlaengerung
const playUntil = (config: KnechtConfig, seed: number, stop: (state: KnechtState) => boolean) => {
    const random = createRandom(seed);
    let state = createInitialState(config);
    const actions: KnechtAction[] = [];
    while (state.status === 'playing' && !stop(state) && actions.length < MAX_ACTIONS) {
        const legal = getLegalActions(state).filter(action => action.type === 'throw');
        const hits = legal.filter(action => action.type === 'throw' && action.outcome === 'hit' && !action.bouncer);
        const pool = random() < 0.75 && hits.length ? hits : legal;
        const action = pool[Math.floor(random() * pool.length)];
        state = applyAction(state, action);
        actions.push(action);
    }
    return state;
};

// ─── Zufallsspiele ───
const randomAction = (state: KnechtState, random: () => number): KnechtAction => {
    const pickExtras = (candidates: number[], count: number) => {
        const pool = [...candidates];
        return Array.from({ length: count }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]);
    };
    const legal = getLegalActions(state, Infinity, pickExtras);
    const byKind = (predicate: (action: KnechtAction) => boolean) => legal.filter(predicate);
    const roll = random();
    const choose = (pool: KnechtAction[]) => pool.length ? pool[Math.floor(random() * pool.length)] : null;

    return (roll < 0.002 && choose(byKind(a => a.type === 'deathcup')))
        || (roll < 0.01 && choose(byKind(a => a.type === 'ownCup')))
        || (roll < 0.04 && choose(byKind(a => a.type === 'trickshot')))
        || (roll < 0.30 && choose(byKind(a => a.type === 'reRack')))
        || (roll < 0.36 && choose(byKind(a => a.type === 'throw' && a.outcome === 'airball')))
        || (roll < 0.70 && choose(byKind(a => a.type === 'throw' && a.outcome === 'miss')))
        || (roll < 0.80 && choose(byKind(a => a.type === 'throw' && a.outcome === 'hit' && !!a.bouncer)))
        || choose(byKind(a => a.type === 'throw' && a.outcome === 'hit'))
        || choose(byKind(a => a.type === 'throw'))!;
};

describe('BiPo Knecht Testbench', () => {
    beforeAll(() => { networkCalls.length = 0; });
    afterAll(() => { expect(networkCalls, 'Die Testbench darf nichts speichern').toEqual([]); });

    Object.entries(CONFIGS).forEach(([name, config]) => {
        it(`${name}: alle Aktionsfolgen bis Tiefe ${DEPTH} ab Spielbeginn`, () => {
            const counter = { nodes: 0, ended: 0 };
            explore(createInitialState(config), DEPTH, counter);
            expect(counter.nodes).toBeGreaterThan(0);
        }, TIMEOUT);

        it(`${name}: alle Aktionsfolgen in Endspielen (letzter Becher, Nachwurf, Verlaengerung)`, () => {
            const starts: KnechtState[] = [];
            for (let seed = 1; seed <= 30 && starts.length < 12; seed++) {
                const nearEnd = playUntil(config, seed, state => getStandingCups(state.racks[1 - state.activeTeamIndex]).length <= 2 && state.round.throwCount === 0);
                if (nearEnd.status === 'playing') starts.push(nearEnd);
                const nachwurf = playUntil(config, seed * 7, state => state.nachwurfTeamIndex !== null);
                if (nachwurf.status === 'playing') starts.push(nachwurf);
                const overtime = playUntil(config, seed * 13, state => state.overtimeCount > 0);
                if (overtime.status === 'playing') starts.push(overtime);
            }
            expect(starts.length).toBeGreaterThan(0);
            starts.forEach(start => explore(start, Math.max(3, DEPTH - 1), { nodes: 0, ended: 0 }));
        }, TIMEOUT);

        it(`${name}: ${GAMES} zufaellige Spiele bis zum Ende`, () => {
            const reasons = new Map<string, number>();
            for (let game = 0; game < GAMES; game++) {
                const random = createRandom(game + 1);
                const actions: KnechtAction[] = [];
                let state = createInitialState({ ...config, startTeamIndex: game % 2 });
                const startConfig = state.config;

                while (state.status === 'playing') {
                    expect(actions.length, `Spiel ${game} endet nicht`).toBeLessThan(MAX_ACTIONS);
                    const action = randomAction(state, random);
                    const next = applyAction(state, action);
                    checkInvariants(next, state, action);
                    actions.push(action);
                    state = next;
                }
                reasons.set(state.endReason!, (reasons.get(state.endReason!) ?? 0) + 1);

                // Nachspielen ergibt denselben Stand, Rueckgaengig ist exakt
                checkReplay(startConfig, actions, state);
                if (game % 10 === 0)
                    checkReplay(startConfig, actions.slice(0, -1), replay(startConfig, actions.slice(0, -1)).state);
            }
            // Jedes Spielende kommt in den Zufallsspielen vor
            expect([...reasons.keys()]).toEqual(expect.arrayContaining(['cleared', 'doubleLastCup']));
        }, TIMEOUT);
    });

    it('ungueltige Aktionen werden abgelehnt und veraendern nichts', () => {
        const config = CONFIGS['2v2'];
        const state = createInitialState(config);
        const invalid: KnechtAction[] = [
            { type: 'throw', player: 5, outcome: 'miss', time: 0 },
            { type: 'throw', player: 0, outcome: 'hit', time: 0 },
            { type: 'throw', player: 0, outcome: 'hit', cup: 12, time: 0 },
            { type: 'throw', player: 0, outcome: 'miss', cup: 3, time: 0 },
            { type: 'throw', player: 0, outcome: 'hit', cup: 3, bouncer: true, extraCups: [3], time: 0 },
            { type: 'throw', player: 0, outcome: 'hit', cup: 3, extraCups: [4], time: 0 },
            { type: 'reRack', time: 0 },
            { type: 'ownCup', team: 0, player: 0, cups: [], time: 0 },
            { type: 'trickshot', player: 0, catcher: 9, time: 0 },
        ];
        invalid.forEach(action => {
            expect(() => applyAction(state, action)).toThrow();
            expect(replay(config, [action]).error?.index).toBe(0);
        });
        expect(state.turns).toEqual([]);
    });

    it('ein fertiges Spiel wird korrekt fuer die Datenbank aufbereitet, ohne zu speichern', async () => {
        const { buildKnechtMatch, saveKnechtGame } = await import('./KnechtUtilFunctions');
        const config = CONFIGS['2v2'];
        const random = createRandom(42);
        let state = createInitialState(config);
        while (state.status === 'playing') state = applyAction(state, randomAction(state, random));

        const team = (name: string): Team => ({ _id: 'placeholder', name, players: [{ _id: 'p', name: `${name} A`, score: 0 }, { _id: 'p', name: `${name} B`, score: 0 }] });
        const match = buildKnechtMatch({ _id: 'placeholder', team1: team('Rot'), team2: team('Blau'), time: 1, season: '2025-26', league: 1 }, state, '  Schiri  ');
        const sums = [match.team1, match.team2].map(t => t.players.reduce((sum, player) => sum + player.score, 0));
        expect(sums[state.winnerTeamIndex!]).toBeGreaterThan(sums[1 - state.winnerTeamIndex!]);
        expect(match.referee).toBe('Schiri');
        expect(match.turns).toHaveLength(state.turns.length);

        expect(await saveKnechtGame(match)).toBe(true);     // Demo/DEV: nur lokal, nie in die Datenbank
        expect(networkCalls).toEqual([]);
        const { clearDemoGames, getDemoGames } = await import('@/util/demoGames');
        expect(getDemoGames('league')).toHaveLength(1);
        clearDemoGames();
    });
});

// ─── Simulation: realistische Spielverlaeufe ───
// Jeder Spieler bekommt ein Profil (Trefferquote, Bouncer, Airball, Trickshot ...), jedes 5. Spiel ist ein
// "Chaos"-Spiel mit vielen Sonderaktionen. Alle Besetzungen bis 4 gegen 4, Startteam zufaellig.
const SIM_LINEUPS: [number, number][] = [[1, 1], [2, 2], [2, 1], [1, 2], [3, 3], [3, 2], [2, 3], [4, 4]];

type SimProfile = { hit: number; bouncer: number; airball: number; trick: number; deathcup: number; ownCup: number; reRack: number };

const makeProfile = (random: () => number, chaos: boolean): SimProfile => ({
    hit: 0.1 + random() * 0.55,
    bouncer: random() * 0.08,
    airball: random() * 0.06,
    trick: chaos ? random() * 0.08 : random() * 0.015,
    deathcup: chaos ? 0.004 : 0.0008,
    ownCup: chaos ? 0.02 : 0.003,
    reRack: random(),
});

const pickRandom = (random: () => number, candidates: number[], count: number) => {
    const pool = [...candidates];
    return Array.from({ length: count }, () => pool.splice(Math.floor(random() * pool.length), 1)[0]);
};

const simAction = (state: KnechtState, random: () => number, profiles: SimProfile[][]): KnechtAction => {
    const team = state.activeTeamIndex;
    if (canReRack(state) && random() < profiles[team][0].reRack * 0.6) return { type: 'reRack', time: 0 };

    if (random() < profiles[team][0].ownCup) {
        const ownTeam = random() < 0.5 ? 0 : 1;
        const standing = getStandingCups(state.racks[ownTeam]);
        const player = Math.floor(random() * state.config.playerCounts[ownTeam]);
        if (standing.length) return { type: 'ownCup', team: ownTeam, player, cups: pickRandom(random, standing, Math.min(random() < 0.2 ? 2 : 1, standing.length)), time: 0 };
    }

    const allowed = getAllowedThrowers(state);
    const player = allowed[Math.floor(random() * allowed.length)];
    const profile = profiles[team][player];
    const roll = random();
    if (roll < profile.deathcup) return { type: 'deathcup', player, time: 0 };
    if (roll < profile.deathcup + profile.trick)
        return { type: 'trickshot', player, catcher: Math.floor(random() * state.config.playerCounts[team]), time: 0 };
    if (roll < profile.deathcup + profile.trick + profile.airball) return { type: 'throw', player, outcome: 'airball', time: 0 };

    const hittable = getHittableCups(state);
    if (random() < profile.hit && hittable.length) {
        const bombs = getBombTargets(state);
        const cup = bombs.length && random() < 0.08 ? bombs[0] : hittable[Math.floor(random() * hittable.length)];
        const bouncer = random() < profile.bouncer / profile.hit;
        const preview = previewHit(state, cup, bouncer, player);
        return { type: 'throw', player, outcome: 'hit', cup, bouncer, extraCups: pickRandom(random, preview.extraCandidates, preview.extrasNeeded), time: 0 };
    }
    return { type: 'throw', player, outcome: 'miss', time: 0 };
};

describe('BiPo Knecht Simulation', () => {
    type BuildMatch = typeof import('./KnechtUtilFunctions')['buildKnechtMatch'];
    let buildKnechtMatch: BuildMatch;
    beforeAll(async () => {
        networkCalls.length = 0;
        ({ buildKnechtMatch } = await import('./KnechtUtilFunctions'));
    });
    afterAll(() => { expect(networkCalls, 'Die Testbench darf nichts speichern').toEqual([]); });

    const placeholderMatch = (config: KnechtConfig): Match => {
        const team = (name: string, count: number): Team => ({
            _id: 'placeholder', name, players: Array.from({ length: count }, (_, index) => ({ _id: 'p', name: `${name} ${index + 1}`, score: 0 })),
        });
        return { _id: 'placeholder', team1: team('Rot', config.playerCounts[0]), team2: team('Blau', config.playerCounts[1]), time: 1 };
    };

    // Fertiges Spiel fuer die Datenbank: ganze Treffer, Teamsumme unveraendert, Sieger vorne
    const checkMatch = (config: KnechtConfig, state: KnechtState) => {
        const match = buildKnechtMatch(placeholderMatch(config), state);
        const sums = [match.team1, match.team2].map(team => team.players.reduce((sum, player) => sum + player.score, 0));
        const teamPoints = getTeamPoints(state);
        [match.team1, match.team2].forEach(team => team.players.forEach(player => expect(Number.isInteger(player.score), 'ganze Treffer').toBe(true)));
        expect(sums[0]).toBeCloseTo(teamPoints[0], 6);
        expect(sums[1]).toBeCloseTo(teamPoints[1], 6);
        expect(sums[state.winnerTeamIndex!]).toBeGreaterThan(sums[1 - state.winnerTeamIndex!]);
        expect(match.turns).toHaveLength(state.turns.length);
    };

    it(`${SIM_GAMES} Spielverlaeufe mit Spielerprofilen in allen Besetzungen`, () => {
        const count = <K,>(map: Map<K, number>, key: K) => map.set(key, (map.get(key) ?? 0) + 1);
        const reasons = new Map<string, number>();
        const turnTypes = new Map<string, number>();
        const overtimes = new Map<number, number>();
        const turnCounts: number[] = [];
        let startTeamWins = 0;
        let nachwurfBombs = 0;

        for (let game = 0; game < SIM_GAMES; game++) {
            const random = createRandom(1000 + game);
            const lineup = SIM_LINEUPS[game % SIM_LINEUPS.length];
            const config: KnechtConfig = { playerCounts: lineup, startTeamIndex: Math.floor(random() * 2) };
            const profiles = lineup.map(players => Array.from({ length: players }, () => makeProfile(random, game % 5 === 0)));
            const actions: KnechtAction[] = [];
            let state = createInitialState(config);

            while (state.status === 'playing') {
                expect(actions.length, `Spiel ${game} endet nicht`).toBeLessThan(MAX_ACTIONS);
                const action = simAction(state, random, profiles);
                const next = applyAction(state, action);
                checkInvariants(next, state, action);
                if (next.turns.length > state.turns.length) {
                    const turn = next.turns.at(-1)!;
                    count(turnTypes, turn.type);
                    if (turn.type === 'bomb' && state.nachwurfTeamIndex !== null) nachwurfBombs++;
                }
                actions.push(action);
                state = next;
            }

            count(reasons, state.endReason!);
            count(overtimes, state.overtimeCount);
            turnCounts.push(state.turns.length);
            if (state.winnerTeamIndex === config.startTeamIndex) startTeamWins++;

            checkReplay(config, actions, state);
            checkMatch(config, state);
            if (game % 20 === 0) {
                for (let cut = 1; cut < actions.length; cut += Math.max(1, Math.floor(actions.length / 10)))
                    expect(replay(config, actions.slice(0, cut)).error).toBeNull();
                state.turns.forEach((_, turnIndex) => {
                    const index = getActionIndexOfTurn(actions, turnIndex);
                    expect(index).toBeGreaterThanOrEqual(0);
                    expect(actions[index].type).not.toBe('reRack');
                });
            }
        }

        turnCounts.sort((a, b) => a - b);
        const quantile = (q: number) => turnCounts[Math.floor(q * (turnCounts.length - 1))];
        console.log(`Knecht-Simulation (${SIM_GAMES} Spiele)\n${JSON.stringify({
            endgruende: Object.fromEntries(reasons),
            startteamSiegquote: Math.round(startTeamWins / SIM_GAMES * 1000) / 1000,
            turnsProSpiel: { p50: quantile(0.5), p90: quantile(0.9), max: quantile(1) },
            verlaengerungen: Object.fromEntries(overtimes),
            bombenImNachwurf: nachwurfBombs,
            turnTypen: Object.fromEntries(turnTypes),
        }, null, 2)}`);

        expect([...reasons.keys()]).toEqual(expect.arrayContaining(['cleared', 'doubleLastCup', 'nachwurfDouble', 'deathcup']));
        expect(turnTypes.get('bomb') ?? 0).toBeGreaterThan(0);
        expect([...overtimes.keys()].some(overtime => overtime > 0)).toBe(true);
    }, TIMEOUT);

    it('spielt auch ein langes Spiel schnell nach (Rueckgaengig, Bearbeiten, Fortsetzen)', () => {
        // Schwache Werfer, viele Runden
        const random = createRandom(7);
        const config: KnechtConfig = { playerCounts: [2, 2], startTeamIndex: 0 };
        const profiles = [0, 1].map(() => [0, 1].map(() => ({ ...makeProfile(random, false), hit: 0.12, ownCup: 0, deathcup: 0 })));
        const actions: KnechtAction[] = [];
        let state = createInitialState(config);
        while (state.status === 'playing' && actions.length < 600) {
            const action = simAction(state, random, profiles);
            state = applyAction(state, action);
            actions.push(action);
        }
        expect(state.turns.length).toBeGreaterThan(150);

        replay(config, actions);
        const started = performance.now();
        const result = replay(config, actions);
        const elapsed = performance.now() - started;
        console.log(`Replay von ${actions.length} Aktionen: ${elapsed.toFixed(1)} ms`);
        expect(JSON.stringify(result.state)).toBe(JSON.stringify(state));
        expect(elapsed).toBeLessThan(100);
    });
});
