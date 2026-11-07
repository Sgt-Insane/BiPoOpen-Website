// Regelwerk des BiPo Knecht als reine Funktionen, ohne Vue und ohne DOM.
// Der Spielstand entsteht immer durch Nachspielen der Aktionen (replay). Dadurch sind
// Rueckgaengig, das nachtraegliche Bearbeiten einzelner Wuerfe und der Testbench trivial.
//
// Becher eines Racks: Index 0..9 im Dreieck, Reihe 1 = 0, Reihe 2 = 1-2, Reihe 3 = 3-5, Reihe 4 = 6-9.
// Ein Becher ist entweder stehend, in dieser Runde getroffen (pending) oder getrunken (hit).
// Jeder genommene Becher bringt genau einem Team einen Punkt (Punkte = Becher), damit
// der Sieger auch in allen Statistiken der Seite (Summe der Spielerpunkte) vorne liegt.

export const CUP_COUNT = 10;
export const BALLS_PER_ROUND = 2;
export const RE_RACKS_PER_TEAM = 2;
export const BOMB_CUPS = 3;

// Neue Formation nach einem Re-Rack (stehende Becher), immer mittig an der Pyramidenspitze
export const RE_RACK_FORMATIONS: Record<number, number[]> = {
    6: [0, 1, 2, 3, 4, 5],
    4: [0, 1, 2, 4],
    3: [0, 1, 2],
};
export const OVERTIME_FORMATION = [0, 1, 2];

// ─── Typen ───
export type KnechtConfig = {
    playerCounts: [number, number];
    startTeamIndex: number;
};

export type ThrowOutcome = 'hit' | 'miss' | 'airball';

export type KnechtAction =
    | { type: 'throw'; player: number; outcome: ThrowOutcome; cup?: number; bouncer?: boolean; extraCups?: number[]; time: number }
    | { type: 'trickshot'; player: number; catcher: number; time: number }   // player hat verfehlt, catcher wirft den Trickshot
    | { type: 'reRack'; time: number }
    | { type: 'deathcup'; player: number; time: number }
    | { type: 'ownCup'; team: number; player: number; cups: number[]; time: number };

export type Rack = { hit: number[]; pending: number[] };

export type Credit = { teamIndex: number; playerIndex: number; points: number };

export type KnechtMarker = {
    kind: 'reRack' | 'nachwurf' | 'overtime';
    teamIndex: number;
    afterTurnIndex: number;     // Marker steht zwischen Turn afterTurnIndex-1 und afterTurnIndex
    time: number;
};

export type BannerEvent = 'heating-up' | 'on-fire' | 'bomb' | 'ballsback' | 'nachwurf' | 'overtime' | 'deathcup' | 'win' | null;

export type EndReason = 'cleared' | 'doubleLastCup' | 'nachwurfDouble' | 'deathcup';

type Landing = { cup: number; extras: number[]; turnIndex: number; ball: number; bouncer: boolean };

type Ball = {
    owner: number;                  // wem der Ball gehoert (fuer die freie Wurfreihenfolge)
    resolved: boolean;              // erster echter Wurf (Treffer/Fehlwurf) ist gefallen
    lockedPlayer: number | null;    // On Fire / Trickshot / Nachwurf: wer als naechstes werfen muss
};

type Round = {
    ballsDone: number;
    owners: number[];               // Besitzer je Ball dieser Runde
    current: Ball | null;           // null = der naechste Wurf eroeffnet einen neuen Ball
    ballHits: boolean[];            // Ergebnis je Ball (fuer Balls Back)
    landings: Landing[];
    ballsBack: boolean;             // Runde entstand durch Balls Back (kein Re-Rack)
    throwCount: number;
};

