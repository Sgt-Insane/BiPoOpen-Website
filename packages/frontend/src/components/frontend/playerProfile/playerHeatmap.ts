import { CUP_COUNT } from '@/components/frontend/biPoKnecht/knechtEngine';
import { buildCupHistory } from '@/components/shared/MatchElement/cupHistory';

// Heatmap fuer das Spielerprofil: auf welche Becherposition (1-10, aus Sicht des Werfers) trifft jemand,
// und an welchem Becher landet der Ball auf der Kante (Knecht Pro). Nur Spiele, deren Verlauf zusammenpasst
// (alte Knecht-Spiele zaehlten Becher anders).

export type CupHeatmap = { hits: number[]; edges: number[]; games: number };

export const getPlayerCupHeatmap = (matches: Match[], playerName: string): CupHeatmap | null => {
    const nameLower = playerName.toLowerCase();
    const heatmap: CupHeatmap = { hits: Array(CUP_COUNT).fill(0), edges: Array(CUP_COUNT).fill(0), games: 0 };

    matches.forEach(match => {
        if (!match.turns?.length) return;
        const teams = [match.team1, match.team2];
        const teamIndex = teams.findIndex(team => team.players.some(player => player.name.toLowerCase() === nameLower));
        if (teamIndex < 0) return;
        const playerIndex = teams[teamIndex].players.findIndex(player => player.name.toLowerCase() === nameLower);

        let history: ReturnType<typeof buildCupHistory> = null;
        try { history = buildCupHistory(match); } catch { return; }
        if (!history) return;
        heatmap.games++;

        // Treffer auf das gegnerische Rack (eigene Becher und Strafbecher zaehlen nicht)
        history[1 - teamIndex].phases.forEach(phase => Object.entries(phase.falls).forEach(([cup, fall]) => {
            if (fall.teamIndex === teamIndex && fall.playerIndex === playerIndex && fall.kind !== 'owncup' && fall.kind !== 'penalty')
                heatmap.hits[Number(cup)]++;
        }));
        // Kanten: Nullwuerfe, die knapp neben einem Becher landeten
        match.turns.forEach(turn => {
            const edge = (turn.data as { edge?: { cup: number } } | undefined)?.edge;
            if (turn.type === 'miss' && edge && turn.teamIndex === teamIndex && turn.playerIndex === playerIndex && edge.cup >= 0 && edge.cup < CUP_COUNT)
                heatmap.edges[edge.cup]++;
        });
    });

    return heatmap.hits.some(Boolean) ? heatmap : null;
};
