// Knecht Pro: Wurfzeiten aus "Zug starten". Ab dem Start eines Zugs zaehlt die Zeit bis zum ersten Wurf,
// danach jeweils bis zum naechsten Wurf desselben Zugs. Das Baelleholen zwischen den Zuegen faellt so heraus.

type TimedEvent = { kind: string; afterTurnIndex: number; time?: number };

export type ThrowTimes = {
    players: { teamIndex: number; playerIndex: number; average: number; count: number }[];
    netSeconds: number;         // Summe aller gemessenen Wurfzeiten (Spielzeit ohne Baelleholen)
};

export const getThrowTimes = (turns: Turn[], events: TimedEvent[] = []): ThrowTimes | null => {
    const starts = events.filter(event => event.kind === 'turnStart' && event.time);
    if (!starts.length) return null;

    const sums = new Map<string, { teamIndex: number; playerIndex: number; total: number; count: number }>();
    let reference: number | null = null;
    let referenceTeam: number | null = null;
    let net = 0;

    turns.forEach((turn, turnIndex) => {
        const start = starts.filter(event => event.afterTurnIndex === turnIndex).at(-1);
        if (start) { reference = start.time!; referenceTeam = turn.teamIndex; }
        // Eigene Becher und Ellenbogen-Calls sind keine Wuerfe (koennen auch das andere Team betreffen)
        if (turn.type === 'owncup' || turn.type === 'penalty') return;
        // Ohne "Zug starten" vor diesem Zug (anderes Team) keine Messung
        if (reference === null || referenceTeam !== turn.teamIndex || !turn.time) {
            reference = null;
            return;
        }
        const seconds = Math.max(0, (turn.time - reference) / 1000);
        reference = turn.time;
        net += seconds;
        const key = `${turn.teamIndex}-${turn.playerIndex}`;
        const entry = sums.get(key) ?? { teamIndex: turn.teamIndex, playerIndex: turn.playerIndex, total: 0, count: 0 };
        entry.total += seconds;
        entry.count++;
        sums.set(key, entry);
    });

    if (!sums.size) return null;
    return {
        players: [...sums.values()].map(entry => ({ teamIndex: entry.teamIndex, playerIndex: entry.playerIndex, average: entry.total / entry.count, count: entry.count })),
        netSeconds: Math.round(net),
    };
};

export const formatSeconds = (seconds: number) => seconds < 60
    ? `${seconds.toFixed(1).replace('.', ',')} s`
    : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} min`;