export type KnechtState = {
    config: KnechtConfig;
    racks: [Rack, Rack];
    turns: Turn[];
    credits: Credit[][];            // je Turn: wer wie viele Punkte bekommt
    markers: KnechtMarker[];
    activeTeamIndex: number;
    round: Round;
    nachwurfTeamIndex: number | null;           // Gentleman's Rule laeuft fuer dieses Team
    cleared: [boolean, boolean];                // Team hat in dieser Phase alle Gegnerbecher getroffen
    decider: { teamIndex: number; cup: number } | null;    // letzter Becher getroffen, weitere Baelle dieser Runde nur noch darauf
    reRacksLeft: [number, number];
    overtimeCount: number;
    streaks: number[][];
    status: 'playing' | 'over';
    winnerTeamIndex: number | null;
    endReason: EndReason | null;
    victoryBonus: number;                       // Siegpunkt(e) bei sonst punktgleichem Ende
    banner: BannerEvent;
};

export class KnechtRuleError extends Error {}

// ─── Hilfsfunktionen ───
export const cupIndexOf = (row: number, position: number) => ((row - 1) * row) / 2 + (position - 1);

export const CUP_ROWS = [1, 2, 3, 4].map(row => Array.from({ length: row }, (_, i) => cupIndexOf(row, i + 1)));

export const isHitTurnType = (type: Turn['type']) =>
    type === 'hit' || type === 'bouncer' || type === 'bomb' || type === 'ballsback' || type === 'lastCup' || type === 'onfire';

// On Fire / Heating Up nur, wenn ein Team mehr als einen Spieler hat (nicht im 1 gegen 1 / Liga)
export const isOnFireEnabled = (state: KnechtState, teamIndex: number) => state.config.playerCounts[teamIndex] > 1;

export const getStandingCups = (rack: Rack) => {
    const taken = new Set([...rack.hit, ...rack.pending]);
    return Array.from({ length: CUP_COUNT }, (_, i) => i).filter(cup => !taken.has(cup));
};

const sorted = (cups: number[]) => [...cups].sort((a, b) => a - b);

const rackFromStanding = (standing: number[]): Rack => ({
    hit: Array.from({ length: CUP_COUNT }, (_, i) => i).filter(cup => !standing.includes(cup)),
    pending: [],
});

const enemyOf = (teamIndex: number) => 1 - teamIndex;

const newRound = (ballsBack = false): Round => ({
    ballsDone: 0, owners: [], current: null, ballHits: [], landings: [], ballsBack, throwCount: 0,
});

export const createInitialState = (config: KnechtConfig): KnechtState => ({
    config,
    racks: [{ hit: [], pending: [] }, { hit: [], pending: [] }],
    turns: [],
    credits: [],
    markers: [],
    activeTeamIndex: config.startTeamIndex,
    round: newRound(),
    nachwurfTeamIndex: null,
    cleared: [false, false],
    decider: null,
    reRacksLeft: [RE_RACKS_PER_TEAM, RE_RACKS_PER_TEAM],
    overtimeCount: 0,
    streaks: config.playerCounts.map(count => Array.from({ length: count }, () => 0)),
    status: 'playing',
    winnerTeamIndex: null,
    endReason: null,
    victoryBonus: 0,
    banner: null,
});

export const cloneState = (state: KnechtState): KnechtState => structuredClone(state);

// ─── Abfragen fuer die Oberflaeche ───
export const getTargetRack = (state: KnechtState) => state.racks[enemyOf(state.activeTeamIndex)];

// Wer darf den naechsten Wurf machen? Freie Reihenfolge: jeder, der in dieser Runde noch keinen Ball hatte.
export const getAllowedThrowers = (state: KnechtState): number[] => {
    if (state.status !== 'playing') return [];
    const { round } = state;
    if (round.current?.lockedPlayer !== null && round.current?.lockedPlayer !== undefined)
        return [round.current.lockedPlayer];
    if (round.current)
        return [round.current.owner];

    const playerCount = state.config.playerCounts[state.activeTeamIndex];
    const all = Array.from({ length: playerCount }, (_, i) => i);
    if (playerCount === 1) return all;
    const free = all.filter(player => !round.owners.includes(player));
    return free.length > 0 ? free : all;
};

// Spieler, die in dieser Runde schon geworfen haben (fuer das Ausgrauen)
export const getPlayersDone = (state: KnechtState): number[] =>
    state.config.playerCounts[state.activeTeamIndex] > 1
        ? state.round.owners.filter(owner => owner !== state.round.current?.owner)
        : [];

