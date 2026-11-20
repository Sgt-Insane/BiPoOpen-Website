import { getAccuracy, getTurnStats } from '@/components/frontend/biPoKnecht/knechtStats';
import { formatDuration, formatPoints, getAwards, getTeamColor, getTeamName, type KnechtAward } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';

// Daten fuer die Teilen-Sticker (transparente Bilder fuer Insta-/Snapchat-Storys) aus einem Knecht-Spiel.

export type StickerPlayer = {
    teamIndex: number;
    name: string;
    hits: number;
    throws: number;
    accuracy: number;
    points: string;
    bestStreak: number;
    bombs: number;
    award: KnechtAward | null;
    eloDelta: number | null;
};

export type StickerData = {
    teams: { name: string; color: string; score: string }[];
    winnerIndex: number | null;
    dateText: string;
    durationText: string;
    players: StickerPlayer[];
};

const sumScore = (team: Team) => team.players.reduce((sum, player) => sum + (player.score ?? 0), 0);

// eloDeltas: Elo-Aenderung je Spielername, falls bekannt
export const buildStickerData = (match: Match, eloDeltas: Record<string, number> = {}): StickerData => {
    const turns = match.turns ?? [];
    const scores = [sumScore(match.team1), sumScore(match.team2)];
    const winnerIndex = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;

    const points = [match.team1, match.team2].map(team => team.players.map(player => player.score ?? 0));
    const stats = getTurnStats(match, turns, points);
    const awards = getAwards(stats);
    const players = stats.map((entry, index) => ({
        teamIndex: entry.teamIndex,
        name: entry.name,
        hits: entry.hits,
        throws: entry.throws,
        accuracy: getAccuracy(entry),
        points: formatPoints(entry.points),
        bestStreak: entry.bestStreak,
        bombs: entry.bombs,
        award: awards[index] ?? null,
        eloDelta: eloDeltas[entry.name] ?? null,
    }));

    return {
        teams: [0, 1].map(teamIndex => ({ name: getTeamName(match, teamIndex), color: getTeamColor(match, teamIndex), score: formatPoints(scores[teamIndex]) })),
        winnerIndex,
        dateText: match.time ? new Date(match.time).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
        durationText: formatDuration(match.time, match.endTime ?? turns.at(-1)?.time) ?? '',
        players,
    };
};
