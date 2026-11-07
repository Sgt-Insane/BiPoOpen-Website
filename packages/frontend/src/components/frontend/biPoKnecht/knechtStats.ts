import { isHitTurnType } from './knechtEngine';

// Statistik aus dem Wurfverlauf (Turns) eines Spiels: fuer den Spielende-Bildschirm und das Spielerprofil.
// Rein, ohne Vue und ohne Netzwerk.

export type KnechtPlayerStats = {
    teamIndex: number;
    playerIndex: number;
    name: string;
    points: number;
    throws: number;
    hits: number;
    misses: number;
    airballs: number;
    bouncers: number;
    bombs: number;
    ballsBacks: number;
    onFires: number;
    trickshotCatches: number;
    trickshotHits: number;
    lastCups: number;
    deathcups: number;
    ownCups: number;
    bestStreak: number;
};

// points: Punkte je Team und Spieler (aus dem Regelwerk oder die gespeicherten Scores)
export const getTurnStats = (match: Match, turns: Turn[], points: number[][]): KnechtPlayerStats[] => {
    const stats = [match.team1, match.team2].flatMap((team, teamIndex) => team.players.map((player, playerIndex) => ({
        teamIndex, playerIndex, name: player.name, points: points[teamIndex]?.[playerIndex] ?? 0,
        throws: 0, hits: 0, misses: 0, airballs: 0, bouncers: 0, bombs: 0, ballsBacks: 0, onFires: 0,
        trickshotCatches: 0, trickshotHits: 0, lastCups: 0, deathcups: 0, ownCups: 0, bestStreak: 0,
    })));
    const find = (teamIndex: number, playerIndex: number) => stats.find(entry => entry.teamIndex === teamIndex && entry.playerIndex === playerIndex);
    const streaks = new Map<KnechtPlayerStats, number>();
    let pendingTrickshot: number | null = null;

    turns.forEach(turn => {
        const entry = find(turn.teamIndex, turn.playerIndex);
        if (!entry) return;
        const data = turn.data as Record<string, unknown>;

        if (turn.type === 'owncup') { entry.ownCups += (data.cups as number[]).length; return; }
        if (turn.type === 'deathcup') { entry.deathcups++; return; }
        if (turn.type === 'trickshot') {
            entry.throws++;
            entry.misses++;
            streaks.set(entry, 0);
            const catcher = find(turn.teamIndex, data.catcherIndex as number);
            if (catcher) {
                catcher.trickshotCatches++;
                streaks.set(catcher, 0);
            }
            pendingTrickshot = data.catcherIndex as number;
            return;
        }

        entry.throws++;
        if (isHitTurnType(turn.type)) {
            entry.hits++;
            if (pendingTrickshot === turn.playerIndex) entry.trickshotHits++;
            const streak = (streaks.get(entry) ?? 0) + 1;
            streaks.set(entry, streak);
            entry.bestStreak = Math.max(entry.bestStreak, streak);
        } else {
            if (turn.type === 'airball') entry.airballs++;
            else entry.misses++;
            streaks.set(entry, 0);
        }
        pendingTrickshot = null;

        if (turn.type === 'bouncer' || data.bouncer) entry.bouncers++;
        if (turn.type === 'bomb') entry.bombs++;
        if (turn.type === 'ballsback') entry.ballsBacks++;
        if (turn.type === 'onfire') entry.onFires++;
        if (turn.type === 'lastCup') entry.lastCups++;
    });

    return stats;
};

export const getAccuracy = (stats: { hits: number; throws: number }) => stats.throws ? Math.round(stats.hits / stats.throws * 100) : 0;

// ─── Spielerprofil: alle mit dem Knecht gezaehlten Spiele eines Spielers ───
export type KnechtCareerStats = Omit<KnechtPlayerStats, 'teamIndex' | 'playerIndex' | 'name'> & {
    games: number;
    wins: number;
};

const teamScore = (team: Team) => team.players.reduce((sum, player) => sum + (player.score ?? 0), 0);

export const getKnechtCareerStats = (matches: Match[], playerName: string): KnechtCareerStats | null => {
    const nameLower = playerName.toLowerCase();
    const career: KnechtCareerStats = {
        games: 0, wins: 0, points: 0, throws: 0, hits: 0, misses: 0, airballs: 0, bouncers: 0, bombs: 0, ballsBacks: 0, onFires: 0,
        trickshotCatches: 0, trickshotHits: 0, lastCups: 0, deathcups: 0, ownCups: 0, bestStreak: 0,
    };

    matches.forEach(match => {
        if (!match.turns?.length) return;
        const teams = [match.team1, match.team2];
        const teamIndex = teams.findIndex(team => team.players.some(player => player.name.toLowerCase() === nameLower));
        if (teamIndex < 0) return;
        const playerIndex = teams[teamIndex].players.findIndex(player => player.name.toLowerCase() === nameLower);
        const points = teams.map(team => team.players.map(player => player.score ?? 0));
        const own = getTurnStats(match, match.turns, points).find(entry => entry.teamIndex === teamIndex && entry.playerIndex === playerIndex)!;

        career.games++;
        if (teamScore(teams[teamIndex]) > teamScore(teams[1 - teamIndex])) career.wins++;
        (Object.keys(career) as (keyof KnechtCareerStats)[]).forEach(key => {
            if (key === 'games' || key === 'wins') return;
            career[key] = key === 'bestStreak' ? Math.max(career[key], own[key]) : career[key] + own[key];
        });
    });

    return career.games ? career : null;
};