const isSecondBallFirstThrow = (state: KnechtState) =>
    state.round.ballsDone === 1 && (!state.round.current || !state.round.current.resolved);

// Bombe: der zweite Ball landet im Becher, in dem schon der erste Ball dieser Runde liegt (auch im Nachwurf)
export const getBombTargets = (state: KnechtState): number[] => {
    if (!isSecondBallFirstThrow(state) || state.decider) return [];
    const pending = new Set(getTargetRack(state).pending);
    return state.round.landings.filter(landing => landing.ball === 0 && pending.has(landing.cup)).map(landing => landing.cup);
};

// Becher, die bei einem Treffer angetippt werden duerfen
export const getHittableCups = (state: KnechtState): number[] => {
    if (state.status !== 'playing') return [];
    if (state.decider?.teamIndex === state.activeTeamIndex) return [state.decider.cup];
    return sorted([...getStandingCups(getTargetRack(state)), ...getBombTargets(state)]);
};

export type HitPreview = {
    type: Turn['type'];
    extrasNeeded: number;
    extraCandidates: number[];
};

// Was ein Treffer auf diesen Becher waere und wie viele Zusatzbecher der Werfer noch waehlen muss.
// Zusatzbecher nehmen nie den letzten Becher: der muss einzeln getroffen werden.
export const previewHit = (state: KnechtState, cup: number, bouncer = false, player = getAllowedThrowers(state)[0]): HitPreview => {
    const rack = getTargetRack(state);
    const standing = getStandingCups(rack);

    if (state.decider?.teamIndex === state.activeTeamIndex && cup === state.decider.cup)
        return { type: 'lastCup', extrasNeeded: 0, extraCandidates: [] };

    if (getBombTargets(state).includes(cup)) {
        const partner = state.round.landings.find(landing => landing.ball === 0 && landing.cup === cup)!;
        const alreadyTaken = 1 + partner.extras.length;
        // Jeder Bouncer der beiden Baelle bringt einen Becher extra (Bombe mit Bouncer = 4 Becher)
        const wanted = BOMB_CUPS + (partner.bouncer ? 1 : 0) + (bouncer ? 1 : 0);
        const extrasNeeded = Math.min(Math.max(0, wanted - alreadyTaken), Math.max(0, standing.length - 1));
        return { type: 'bomb', extrasNeeded, extraCandidates: standing };
    }

    const standingAfter = standing.filter(other => other !== cup);
    if (standingAfter.length === 0)
        return { type: 'lastCup', extrasNeeded: 0, extraCandidates: [] };

    const extrasNeeded = bouncer ? Math.min(1, standingAfter.length - 1) : 0;
    return { type: getHitType(state, bouncer, player), extrasNeeded, extraCandidates: standingAfter };
};

// Beschriftung eines normalen Treffers (ohne letzten Becher und ohne Bombe)
const getHitType = (state: KnechtState, bouncer: boolean, player: number): Turn['type'] => {
    if (state.nachwurfTeamIndex === null) {
        if (isSecondBallFirstThrow(state) && state.round.ballHits[0]) return 'ballsback';
        if (isOnFireEnabled(state, state.activeTeamIndex) && (state.streaks[state.activeTeamIndex][player] ?? 0) >= 2) return 'onfire';
    }
    return bouncer ? 'bouncer' : 'hit';
};

export const canReRack = (state: KnechtState): boolean => {
    if (state.status !== 'playing' || state.round.throwCount > 0 || state.round.ballsBack) return false;
    if (state.reRacksLeft[state.activeTeamIndex] <= 0) return false;
    const standing = getStandingCups(getTargetRack(state));
    const formation = RE_RACK_FORMATIONS[standing.length];
    if (!formation) return false;
    return formation.join() !== standing.join();
};

export const getBallNumber = (state: KnechtState) => Math.min(state.round.ballsDone + 1, BALLS_PER_ROUND);

// ─── Punkte ───
export const getPlayerPoints = (state: KnechtState): number[][] => {
    const points = state.config.playerCounts.map(count => Array.from({ length: count }, () => 0));
    state.credits.forEach(credits => credits.forEach(credit => { points[credit.teamIndex][credit.playerIndex] += credit.points; }));
    return points.map(team => team.map(value => Math.round(value * 1000) / 1000));
};

