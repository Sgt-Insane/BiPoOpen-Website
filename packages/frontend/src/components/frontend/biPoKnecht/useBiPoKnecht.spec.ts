import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useBiPoKnecht } from './useBiPoKnecht';
import type { Effects } from './biPoKnechtDom';

const createMockEffects = (): Effects => ({
  ballStart: () => {},
  ballToCup: () => {},
  ballToArea: () => {},
  hideBalls: () => {},
  snapshotBalls: () => [[{ opacity: '', top: '', bottom: '', left: '', right: '' }, { opacity: '', top: '', bottom: '', left: '', right: '' }], [{ opacity: '', top: '', bottom: '', left: '', right: '' }, { opacity: '', top: '', bottom: '', left: '', right: '' }]],
  restoreBalls: () => {},
  askCup: async () => 1,
  enterFullscreen: () => {},
  exitFullscreen: () => {},
  requestWakeLock: () => {},
  releaseWakeLock: () => {},
});

describe('useBiPoKnecht Match Engine', () => {
  let matchRef: any;
  let effects: Effects;

  beforeEach(() => {
    matchRef = ref({
      _id: 'test-match-1',
      team1: {
        _id: 't1',
        name: 'Team Rot',
        players: [
          { _id: 'p1', name: 'Alice', score: 0 },
          { _id: 'p2', name: 'Bob', score: 0 },
        ],
      },
      team2: {
        _id: 't2',
        name: 'Team Blau',
        players: [
          { _id: 'p3', name: 'Charlie', score: 0 },
          { _id: 'p4', name: 'David', score: 0 },
        ],
      },
    });
    effects = createMockEffects();
  });

  it('initializes game in starting state and transitions to playing', () => {
    const game = useBiPoKnecht(matchRef, effects);
    expect(game.status).toBe('starting');
    
    game.startGame(0);
    expect(game.status).toBe('playing');
    expect(game.activeTeamIndex).toBe(0);
    expect(game.activePlayerIndex).toBe(0);
    expect(game.activePlayer.name).toBe('Alice');
  });

  it('handles player switching on misses', async () => {
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    // Player 0 (Alice) misses
    await game.performTurn('miss');
    expect(game.activeTeamIndex).toBe(0);
    expect(game.activePlayerIndex).toBe(1);
    expect(game.activePlayer.name).toBe('Bob');

    // Player 1 (Bob) misses -> switches to Team 2, Player 0 (Charlie)
    await game.performTurn('miss');
    expect(game.activeTeamIndex).toBe(1);
    expect(game.activePlayerIndex).toBe(0);
    expect(game.activePlayer.name).toBe('Charlie');
  });

  it('detects balls back when both players hit different cups', async () => {
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    // Team 1 Player 0 hits cup 0
    await game.performTurn('hit', 0);
    expect(game.activePlayerIndex).toBe(1);

    // Team 1 Player 1 hits cup 1 -> Balls Back!
    await game.performTurn('hit', 1);

    expect(game.turns[game.turns.length - 1].type).toBe('ballsback');
    // Balls back keeps turn with Team 1, restarting at Player 0
    expect(game.activeTeamIndex).toBe(0);
    expect(game.activePlayerIndex).toBe(0);
    expect(game.activePlayer.name).toBe('Alice');
  });

  it('detects bomb when both players hit the exact same cup', async () => {
    effects.askCup = async () => 2; // user selects cup 2 & cup 3 for extra bomb cups
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    // Team 1 Player 0 hits cup 5
    await game.performTurn('hit', 5);

    // Team 1 Player 1 also hits cup 5 -> Bomb!
    await game.performTurn('hit', 5);

    expect(game.turns[game.turns.length - 1].type).toBe('bomb');
    expect(game.activeTeamIndex).toBe(0);
    expect(game.activePlayerIndex).toBe(0); // restarts team
  });

  it('supports full undo of actions', async () => {
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    await game.performTurn('hit', 3);
    expect(game.racks[1].pending).toContain(3);
    expect(game.turns.length).toBe(1);

    game.undoLastTurn();
    expect(game.racks[1].pending).not.toContain(3);
    expect(game.turns.length).toBe(0);
    expect(game.activePlayerIndex).toBe(0);
  });

  it('correctly validates Re-Rack conditions according to BiPo rules (3, 4, 6 cups remaining)', () => {
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    // Enemy has 10 cups standing (0 hit) -> No Re-Rack
    expect(game.reRackAvailable(0)).toBe(false);

    // Enemy has 6 cups hit (4 standing)
    game.racks[1].hit = [0, 1, 2, 3, 4, 5];
    expect(game.reRackAvailable(0)).toBe(true);

    // Enemy has 7 cups hit (3 standing)
    game.racks[1].hit = [0, 1, 2, 3, 4, 5, 6];
    expect(game.reRackAvailable(0)).toBe(true);

    // Enemy has 4 cups hit (6 standing)
    game.racks[1].hit = [0, 1, 2, 3];
    expect(game.reRackAvailable(0)).toBe(true);

    // Player 1 (2nd thrower) cannot call re-rack
    game.switchActivePlayer(0, 1);
    expect(game.reRackAvailable(0)).toBe(false);
  });
  it('manages Heating Up and On-Fire streaks with extra throws', async () => {
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    // Initial: normal
    expect(game.getPlayerFireStatus(0, 0)).toBe('normal');

    // Alice hits 1st cup
    await game.performTurn('hit', 0);
    expect(game.getPlayerStreak(0, 0)).toBe(1);
    expect(game.getPlayerFireStatus(0, 0)).toBe('normal');

    // Bob misses -> Team 2
    await game.performTurn('miss');
    // Charlie & David miss -> Back to Team 1
    await game.performTurn('miss');
    await game.performTurn('miss');

    // Alice is up again and hits 2nd cup in a row
    expect(game.activePlayerIndex).toBe(0);
    await game.performTurn('hit', 1);
    expect(game.getPlayerStreak(0, 0)).toBe(2);
    // Now Alice is heating up!
    expect(game.getPlayerFireStatus(0, 0)).toBe('heating-up');

    // Bob misses -> Team 2 misses -> Back to Alice
    await game.performTurn('miss');
    await game.performTurn('miss');
    await game.performTurn('miss');

    // Alice hits 3rd in a row -> ON FIRE!
    await game.performTurn('hit', 2);
    expect(game.turns[game.turns.length - 1].type).toBe('onfire');
    expect(game.getPlayerFireStatus(0, 0)).toBe('on-fire');
    // On-fire player stays active (gets ball back)
    expect(game.activeTeamIndex).toBe(0);
    expect(game.activePlayerIndex).toBe(0);

    // Alice hits 4th in a row -> still on fire and stays active
    await game.performTurn('hit', 3);
    expect(game.turns[game.turns.length - 1].type).toBe('onfire');
    expect(game.activePlayerIndex).toBe(0);

    // Alice misses -> on-fire ends, hands over to Bob
    await game.performTurn('miss');
    expect(game.activePlayerIndex).toBe(1);
    expect(game.getPlayerFireStatus(0, 0)).toBe('normal');
  });

  it('allows manual player selection before throwing', () => {
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    expect(game.activePlayerIndex).toBe(0);
    expect(game.activePlayer.name).toBe('Alice');

    // Switch to Bob before throw
    game.selectPlayer(1);
    expect(game.activePlayerIndex).toBe(1);
    expect(game.activePlayer.name).toBe('Bob');
  });

  it('ends game immediately on Deathcup', () => {
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    game.performDeathcup();
    expect(game.status).toBe('over');
    expect(game.racks[1].hit.length).toBe(10);
  });

  it('ends game immediately when both players hit the last cup', async () => {
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    // Opponent has 9 cups hit already
    game.racks[1].hit = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    // Player 0 hits 10th cup (cup 9) -> Last Cup
    await game.performTurn('hit', 9);
    expect(game.status).toBe('playing'); // Gentleman's rule would normally wait

    // Player 1 also hits 10th cup -> instant win without Gentleman's rule
    await game.performTurn('hit', 9);
    expect(game.status).toBe('over');
  });
  it('triggers Overtime (2x3 cups) when defending team equalizes in Gentleman rule', async () => {
    const game = useBiPoKnecht(matchRef, effects);
    game.startGame(0);

    // Team 1 knocks down 9 cups
    game.racks[1].hit = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    // Team 2 also has 9 cups down
    game.racks[0].hit = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    // Team 1 Player 0 hits the 10th cup (cup 9) -> Last Cup
    await game.performTurn('hit', 9);
    // Team 1 Player 1 misses -> switches to Team 2 for Gentleman rule
    await game.performTurn('miss');

    expect(game.activeTeamIndex).toBe(1);
    expect(game.status).toBe('playing');

    // Team 2 Player 0 hits the 10th cup (cup 9) -> Equalizer!
    await game.performTurn('hit', 9);
    // Team 2 Player 1 finishes turn -> Triggers Overtime!
    await game.performTurn('miss');

    expect(game.isOvertime).toBe(true);
    expect(game.status).toBe('playing');
    // Both teams now have 3 cups standing (7 hit: 3, 4, 5, 6, 7, 8, 9)
    expect(game.racks[0].hit.length).toBe(7);
    expect(game.racks[1].hit.length).toBe(7);
  });
});