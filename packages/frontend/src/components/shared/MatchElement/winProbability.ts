import { CUP_COUNT, isTrickshotAirball, OVERTIME_FORMATION } from '@/components/frontend/biPoKnecht/knechtEngine';
import { getScoringTeam, getTurnCups } from '@/components/frontend/biPoKnecht/knechtStats';

// Live-Siegwahrscheinlichkeit: ein vereinfachtes Becher-Rennen.
// - Je Zug wirft ein Team zwei Baelle, jeder trifft mit der Trefferquote des Teams; zwei Treffer = Balls Back.
// - Wer zuerst alle Becher abraeumt, gewinnt - ausser der Gegner schafft im Nachwurf den Rest (dann Verlaengerung, 50/50).
// - Vor dem Spiel ist die Trefferquote so gewaehlt, dass die Chance der Elo-Erwartung entspricht.
//   Im Spiel fliesst die tatsaechliche Trefferquote je Team immer staerker ein.

const BASE_ACCURACY = .3;           // typische Trefferquote je Ball
const PRIOR_THROWS = 16;            // so viele Wuerfe "zaehlt" die Erwartung vor dem Spiel
// Das Modell kennt keine Serien (On Fire, Balls Back am Stueck) und ist dadurch zu sicher:
// Abstand zu 50 % wird gedaempft (an echten Spielen abgeglichen)
export const CONFIDENCE = .8;

type Odds = { hit: [number, number] };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Wahrscheinlichkeit, im Nachwurf die restlichen Becher zu treffen (jeder Treffer bringt den Ball zurueck)
const rebuttal = (cups: number, hit: number) => Math.pow(1 - (1 - hit) * (1 - hit), cups);

// P(Team 0 gewinnt) fuer alle Restbecher-Kombinationen und wer am Zug ist
const solveRace = ({ hit }: Odds, maxCups: number) => {
    const size = maxCups + 1;
    const table = Array.from({ length: size }, () => Array.from({ length: size }, () => [0, 0]));
    const q = hit.map(h => [(1 - h) * (1 - h), 2 * h * (1 - h), h * h]);
    // a: Becher, die Team 0 noch treffen muss; b: die Team 1 noch treffen muss
    const terminal = (a: number, b: number) => a <= 0 ? 1 - .5 * rebuttal(b, hit[1]) : .5 * rebuttal(a, hit[0]);
    const get = (a: number, b: number, team: number) => a <= 0 || b <= 0 ? terminal(a, b) : table[a][b][team];

    for (let sum = 2; sum <= maxCups * 2; sum++) {
        for (let a = 1; a <= maxCups; a++) {
            const b = sum - a;
            if (b < 1 || b > maxCups) continue;
            // Team 0 am Zug: ein Treffer -> Team 1 dran, zwei Treffer -> Team 0 nochmal (Balls Back)
            const restA = q[0][1] * get(a - 1, b, 1) + q[0][2] * (a <= 2 ? get(0, b, 1) : get(a - 2, b, 0));
            const restB = q[1][1] * get(a, b - 1, 0) + q[1][2] * (b <= 2 ? get(a, 0, 0) : get(a, b - 2, 1));
            // beide verfehlen: Zug wechselt hin und her -> geschlossen loesen
            const x = (q[0][0] * restB + restA) / (1 - q[0][0] * q[1][0]);
            table[a][b][0] = x;
            table[a][b][1] = q[1][0] * x + restB;
        }
    }
    return get;
};

// Trefferquoten vor dem Spiel so, dass das Rennen bei 10:10 die Elo-Erwartung ergibt
const calibrate = (expected: number): [number, number] => {
    let low = -.9, high = .9;
    for (let step = 0; step < 30; step++) {
        const mid = (low + high) / 2;
        const hits: [number, number] = [BASE_ACCURACY * (1 + mid), BASE_ACCURACY * (1 - mid)];
        const chance = solveRace({ hit: hits }, CUP_COUNT)(CUP_COUNT, CUP_COUNT, 0) * .5 + solveRace({ hit: hits }, CUP_COUNT)(CUP_COUNT, CUP_COUNT, 1) * .5;
        if (chance < expected) low = mid; else high = mid;
    }
    const mid = (low + high) / 2;
    return [BASE_ACCURACY * (1 + mid), BASE_ACCURACY * (1 - mid)];
};

export const getEloExpectation = (ratingTeam0: number, ratingTeam1: number) => 1 / (1 + Math.pow(10, (ratingTeam1 - ratingTeam0) / 400));

export type WinPoint = { index: number; time?: number; chance: number };

// Siegchance von Team 0 vor dem Spiel und nach jedem Eintrag
export const getWinProbabilities = (match: Match, expected = .5, finished = true, confidence = CONFIDENCE): WinPoint[] => {
    const turns = match.turns ?? [];
    const prior = calibrate(clamp(expected, .03, .97));
    const remaining = [CUP_COUNT, CUP_COUNT];     // Becher, die Team 0 bzw. 1 noch treffen muss
    const throws = [0, 0];
    const hits = [0, 0];
    const overtimeAt = new Set((match.events ?? []).filter(event => event.kind === 'overtime').map(event => event.afterTurnIndex));

    const chanceNow = (nextTeam: number) => {
        const hit = [0, 1].map(team => clamp((hits[team] + prior[team] * PRIOR_THROWS) / (throws[team] + PRIOR_THROWS), .05, .9)) as [number, number];
        const max = Math.max(remaining[0], remaining[1], 1);
        const race = solveRace({ hit }, max)(remaining[0], remaining[1], nextTeam);
        // Vor dem ersten Becher bleibt es bei der Elo-Erwartung, danach gedaempft
        return remaining[0] === CUP_COUNT && remaining[1] === CUP_COUNT ? race : .5 + (race - .5) * confidence;
    };

    const points: WinPoint[] = [{ index: -1, time: match.time, chance: chanceNow(turns[0]?.teamIndex ?? 0) }];
    turns.forEach((turn, index) => {
        if (overtimeAt.has(index)) { remaining[0] = OVERTIME_FORMATION.length; remaining[1] = OVERTIME_FORMATION.length; }
        // Airball beim Trickshot zaehlt nicht als Wurf
        if (!isTrickshotAirball(turn, turns[index - 1]) && (turn.type === 'hit' || turn.type === 'miss' || turn.type === 'airball' || turn.type === 'bouncer' || turn.type === 'onfire' || turn.type === 'ballsback' || turn.type === 'lastCup' || turn.type === 'bomb')) {
            throws[turn.teamIndex]++;
            if (turn.type !== 'miss' && turn.type !== 'airball') hits[turn.teamIndex]++;
        }
        const cups = getTurnCups(turn);
        if (cups) {
            const team = getScoringTeam(turn);
            remaining[team] = Math.max(0, remaining[team] - cups);
        }
        const nextTeam = turns[index + 1]?.teamIndex ?? 1 - turn.teamIndex;
        points.push({ index, time: turn.time, chance: chanceNow(nextTeam) });
    });

    // Am Ende steht der Sieger fest
    if (finished && turns.length) {
        const score = [match.team1, match.team2].map(team => team.players.reduce((sum, player) => sum + (player.score ?? 0), 0));
        if (score[0] !== score[1]) points[points.length - 1] = { ...points[points.length - 1], chance: score[0] > score[1] ? 1 : 0 };
    }
    return points;
};