// Ganze Zahlen mit gleicher Summe: jeder bekommt den abgerundeten Wert, die fehlenden Punkte
// gehen an die groessten Reste (bei Gleichstand an den mit mehr Punkten, dann den vorderen Spieler).
const roundKeepingSum = (values: number[]): number[] => {
    const total = Math.round(values.reduce((sum, value) => sum + value, 0));
    const result = values.map(value => Math.floor(value + 1e-9));
    const order = values
        .map((value, index) => ({ index, rest: value - result[index], value }))
        .sort((a, b) => b.rest - a.rest || b.value - a.value || a.index - b.index);
    const missing = total - result.reduce((sum, value) => sum + value, 0);
    for (let step = 0; step < missing; step++) result[order[step % order.length].index]++;
    return result;
};

// Die Seite kennt nur ganze Treffer: am Spielende werden Bruchteile (Bombe, eigene Becher)
// je Team ganzzahlig verteilt, die Teamsumme und damit der Sieger bleiben unveraendert.
export const getFinalPlayerPoints = (state: KnechtState): number[][] => {
    const points = getPlayerPoints(state);
    return state.status === 'over' ? points.map(roundKeepingSum) : points;
};

export const getTeamPoints = (state: KnechtState): [number, number] => {
    const points: [number, number] = [0, 0];
    state.credits.forEach(credits => credits.forEach(credit => { points[credit.teamIndex] += credit.points; }));
    return points.map(value => Math.round(value * 1000) / 1000) as [number, number];
};

export const getTurnPoints = (state: KnechtState, turnIndex: number) =>
    Math.round((state.credits[turnIndex] ?? []).reduce((sum, credit) => sum + credit.points, 0) * 1000) / 1000;

// ─── Aktionen anwenden ───
const fail = (message: string): never => { throw new KnechtRuleError(message); };

const pushTurn = (state: KnechtState, turn: Omit<Turn, 'time'>, time: number, credits: Credit[]) => {
    state.turns.push({ ...turn, time } as Turn);
    state.credits.push(credits);
    return state.turns.length - 1;
};

const commitPending = (state: KnechtState) => {
    state.racks.forEach(rack => {
        rack.hit = sorted([...new Set([...rack.hit, ...rack.pending])]);
        rack.pending = [];
    });
};

// Bleibt nur ein Becher stehen, kommt er vor dem naechsten Wurf an die Pyramidenspitze
const moveLastCupToTip = (rack: Rack) => {
    const standing = getStandingCups(rack);
    if (standing.length === 1 && standing[0] !== 0 && rack.pending.length === 0)
        Object.assign(rack, rackFromStanding([0]));
};

const resetStreaks = (state: KnechtState) => {
    state.streaks = state.streaks.map(team => team.map(() => 0));
};

const startRound = (state: KnechtState, teamIndex: number, ballsBack = false) => {
    commitPending(state);
    // Eine Serie endet mit dem Zug des Teams (Balls Back setzt sie fort)
    if (teamIndex !== state.activeTeamIndex) resetStreaks(state);
    state.activeTeamIndex = teamIndex;
    state.round = newRound(ballsBack);
    state.decider = null;
    moveLastCupToTip(state.racks[enemyOf(teamIndex)]);
};

const finish = (state: KnechtState, winnerTeamIndex: number, reason: EndReason) => {
    commitPending(state);
    state.status = 'over';
    state.winnerTeamIndex = winnerTeamIndex;
    state.endReason = reason;
    state.round.current = null;
    state.decider = null;
    if (!state.banner || state.banner === 'heating-up' || state.banner === 'on-fire') state.banner = reason === 'deathcup' ? 'deathcup' : 'win';
    addVictoryBonus(state);
};

