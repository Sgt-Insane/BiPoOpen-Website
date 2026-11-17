// Gemeinsame Rangfolge fuer alle Spielersuchen (Kopfzeile, Spiel eintragen, Vergleich):
// 1. ein Wort im Namen beginnt mit der Eingabe ("Ma" -> "Matthias Weck", "We" -> "Matthias Weck")
// 2. kommt irgendwo vor ("ma" -> "Thomas")
// Innerhalb jeder Gruppe: wer mehr Spiele hat zuerst, dann alphabetisch.
// Vor- und Nachname zaehlen gleich, sonst stuende bei "Weck" ein Profil, das nur "Weck" heisst
// (1 Spiel), vor den aktiven Wecks.

export const normalizePlayerSearch = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const matchRank = (name: string, search: string) =>
    name.split(' ').some(word => word.startsWith(search)) ? 0 : 1;

export const rankPlayerNames = (names: string[], query: string, matchCounts: Record<string, number> = {}) => {
    const search = normalizePlayerSearch(query);
    return names
        .filter(name => normalizePlayerSearch(name).includes(search))
        .map(name => ({ name, rank: search ? matchRank(normalizePlayerSearch(name), search) : 0 }))
        .sort((first, second) =>
            first.rank - second.rank ||
            (matchCounts[second.name] ?? 0) - (matchCounts[first.name] ?? 0) ||
            first.name.localeCompare(second.name, 'de', { sensitivity: 'base' }))
        .map(entry => entry.name);
};
