import { computed, reactive, toRefs, type Ref } from 'vue';
import type { Effects } from './biPoKnechtDom';

// ---------------------------------------------------------------------------
// Data model — the single source of truth for one beer-pong match.
// ---------------------------------------------------------------------------

// A rack is one team's 10 cups (indexed 0..9 in a triangle: row1=0, row2=1-2,
// row3=3-5, row4=6-9).
//   hit     = cups that are permanently knocked down
//   pending = cups hit this round but not yet committed. A round only commits
//             once the second player of the team has thrown, so both players'
//             hits and balls stay visible until then.
type Rack = { hit: number[]; pending: number[] };

type Modifier = 'bouncer' | 'trickshot' | undefined;

// A re-rack event. Re-racks are not turns (they score nothing), so they are
// tracked separately. `afterTurnIndex` is the number of turns that existed when
// the re-rack happened, so the marker sits between turn afterTurnIndex-1 and
// afterTurnIndex in the history.
type ReRack = { afterTurnIndex: number; teamIndex: number; time: number };

// The lifecycle phase of the match. The UI derives which modal to show from it:
//   starting = before the game (pick the starting team)
//   playing  = the game is running
//   over      = the game is finished
type GameStatus = 'starting' | 'playing' | 'over';

type GameState = {
  racks: [Rack, Rack];        // racks[teamIndex] = that team's cups
  turns: Turn[];
  activeTeamIndex: number;    // 0 | 1 — team that is currently throwing
  activePlayerIndex: number;  // 0 | 1 — player within the active team
  modifier: Modifier;         // a special shot the active player armed
  reRacks: ReRack[];          // re-rack events, in chronological order
  infoText: string;
  status: GameStatus;
};

type GameSnapshot = {
  activeTeamIndex: number;
  activePlayerIndex: number;
  team1Hits: number[];
  team2Hits: number[];
  team1Pending: number[];
  team2Pending: number[];
  balls: ReturnType<Effects['snapshotBalls']>;
  modifier: Modifier;
  reRacks: ReRack[];
};

// The base action that a button click produces, before the rules decide what
// it really is (e.g. a 'hit' might turn into a 'bouncer', 'bomb' or 'lastCup').
type Base = 'hit' | 'miss' | 'airball';

// A fully decided turn: its type, its data, and which enemy cups it knocks down.
type Resolved = { type: Turn['type']; data: Turn['data']; cups: number[] };

// ---------------------------------------------------------------------------
// Turn registry — what each turn type is worth and how play continues.
// This table replaces the long if-chain that used to live in Rack.vue.
// ---------------------------------------------------------------------------

type Progress =
  | { kind: 'next' }          // hand over to the next player
  | { kind: 'same' }          // same player throws again (trickshot)
  | { kind: 'restart-team' }; // back to player 0 of this team (bomb / balls back)

type TurnDef = {
  score: (turn: Turn, index: number, turns: Turn[]) => number;
  progress: Progress;
  afterInfo?: (activePlayerName: string) => string; // overrides the info text after the turn
};

const TURN_DEFS: Record<Turn['type'], TurnDef> = {
  hit:       { score: (t, i, a) => (t.playerIndex === 0 && a[i + 1]?.type === 'bomb') ? 1.5 : 1, progress: { kind: 'next' } },
  miss:      { score: () => 0,   progress: { kind: 'next' } },
  airball:   { score: () => 0,   progress: { kind: 'next' } },
  bouncer:   { score: () => 2,   progress: { kind: 'next' } },
  bomb:      { score: () => 1.5, progress: { kind: 'restart-team' } },
  ballsback: { score: () => 1,   progress: { kind: 'restart-team' } },
  trickshot: { score: () => 0,   progress: { kind: 'same' }, afterInfo: (name) => `${name} bitte Trickshot eintragen!` },
  lastCup:   { score: () => 1,   progress: { kind: 'next' } },
  onfire:    { score: () => 1,   progress: { kind: 'same' }, afterInfo: (name) => `🔥🔥 ${name} ist ON FIRE! Weiterwerfen!` },
};