// Die Seite ermittelt den Sieger ueberall ueber die Punktesumme. Endet ein Spiel trotzdem
// punktgleich (z.B. Deathcup oder Doppeltreffer im Nachwurf), bekommt der Sieger einen Siegpunkt.
const addVictoryBonus = (state: KnechtState) => {
    const winner = state.winnerTeamIndex!;
    const points = getTeamPoints(state);
    if (points[winner] > points[enemyOf(winner)]) return;

    const bonus = Math.round((points[enemyOf(winner)] - points[winner] + 1) * 1000) / 1000;
    const lastTurnIndex = state.turns.length - 1;
    const lastTurn = state.turns[lastTurnIndex];
    const playerCount = state.config.playerCounts[winner];
    const credits = lastTurn.teamIndex === winner && lastTurn.type !== 'owncup'
        ? [{ teamIndex: winner, playerIndex: lastTurn.playerIndex, points: bonus }]
        : Array.from({ length: playerCount }, (_, playerIndex) => ({ teamIndex: winner, playerIndex, points: bonus / playerCount }));
    state.credits[lastTurnIndex].push(...credits);
    state.victoryBonus = bonus;
};

// Verlaengerung 2x3 Becher ohne Re-Racks. Es beginnt das Team, das zuerst abgeraeumt (vorgelegt) hat.
const startOvertime = (state: KnechtState, startTeamIndex: number, time: number) => {
    state.overtimeCount++;
    state.racks = [rackFromStanding(OVERTIME_FORMATION), rackFromStanding(OVERTIME_FORMATION)];
    state.reRacksLeft = [0, 0];
    state.cleared = [false, false];
    state.nachwurfTeamIndex = null;
    resetStreaks(state);
    state.markers.push({ kind: 'overtime', teamIndex: startTeamIndex, afterTurnIndex: state.turns.length, time });
    startRound(state, startTeamIndex);
    state.banner = 'overtime';
};

const startNachwurf = (state: KnechtState, nachwurfTeam: number, time: number) => {
    startRound(state, nachwurfTeam);
    state.nachwurfTeamIndex = nachwurfTeam;
    state.markers.push({ kind: 'nachwurf', teamIndex: nachwurfTeam, afterTurnIndex: state.turns.length, time });
    state.banner = 'nachwurf';
};

const endNachwurf = (state: KnechtState, time: number) => {
    const nachwurfTeam = state.nachwurfTeamIndex!;
    if (state.cleared[nachwurfTeam]) startOvertime(state, enemyOf(nachwurfTeam), time);
    else finish(state, enemyOf(nachwurfTeam), 'cleared');
};

const endRound = (state: KnechtState, time: number) => {
    const team = state.activeTeamIndex;

    if (state.nachwurfTeamIndex !== null) return endNachwurf(state, time);

    // Alle Gegnerbecher getroffen -> Gentleman's Rule fuer den Gegner
    if (state.cleared[team]) return startNachwurf(state, enemyOf(team), time);

    if (state.round.ballHits.length === BALLS_PER_ROUND && state.round.ballHits.every(hit => hit)) {
        if (state.banner !== 'bomb') state.banner = 'ballsback';
        startRound(state, team, true);
        return;
    }

    startRound(state, enemyOf(team));
};

const endBall = (state: KnechtState, time: number) => {
    state.round.current = null;
    state.round.ballsDone++;
    if (state.round.ballsDone >= BALLS_PER_ROUND) endRound(state, time);
};

const openBall = (state: KnechtState, player: number) => {
    if (!getAllowedThrowers(state).includes(player)) fail('Dieser Spieler ist gerade nicht am Wurf');
    if (!state.round.current) {
        state.round.current = { owner: player, resolved: false, lockedPlayer: null };
        state.round.owners.push(player);
    }
    return state.round.current;
};

