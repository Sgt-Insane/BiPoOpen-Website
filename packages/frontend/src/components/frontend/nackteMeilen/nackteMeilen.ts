// Wer in einem Spiel (offen oder Liga/Cup) 0 Treffer hat, schuldet eine nackte Meile.

// completedAt: Datum wann die nackte Meile absolviert wurde
const REMOVED_MATCHES = [
    { id: "68aa17a002608bee9cc83c3a", completedAt: new Date(2025, 7, 23) }, // Martin Brandt
    { id: "6a19c18adb067206212a65d0", completedAt: new Date(2026, 4, 29) }, // Jonas Weck
    { id: "6779b105c8962cfa56f74847", completedAt: new Date(2026, 4, 29) }, // Giulia Sanio
    { id: "694721edb49c327da2268200", completedAt: new Date(2026, 4, 29) }, // Leon Rose
    { id: "6a7f86a880132170ad914a3a", completedAt: new Date(2026, 7, 14) }, // Jens Schauf
];

// Einträge ohne bekanntes Spiel – name und completedAt manuell eintragen
const MANUAL_ABSOLVIERT: { name: string; completedAt: Date }[] = [
    { name: "Simon Weck", completedAt: new Date(2026, 4, 31) },  // TODO: richtiges Datum eintragen
    { name: "Simon Weck", completedAt: new Date(2026, 4, 21) },  // TODO: richtiges Datum eintragen
];

export type OffeneMeile = Player & { time: number; match: Match };
export type AbsolvierteMeile = { name: string; time: number; match: Match | null; completedAt: Date };

export const getNackteMeilen = (games: Match[]) => {
    const allPlayersWith0Hits: OffeneMeile[] = [];

    games.forEach(match => {
        [...match.team1.players, ...match.team2.players].forEach(player => {
            if(player.score == 0) allPlayersWith0Hits.push({...player, time: match.time!, match});
        });
    });

    const offen = allPlayersWith0Hits.filter(p => !REMOVED_MATCHES.some(m => m.id === p.match._id));

    const fromMatches: AbsolvierteMeile[] = allPlayersWith0Hits
        .filter(p => REMOVED_MATCHES.some(m => m.id === p.match._id))
        .map(p => ({ ...p, completedAt: REMOVED_MATCHES.find(m => m.id === p.match._id)!.completedAt }));

    const manual: AbsolvierteMeile[] = MANUAL_ABSOLVIERT.map(e => ({ name: e.name, time: 0, match: null, completedAt: e.completedAt }));

    const absolviert = [...fromMatches, ...manual].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

    return { offen, absolviert };
}
