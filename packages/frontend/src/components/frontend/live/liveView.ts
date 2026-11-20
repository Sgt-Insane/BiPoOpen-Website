import { getTeamPoints, replay, type KnechtState } from '@/components/frontend/biPoKnecht/knechtEngine';
import { buildKnechtMatch, formatPoints, getPlayerName, getTeamName, getTurnLabel } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';
import type { LiveGame } from '@/components/frontend/biPoKnecht/knechtLive';

// Anzeige eines Live-Spiels: Spielstand aus den Aktionen nachspielen (wie im Knecht) und fuer
// Ticker-Karte und Live-Seite aufbereiten.
export type LiveView = {
    match: Match;               // fertig aufbereitetes Spiel (Wuerfe, Ereignisse) fuer den Spielverlauf
    state: KnechtState;
    score: [string, string];
    teamNames: [string, string];
    phase: string;              // z.B. "Die Knechte werfen", "Nachwurf", "Spiel vorbei"
    lastAction: string | null;  // letzter Wurf mit Name
    minute: number | null;
    isOver: boolean;
    paused: boolean;            // pausiert (oder alle Handys weg)
};

export const getLiveView = (live: LiveGame, now = Date.now()): LiveView => {
    const base: Match = { ...live.match, time: live.startedAt ?? live.match.time };
    const { state } = replay({ playerCounts: [base.team1.players.length, base.team2.players.length], startTeamIndex: live.startTeamIndex ?? 0 }, live.actions);
    const match = buildKnechtMatch(base, state);
    const points = getTeamPoints(state);
    const teamNames: [string, string] = [getTeamName(base, 0), getTeamName(base, 1)];
    const started = live.startTeamIndex !== null;
    const isOver = state.status === 'over';

    const turns = state.turns;
    const last = turns.at(-1);
    const lastAction = last ? `${getPlayerName(base, last.teamIndex, last.playerIndex)} · ${getTurnLabel(last, base, turns.at(-2))}` : null;

    let phase = 'Gleich geht es los';
    if (isOver) phase = state.winnerTeamIndex !== null ? `${teamNames[state.winnerTeamIndex]} gewinnt` : 'Spiel vorbei';
    else if (state.nachwurfTeamIndex !== null) phase = `Nachwurf · ${teamNames[state.nachwurfTeamIndex]}`;
    else if (live.paused && started) phase = live.pausedBy ? `Pausiert · ${live.pausedBy}` : 'Pausiert';
    else if (started) phase = `${teamNames[state.activeTeamIndex]} ${base[state.activeTeamIndex === 0 ? 'team1' : 'team2'].players.length > 1 ? 'werfen' : 'wirft'}`;

    return {
        match,
        state,
        score: [formatPoints(points[0]), formatPoints(points[1])],
        teamNames,
        phase,
        lastAction,
        minute: live.startedAt && started ? Math.max(0, Math.floor(((isOver ? last?.time ?? now : now) - live.startedAt) / 60000)) : null,
        isOver,
        paused: !!live.paused && !isOver,
    };
};