const applyThrow = (state: KnechtState, action: Extract<KnechtAction, { type: 'throw' }>) => {
    const team = state.activeTeamIndex;
    const enemyRack = state.racks[enemyOf(team)];
    const ballIndex = state.round.ballsDone;
    const onFireEnabled = isOnFireEnabled(state, team);
    const streakBefore = state.streaks[team][action.player] ?? 0;

    if (!getAllowedThrowers(state).includes(action.player)) fail('Dieser Spieler ist gerade nicht am Wurf');

    // Vor dem Oeffnen des Balls pruefen, sonst gilt der Ball schon als geworfen (Bombe, Balls Back)
    let preview: HitPreview | null = null;
    // Kopie: die Liste kann aus der Oberflaeche kommen (reaktiv) und landet im Spielstand
    const extras = [...(action.extraCups ?? [])];
    if (action.outcome === 'hit') {
        if (action.cup === undefined || !getHittableCups(state).includes(action.cup)) fail('Dieser Becher kann nicht getroffen werden');
        preview = previewHit(state, action.cup!, !!action.bouncer, action.player);
        if (extras.length !== preview.extrasNeeded) fail(`Es muessen ${preview.extrasNeeded} Zusatzbecher gewaehlt werden`);
        if (new Set(extras).size !== extras.length || extras.some(extra => !preview!.extraCandidates.includes(extra) || extra === action.cup))
            fail('Ungueltiger Zusatzbecher');
    } else if (action.cup !== undefined || extras.length) {
        fail('Ein Fehlwurf hat keinen Becher');
    }

    const ball = openBall(state, action.player);
    state.round.throwCount++;
    if (!ball.resolved) {
        ball.resolved = true;
        state.round.ballHits[ballIndex] = action.outcome === 'hit';
    }

    if (!preview) {
        state.streaks[team][action.player] = 0;
        pushTurn(state, { playerIndex: action.player, teamIndex: team, type: action.outcome, data: {} }, action.time, []);
        return endBall(state, action.time);
    }

    const cup = action.cup!;
    state.streaks[team][action.player] = streakBefore + 1;
    const credit = (points: number): Credit => ({ teamIndex: team, playerIndex: action.player, points });

    // Weiterer Ball in den letzten Becher: Sieg ohne Gentleman's Rule
    if (state.decider?.teamIndex === team && cup === state.decider.cup) {
        pushTurn(state, { playerIndex: action.player, teamIndex: team, type: 'lastCup', data: { cupIndex: cup, double: true } }, action.time, []);
        return finish(state, team, state.nachwurfTeamIndex === team ? 'nachwurfDouble' : 'doubleLastCup');
    }

    if (preview.type === 'bomb') {
        const partner = state.round.landings.find(landing => landing.ball === 0 && landing.cup === cup)!;
        const bouncer = !!action.bouncer;
        enemyRack.pending.push(...extras);
        const total = 1 + partner.extras.length + extras.length;
        // Bombe: 3 Becher je zur Haelfte auf beide Werfer, ein Bouncer-Becher extra geht an den, der gebounct hat
        const base = Math.min(total, BOMB_CUPS);
        const partnerBonus = partner.bouncer ? Math.min(1, total - base) : 0;
        const bomberBonus = bouncer ? Math.min(1, total - base - partnerBonus) : 0;
        state.credits[partner.turnIndex].forEach(entry => { entry.points = base / 2 + partnerBonus; });
        const [extra2, extra3, extra4] = extras;
        pushTurn(state, {
            playerIndex: action.player, teamIndex: team, type: 'bomb',
            data: {
                cupIndex1: cup,
                ...(extra2 !== undefined && { cupIndex2: extra2 }),
                ...(extra3 !== undefined && { cupIndex3: extra3 }),
                ...(extra4 !== undefined && { cupIndex4: extra4 }),
                ...(bouncer && { bouncer }),
            },
        }, action.time, [credit(base / 2 + bomberBonus)]);
        state.banner = 'bomb';
        // Im Nachwurf wirft der Bomber weiter, bis er verfehlt
        if (state.nachwurfTeamIndex === team) {
            ball.lockedPlayer = action.player;
            return;
        }
        return endBall(state, action.time);
    }

    enemyRack.pending.push(cup, ...extras);
    const turnIndex = pushTurn(state, buildHitTurn(team, action.player, preview.type, cup, extras, !!action.bouncer), action.time, [credit(1 + extras.length)]);
    state.round.landings.push({ cup, extras, turnIndex, ball: ballIndex, bouncer: !!action.bouncer });

    if (preview.type === 'lastCup') {
        state.cleared[team] = true;
        state.decider = { teamIndex: team, cup };
    }

    if (onFireEnabled && state.nachwurfTeamIndex === null) {
        if (streakBefore + 1 === 2) state.banner = 'heating-up';
        if (streakBefore + 1 >= 3) state.banner = 'on-fire';
    }

    // Weiterwerfen: im Nachwurf bis zum Fehlwurf, sonst nur On Fire.
    // Nach dem letzten Becher endet der Ball immer: den Doppeltreffer darf nur ein anderer Ball werfen.
    const keepsThrowing = preview.type !== 'lastCup'
        && (state.nachwurfTeamIndex === team || (onFireEnabled && streakBefore + 1 >= 3));
    if (keepsThrowing && state.status === 'playing') {
        ball.lockedPlayer = action.player;
        return;
    }
    endBall(state, action.time);
};