// Cup index inside the triangle for a given row (1..4) and position (1..row).
const cupIndexOf = (row: number, position: number) => {
  const r = row - 1;
  const c = position - 1;
  return (r * (r + 1)) / 2 + c;
};

// ---------------------------------------------------------------------------
// The composable.
// ---------------------------------------------------------------------------

export const useBiPoKnecht = (match: Ref<Match>, effects: Effects) => {

  const state = reactive<GameState>({
    racks: [{ hit: [], pending: [] }, { hit: [], pending: [] }],
    turns: [],
    activeTeamIndex: 0,
    activePlayerIndex: 0,
    modifier: undefined,
    reRacks: [],
    infoText: '',
    status: 'starting',
  });

  const activeTeam = computed(() => state.activeTeamIndex === 0 ? match.value.team1 : match.value.team2);
  const activePlayer = computed(() => activeTeam.value.players[state.activePlayerIndex]);

  // The rack the active team is throwing at.
  const enemyRack = () => state.racks[1 - state.activeTeamIndex];
  const lastTurn = () => state.turns[state.turns.length - 1];

  const isHitType = (type: Turn['type']) =>
    type === 'hit' || type === 'bouncer' || type === 'bomb' || type === 'ballsback' || type === 'lastCup' || type === 'onfire';

  const isMissType = (type: Turn['type']) => type === 'miss' || type === 'airball';

  const getPlayerStreak = (teamIndex: number, playerIndex: number): number => {
    let streak = 0;
    for (let i = state.turns.length - 1; i >= 0; i--) {
      const t = state.turns[i];
      if (t.teamIndex === teamIndex && t.playerIndex === playerIndex) {
        if (isHitType(t.type)) streak++;
        else if (isMissType(t.type)) break;
      }
    }
    return streak;
  };

  const getPlayerFireStatus = (teamIndex: number, playerIndex: number): 'normal' | 'heating-up' | 'on-fire' => {
    const streak = getPlayerStreak(teamIndex, playerIndex);
    if (streak >= 3) return 'on-fire';
    if (streak === 2) return 'heating-up';
    return 'normal';
  };

  const history: GameSnapshot[] = [];

  // --- small setters used by the UI -------------------------------------

  const setModifier = (newModifier: Modifier) => {
    state.modifier = state.modifier === newModifier ? undefined : newModifier;
  };
  const setInfoText = (text: string) => { state.infoText = text; };

  // --- player / team progression ----------------------------------------

  const switchActivePlayer = (teamIndex?: number, playerIndex?: number) => {
    let next = playerIndex !== undefined ? playerIndex : state.activePlayerIndex + 1;

    if (next > activeTeam.value.players.length - 1) {
      next = 0;
      state.activeTeamIndex = state.activeTeamIndex === 1 ? 0 : 1;
    }

    if (teamIndex !== undefined)
      state.activeTeamIndex = teamIndex;

    state.activePlayerIndex = next;
    state.infoText = `${activeTeam.value.players[state.activePlayerIndex].name} ist am Zug!`;
  };

  const selectPlayer = (playerIndex: number) => {
    state.activePlayerIndex = playerIndex;
    state.infoText = `${activeTeam.value.players[state.activePlayerIndex].name} ist am Zug!`;
  };

  const startGame = (startTeamIndex: number) => {
    state.status = 'playing';
    state.activeTeamIndex = startTeamIndex;
    state.infoText = `${activeTeam.value.players[state.activePlayerIndex].name} ist am Zug!`;
    effects.enterFullscreen();
    effects.requestWakeLock();
    match.value.time = new Date().getTime();
  };

  // --- undo --------------------------------------------------------------

  const pushSnapshot = () => {
    history.push({
      activeTeamIndex: state.activeTeamIndex,
      activePlayerIndex: state.activePlayerIndex,
      team1Hits: [...state.racks[0].hit],
      team2Hits: [...state.racks[1].hit],
      team1Pending: [...state.racks[0].pending],
      team2Pending: [...state.racks[1].pending],
      balls: effects.snapshotBalls(),
      modifier: state.modifier,
      reRacks: state.reRacks.map(r => ({ ...r })),
    });
  };

  const undoLastTurn = () => {
    if (history.length === 0) return;
    // A re-rack pushes a snapshot but no turn. If the most recent action was a
    // re-rack (its afterTurnIndex still equals the current turn count, i.e. no
    // turn followed it), undo only that re-rack — don't pop a real turn.
    const lastReRack = state.reRacks.at(-1);
    const isReRack = lastReRack?.afterTurnIndex === state.turns.length;
    if (!isReRack) state.turns.pop();
    const snap = history.pop()!;
    state.activeTeamIndex = snap.activeTeamIndex;
    state.activePlayerIndex = snap.activePlayerIndex;
    state.racks[0].hit.splice(0, state.racks[0].hit.length, ...snap.team1Hits);
    state.racks[1].hit.splice(0, state.racks[1].hit.length, ...snap.team2Hits);
    state.racks[0].pending.splice(0, state.racks[0].pending.length, ...snap.team1Pending);
    state.racks[1].pending.splice(0, state.racks[1].pending.length, ...snap.team2Pending);
    state.modifier = snap.modifier;
    state.reRacks.splice(0, state.reRacks.length, ...snap.reRacks);
    effects.restoreBalls(snap.balls);
    state.infoText = `${activeTeam.value.players[state.activePlayerIndex].name} ist am Zug!`;
  };

  // --- turn rules: decide WHICH turn a click really is -------------------
  // The rules are tried in order; the first one that matches wins. The last
  // rule (base) always matches, so resolveTurn never returns null.

  const ruleTrickshot = (base: Base): Resolved | null => {
    if (state.modifier !== 'trickshot' || base !== 'miss') return null;
    return { type: 'trickshot', data: {}, cups: [] };
  };

  const ruleBouncer = async (base: Base, cup?: number): Promise<Resolved | null> => {
    if (state.modifier !== 'bouncer' || base !== 'hit') return null;
    setInfoText(`${activePlayer.value.name} bitte den zweiten Becher vom Bouncer auswählen!`);
    const cup2 = await effects.askCup(state.activeTeamIndex);
    return {
      type: 'bouncer',
      data: { cupIndex1: cup!, cupIndex2: cup2 } satisfies BouncerTurn,
      cups: [cup!, cup2],
    };
  };

  const ruleBombOrBallsBack = async (base: Base, cup?: number): Promise<Resolved | null> => {
    if (base !== 'hit' || state.activePlayerIndex === 0) return null;
    const last = lastTurn();
    if (!last || (last.type !== 'hit' && last.type !== 'bouncer')) return null;

    const lastCup = last.type === 'hit'
      ? (last.data as HitTurn).cupIndex
      : (last.data as BouncerTurn).cupIndex1;

    // Same cup as the first thrower → bomb: knock down two more cups.
    if (lastCup === cup) {
      setInfoText(`${activePlayer.value.name} bitte den zweiten Becher der Bombe auswählen!`);
      const cup2 = await effects.askCup(state.activeTeamIndex);
      setInfoText(`${activePlayer.value.name} bitte den dritten Becher der Bombe auswählen!`);
      const cup3 = await effects.askCup(state.activeTeamIndex);
      return {
        type: 'bomb',
        data: { cupIndex1: cup!, cupIndex2: cup2, cupIndex3: cup3 } satisfies BombTurn,
        cups: [cup!, cup2, cup3],
      };
    }

    // Different cup → balls back.
    return {
      type: 'ballsback',
      data: { cupIndex1: cup! } satisfies BallsBackTurn,
      cups: [cup!],
    };
  };

  const ruleLastCup = (base: Base, cup?: number): Resolved | null => {
    if (base !== 'hit') return null;
    const enemy = enemyRack();
    const last = lastTurn();

    if (last?.type === 'lastCup' && last.teamIndex === state.activeTeamIndex) {
      state.status = 'over';
      return { type: 'lastCup', data: { cupIndex: cup! } satisfies LastCupTurn, cups: [] };
    }

    const totalAfterThisHit = enemy.hit.length + enemy.pending.length + 1;
    if (totalAfterThisHit !== 10) return null;
    return { type: 'lastCup', data: { cupIndex: cup! } satisfies LastCupTurn, cups: [cup!] };
  };

  const ruleOnFire = (base: Base, cup?: number): Resolved | null => {
    if (base !== 'hit') return null;
    const streak = getPlayerStreak(state.activeTeamIndex, state.activePlayerIndex);
    if (streak >= 2) {
      return {
        type: 'onfire',
        data: { cupIndex: cup! },
        cups: [cup!],
      };
    }
    return null;
  };

  const ruleBase = (base: Base, cup?: number): Resolved => ({
    type: base,
    data: base === 'hit' ? { cupIndex: cup! } satisfies HitTurn : {},
    cups: base === 'hit' ? [cup!] : [],
  });

  const rules = [ruleTrickshot, ruleBouncer, ruleLastCup, ruleBombOrBallsBack, ruleOnFire];

  const resolveTurn = async (base: Base, cup?: number): Promise<Resolved> => {
    for (const rule of rules) {
      const resolved = await rule(base, cup);
      if (resolved) return resolved;
    }
    return ruleBase(base, cup);
  };

  // --- applying a turn: the single place that changes the game state -----

  const addTurn = (type: Turn['type'], data: Turn['data']) => {
    state.turns.push({
      playerIndex: state.activePlayerIndex,
      teamIndex: state.activeTeamIndex,
      type,
      data,
      time: new Date().getTime(),
    });
  };

  const applyProgress = (progress: Progress) => {
    if (progress.kind === 'next') switchActivePlayer();
    else if (progress.kind === 'same') switchActivePlayer(state.activeTeamIndex, state.activePlayerIndex);
    else switchActivePlayer(state.activeTeamIndex, 0); // restart-team
  };

  const applyTurn = (resolved: Resolved) => {
    const def = TURN_DEFS[resolved.type];
    const enemy = enemyRack();

    enemy.pending.push(...resolved.cups);

    // Gentleman's rule: if the OTHER team already sank their last cup and the
    // second player of this team has now thrown, the game is over.
    if (def.progress.kind === 'next') {
      const lastCupTurn = state.turns.find(t => t.type === 'lastCup');
      if (lastCupTurn && lastCupTurn.teamIndex !== state.activeTeamIndex && state.activePlayerIndex === 1)
        state.status = 'over';
    }

    // Commit this round's hits once the second player has thrown (a trickshot
    // re-throw never commits — the round is not over yet).
    if (def.progress.kind !== 'same' && state.activePlayerIndex !== 0) {
      enemy.hit.push(...new Set(enemy.pending));
      enemy.pending.length = 0;
      effects.hideBalls(state.activeTeamIndex);
    }

    addTurn(resolved.type, resolved.data);
    applyProgress(def.progress);
    state.modifier = undefined;

    if (def.afterInfo) state.infoText = def.afterInfo(activePlayer.value.name);
  };

  // Entry point called by the UI when a cup / Nullwurf / Airball is clicked.
  const performTurn = async (base: Base, cup?: number) => {
    pushSnapshot();
    effects.ballStart(state.activeTeamIndex, state.activePlayerIndex);
    if (base === 'hit')
      effects.ballToCup(state.activeTeamIndex, state.activePlayerIndex, cup!);
    else
      effects.ballToArea(state.activeTeamIndex, state.activePlayerIndex, base === 'miss' ? 'null' : 'airball');

    const resolved = await resolveTurn(base, cup);
    applyTurn(resolved);
  };

  // --- re-rack -----------------------------------------------------------
  // The button sits on the active team's card, so `teamIndex` is the active
  // team and we re-form the ENEMY rack it is shooting at.

  const reRackAvailable = (teamIndex: number) => {
    const enemy = state.racks[1 - teamIndex].hit;
    const last = lastTurn();
    if (last && (last.type === 'bomb' || last.type === 'ballsback')) return false;
    if (state.reRacks.filter(r => r.teamIndex === teamIndex).length === 2) return false;
    if (state.activePlayerIndex === 1) return false;
    if (enemy.length === 4 && [6, 7, 8, 9].every(v => enemy.includes(v))) return false;
    if (enemy.length === 6 && [3, 5, 6, 7, 8, 9].every(v => enemy.includes(v))) return false;
    if (enemy.length === 7 && [3, 4, 5, 6, 7, 8, 9].every(v => enemy.includes(v))) return false;
    return enemy.length === 4 || enemy.length === 6 || enemy.length === 7;
  };

  const performReRack = (teamIndex: number) => {
    pushSnapshot();
    const enemy = state.racks[1 - teamIndex].hit;
    const count = enemy.length;
    enemy.length = 0;
    if (count === 4) enemy.push(6, 7, 8, 9);
    if (count === 6) enemy.push(3, 5, 6, 7, 8, 9);
    if (count === 7) enemy.push(3, 4, 5, 6, 7, 8, 9);
    state.reRacks.push({
      afterTurnIndex: state.turns.length,
      teamIndex,
      time: new Date().getTime(),
    });
  };

  const performDeathcup = () => {
    pushSnapshot();
    const enemy = enemyRack();
    const remainingCups = [];
    for (let i = 0; i < 10; i++) {
      if (!enemy.hit.includes(i) && !enemy.pending.includes(i)) {
        remainingCups.push(i);
      }
    }
    enemy.hit.push(...remainingCups);
    enemy.pending.length = 0;
    addTurn('hit', { cupIndex: remainingCups[0] ?? 0 });
    state.status = 'over';
    state.infoText = `💀 DEATHCUP! ${activePlayer.value.name} beendet das Spiel sofort!`;
    effects.exitFullscreen();
    effects.releaseWakeLock();
  };

  // --- scoring (used when the game is over) ------------------------------

  const scoreTurn = (turn: Turn, index: number, turns: Turn[]) =>
    TURN_DEFS[turn.type].score(turn, index, turns);

  const getPlayer = (m: Match, teamIndex: number, playerIndex: number) =>
    (teamIndex === 0 ? m.team1 : m.team2).players[playerIndex];

  // A 1v1 logged as two identical players is collapsed into a single player.
  const mergeIdenticalPlayers = (teamIndex: number) => {
    const team = teamIndex === 0 ? match.value.team1 : match.value.team2;
    if (team.players.length > 1 && team.players[0].name === team.players[1].name) {
      match.value.turns!.forEach(turn => { if (turn.teamIndex === teamIndex) turn.playerIndex = 0; });
      team.players[0].score += team.players[1].score;
      team.players = [team.players[0]];
    }
  };

  const finalizeScores = () => {
    match.value.turns = state.turns;
    match.value.turns.forEach((turn, index) => {
      getPlayer(match.value, turn.teamIndex, turn.playerIndex).score += scoreTurn(turn, index, match.value.turns!);
    });
    mergeIdenticalPlayers(0);
    mergeIdenticalPlayers(1);
    match.value.endTime = new Date().getTime();
  };

  // The returned object is reactive, so the UI can read state directly and
  // call the actions. Refs/computeds are unwrapped — no `.value` in templates.
  return reactive({
    ...toRefs(state),
    activeTeam,
    activePlayer,
    cupIndexOf,
    performTurn,
    performReRack,
    reRackAvailable,
    undoLastTurn,
    startGame,
    switchActivePlayer,
    setModifier,
    setInfoText,
    scoreTurn,
    finalizeScores,
    selectPlayer,
    performDeathcup,
    getPlayerStreak,
    getPlayerFireStatus,
  });
};

export type BiPoKnechtGame = ReturnType<typeof useBiPoKnecht>;