const buildHitTurn = (teamIndex: number, playerIndex: number, type: Turn['type'], cup: number, extras: number[], bouncer: boolean): Omit<Turn, 'time'> => {
    const [extra] = extras;
    const base = { playerIndex, teamIndex, type };
    switch (type) {
        case 'bouncer': return { ...base, data: { cupIndex1: cup, ...(extra !== undefined && { cupIndex2: extra }) } };
        case 'ballsback': return { ...base, data: { cupIndex1: cup, ...(extra !== undefined && { cupIndex2: extra }), ...(bouncer && { bouncer }) } };
        case 'onfire': return { ...base, data: { cupIndex: cup, ...(extra !== undefined && { cupIndex2: extra }), ...(bouncer && { bouncer }) } };
        case 'lastCup': return { ...base, data: { cupIndex: cup } };
        default: return { ...base, type: 'hit', data: { cupIndex: cup } };
    }
};

const applyTrickshot = (state: KnechtState, action: Extract<KnechtAction, { type: 'trickshot' }>) => {
    const team = state.activeTeamIndex;
    if (action.catcher < 0 || action.catcher >= state.config.playerCounts[team]) fail('Unbekannter Faenger');
    const ball = openBall(state, action.player);
    state.round.throwCount++;
    state.streaks[team][action.player] = 0;
    // Ein Trickshot setzt keine Serie fort: der Faenger beginnt eine neue
    state.streaks[team][action.catcher] = 0;
    pushTurn(state, { playerIndex: action.player, teamIndex: team, type: 'trickshot', data: { catcherIndex: action.catcher } }, action.time, []);
    // Der Ball ist noch nicht entschieden: der Faenger wirft ihn erneut
    ball.lockedPlayer = action.catcher;
};

const applyReRack = (state: KnechtState, action: Extract<KnechtAction, { type: 'reRack' }>) => {
    if (!canReRack(state)) fail('Re-Rack ist gerade nicht erlaubt');
    const rack = getTargetRack(state);
    Object.assign(rack, rackFromStanding(RE_RACK_FORMATIONS[getStandingCups(rack).length]));
    state.reRacksLeft[state.activeTeamIndex]--;
    state.markers.push({ kind: 'reRack', teamIndex: state.activeTeamIndex, afterTurnIndex: state.turns.length, time: action.time });
};

const applyDeathcup = (state: KnechtState, action: Extract<KnechtAction, { type: 'deathcup' }>) => {
    const team = state.activeTeamIndex;
    if (!getAllowedThrowers(state).includes(action.player)) fail('Dieser Spieler ist gerade nicht am Wurf');
    const remaining = getStandingCups(getTargetRack(state));
    getTargetRack(state).pending.push(...remaining);
    pushTurn(state, { playerIndex: action.player, teamIndex: team, type: 'deathcup', data: { cups: remaining } },
        action.time, [{ teamIndex: team, playerIndex: action.player, points: remaining.length }]);
    state.banner = 'deathcup';
    finish(state, team, 'deathcup');
};

const applyOwnCup = (state: KnechtState, action: Extract<KnechtAction, { type: 'ownCup' }>) => {
    const team = action.team;
    if (team !== 0 && team !== 1) fail('Unbekanntes Team');
    if (action.player < 0 || action.player >= state.config.playerCounts[team]) fail('Unbekannter Spieler');
    const rack = state.racks[team];
    const standing = getStandingCups(rack);
    if (action.cups.length === 0 || new Set(action.cups).size !== action.cups.length || action.cups.some(cup => !standing.includes(cup)))
        fail('Diese Becher stehen nicht mehr');

    // Eigene Becher zaehlen als Treffer fuer den Gegner, aufgeteilt auf alle Gegenspieler
    const opponent = enemyOf(team);
    const opponentCount = state.config.playerCounts[opponent];
    const credits = Array.from({ length: opponentCount }, (_, playerIndex) => ({
        teamIndex: opponent, playerIndex, points: action.cups.length / opponentCount,
    }));
    rack.hit = sorted([...rack.hit, ...action.cups]);
    pushTurn(state, { playerIndex: action.player, teamIndex: team, type: 'owncup', data: { cups: sorted(action.cups) } }, action.time, credits);

    if (getStandingCups(rack).length === 0) ownRackCleared(state, team, action.time);
    else moveLastCupToTip(rack);
};

// Letzter eigener Becher runtergeworfen: zaehlt als letzter Becher des Gegners, es folgt die Gentleman's Rule.
// Hatten beide Teams damit abgeraeumt, geht es in die Verlaengerung.
const ownRackCleared = (state: KnechtState, team: number, time: number) => {
    state.cleared[enemyOf(team)] = true;
    if (state.nachwurfTeamIndex !== null) return startOvertime(state, enemyOf(state.nachwurfTeamIndex), time);
    if (state.cleared[team]) return startOvertime(state, team, time);
    startNachwurf(state, team, time);
};

// Wendet eine Aktion direkt auf den Stand an (veraendert ihn). Nach aussen nur ueber applyAction / replay.
const applyActionInPlace = (state: KnechtState, action: KnechtAction) => {
    if (state.status !== 'playing') fail('Das Spiel ist bereits vorbei');
    state.banner = null;
    switch (action.type) {
        case 'throw': applyThrow(state, action); break;
        case 'trickshot': applyTrickshot(state, action); break;
        case 'reRack': applyReRack(state, action); break;
        case 'deathcup': applyDeathcup(state, action); break;
        case 'ownCup': applyOwnCup(state, action); break;
        default: fail('Unbekannte Aktion');
    }
};

export const applyAction = (state: KnechtState, action: KnechtAction): KnechtState => {
    if (state.status !== 'playing') fail('Das Spiel ist bereits vorbei');
    const next = cloneState(state);
    applyActionInPlace(next, action);
    return next;
};

export type ReplayResult = {
    state: KnechtState;
    error: { index: number; message: string } | null;
};

// Spielt Aktionen ab einem Stand weiter (der Stand selbst bleibt unveraendert). Klont nur einmal,
// dadurch bleibt auch ein langes Spiel schnell. Bei einer ungueltigen Aktion bleibt der Stand davor erhalten.
export const continueReplay = (start: KnechtState, actions: KnechtAction[], indexOffset = 0): ReplayResult => {
    const state = cloneState(start);
    for (let index = 0; index < actions.length; index++) {
        try {
            applyActionInPlace(state, actions[index]);
        } catch (error) {
            // Die fehlerhafte Aktion kann den Stand schon teilweise veraendert haben: Stand davor neu aufbauen
            return {
                state: continueReplay(start, actions.slice(0, index)).state,
                error: { index: indexOffset + index, message: error instanceof Error ? error.message : String(error) },
            };
        }
    }
    return { state, error: null };
};

// Spielt alle Aktionen nach. Bei einer ungueltigen Aktion bleibt der Stand davor erhalten.
export const replay = (config: KnechtConfig, actions: KnechtAction[]): ReplayResult =>
    continueReplay(createInitialState(config), actions);

// Ein Turn je Aktion ausser Re-Rack: Index der Aktion zu einem Turn (fuer das Bearbeiten im Verlauf)
export const getActionIndexOfTurn = (actions: KnechtAction[], turnIndex: number) => {
    let turn = -1;
    for (let index = 0; index < actions.length; index++) {
        if (actions[index].type !== 'reRack') turn++;
        if (turn === turnIndex) return index;
    }
    return -1;
};
