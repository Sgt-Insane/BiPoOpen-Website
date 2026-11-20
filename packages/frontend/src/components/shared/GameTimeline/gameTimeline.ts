// Zeitstrahl fuer Spiele (Liga-Spieltage, Ergebnisse): Abende mit vielen Spielen werden zu einem Block,
// alle anderen Spiele stehen je Tag als Einzelspiele dazwischen.

// Ein Spielabend geht oft ueber Mitternacht: Spiele vor 6 Uhr zaehlen zum Vortag.
const DAY_CUTOFF_HOURS = 6;

// Ab so vielen Spielen an einem Abend ist es ein Block. In der Liga haben Spieltage 5 bis 37 Spiele
// (meist 9 bis 15), bis 4 Spiele an einem Abend sind Spiele zwischendurch (z.B. 14.11.2026).
export const MIN_SESSION_GAMES = 5;

export type SessionResult = 'W' | 'L';

// Teilbilanz unter einem anderen Namen, z.B. Jonas Weck als Liga-Team "Hopfenstreife"
export type SessionAlias = {
    name: string;                // Name im Spiel (Teamname)
    label: string;               // Gruppe fuer die Anzeige, z.B. "Liga" oder "Cup"
    wins: number;
    losses: number;
};

// Bilanz eines Spielers bzw. Liga-Teams an einem Abend
export type SessionRecord = {
    name: string;
    results: SessionResult[];    // chronologisch
    wins: number;
    losses: number;
    hitDifference: number;
    aliases: SessionAlias[];     // Teilbilanzen unter anderen Namen, sonst leer
};

// Ordnet einen Namen im Spiel einer Person zu. alias: Gruppe der Teilbilanz (z.B. "Liga"), ohne alias zaehlt
// das Spiel direkt fuer die Person. Ohne Funktion ist jeder Name eine eigene Person (Liga-Seite: Teams).
export type ResolveParticipant = (name: string, match: Match) => { person: string; alias?: string };

export type GameSession = {
    kind: 'session';
    key: string;
    day: Date;                   // Abend, an dem gespielt wurde (Spiele nach Mitternacht zaehlen zum Vortag)
    games: Match[];              // chronologisch
    durationMs: number;
    records: SessionRecord[];
};

export type GameSinglesDay = {
    kind: 'singles';
    key: string;
    day: Date | null;            // Tag, an dem gespielt wurde, null bei Spielen ohne Zeit
    games: Match[];              // chronologisch
};

export type GameTimelineEntry = GameSession | GameSinglesDay;

export const getTeamScore = (team: Team) => team.players.reduce((score, player) => score + (player.score ?? 0), 0);

// "Jonas Weck & Lea Ableitner", Liga-Teams stehen als einziger Spieler im Spiel
export const getTeamLabel = (team: Team) =>
    team.name || team.players.map(player => player.name.trim()).filter(Boolean).join(' & ');

// Tag eines Spiels um Mitternacht (lokale Zeit)
const getCalendarDate = (time: number) => {
    const date = new Date(time);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

// Abend eines Spiels: Spiele vor DAY_CUTOFF_HOURS Uhr zaehlen zum Vortag
const getEveningDate = (time: number) => getCalendarDate(time - DAY_CUTOFF_HOURS * 3600 * 1000);

// Verschiedene Personen in den Spielen (Liga-Teams ueber resolveParticipant auf ihren Spieler zurueckgefuehrt)
export const getParticipantCount = (games: Match[], resolveParticipant?: ResolveParticipant) => {
    const people = new Set<string>();
    games.forEach(match => [match.team1, match.team2].forEach(team => team.players.forEach((player) => {
        people.add((resolveParticipant?.(player.name, match).person ?? player.name).trim().toLocaleLowerCase());
    })));
    return people.size;
};

// Bilanz je Spieler, im Doppel zaehlt das Ergebnis fuer beide. Beste zuerst.
export const getSessionRecords =(games: Match[], resolveParticipant?: ResolveParticipant): SessionRecord[] => {
    const recordsByName = new Map<string, SessionRecord>();
    const addResult = (name: string, match: Match, won: boolean, hitDifference: number) => {
        const { person, alias } = resolveParticipant?.(name, match) ?? { person: name };
        if (!recordsByName.has(person))
            recordsByName.set(person, { name: person, results: [], wins: 0, losses: 0, hitDifference: 0, aliases: [] });
        const record = recordsByName.get(person)!;
        record.results.push(won ? 'W' : 'L');
        record.wins += won ? 1 : 0;
        record.losses += won ? 0 : 1;
        record.hitDifference += hitDifference;

        if (!alias) return;
        let aliasRecord = record.aliases.find(entry => entry.name === name && entry.label === alias);
        if (!aliasRecord) {
            aliasRecord = { name, label: alias, wins: 0, losses: 0 };
            record.aliases.push(aliasRecord);
        }
        aliasRecord.wins += won ? 1 : 0;
        aliasRecord.losses += won ? 0 : 1;
    };

    games.forEach((match) => {
        const score1 = getTeamScore(match.team1);
        const score2 = getTeamScore(match.team2);
        const team1Won = score1 > score2;
        match.team1.players.forEach(player => addResult(player.name, match, team1Won, score1 - score2));
        match.team2.players.forEach(player => addResult(player.name, match, !team1Won, score2 - score1));
    });

    return [...recordsByName.values()].sort((record1, record2) =>
        record2.wins - record1.wins
        || record1.losses - record2.losses
        || record2.hitDifference - record1.hitDifference
        || record1.name.localeCompare(record2.name, 'de')
    );
};

// Neueste zuerst. isSession entscheidet je Abend, ob er ein Block wird (Standard: ab MIN_SESSION_GAMES Spielen).
// resolveParticipant fasst Namen in der Bilanz zusammen (siehe ResolveParticipant).
export const buildGameTimeline = (
    games: Match[],
    {
        isSession = eveningGames => eveningGames.length >= MIN_SESSION_GAMES,
        resolveParticipant,
    }: { isSession?: (eveningGames: Match[]) => boolean; resolveParticipant?: ResolveParticipant } = {},
): GameTimelineEntry[] => {
    // Spiele ohne Zeit zaehlen als neueste, wie in splitLeagueGamesByRound.
    const chronological = games
        .map((match, index) => ({ match, index }))
        .sort((a, b) => (a.match.time ?? Number.MAX_SAFE_INTEGER) - (b.match.time ?? Number.MAX_SAFE_INTEGER) || a.index - b.index)
        .map(entry => entry.match);

    const evenings: { day: Date | null; games: Match[] }[] = [];
    chronological.forEach((match) => {
        const day = match.time ? getEveningDate(match.time) : null;
        const lastEvening = evenings.at(-1);
        if (lastEvening && lastEvening.day?.getTime() === day?.getTime())
            lastEvening.games.push(match);
        else
            evenings.push({ day, games: [match] });
    });

    const entries: GameTimelineEntry[] = [];
    evenings.forEach((evening) => {
        if (evening.day && isSession(evening.games)) {
            const firstGame = evening.games[0];
            const lastGame = evening.games.at(-1)!;
            entries.push({
                kind: 'session',
                key: `session-${firstGame._id ?? firstGame.time}`,
                day: evening.day,
                games: evening.games,
                durationMs: (lastGame.endTime ?? lastGame.time ?? 0) - (firstGame.time ?? 0),
                records: getSessionRecords(evening.games, resolveParticipant),
            });
            return;
        }

        // Einzelspiele je Kalendertag, an dem sie gespielt wurden (00:24 Uhr am 31.10. gehoert zum 31.10.)
        evening.games.forEach((match) => {
            const day = match.time ? getCalendarDate(match.time) : null;
            const lastEntry = entries.at(-1);
            if (lastEntry?.kind === 'singles' && lastEntry.day?.getTime() === day?.getTime())
                lastEntry.games.push(match);
            else
                entries.push({ kind: 'singles', key: `singles-${match._id ?? match.time}`, day, games: [match] });
        });
    });

    return entries.reverse();
};

// ─── Anzeige ───

// "Dauer 3 h 51" bzw. "Dauer 45 min"
export const formatSessionDuration = (durationMs: number) => {
    const minutes = Math.round(durationMs / 60000);
    if (minutes < 1) return '';
    if (minutes < 60) return `Dauer ${minutes} min`;
    return `Dauer ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
};

// "9 Spiele · 6 Teams · Dauer 3 h 51"
export const getSessionMeta = (session: GameSession, participantNoun: string) => [
    `${session.games.length} ${session.games.length === 1 ? 'Spiel' : 'Spiele'}`,
    `${session.records.length} ${participantNoun}`,
    formatSessionDuration(session.durationMs),
].filter(Boolean).join(' · ');

// ─── Schlagzeilen ───
// Bis zu drei echte Geschichten eines Abends. "Meiste Siege" zaehlt bewusst nicht: wer viel spielt, gewinnt viel.

export type SessionHighlight = {
    kind: string;
    names: string[];             // Hauptpersonen fuer Logos bzw. Spielerbilder (bei Spielen das Gewinnerteam)
    text: string;
};

type DisplayName = (name: string) => string;
const identity: DisplayName = name => name;

export const MAX_HIGHLIGHTS = 3;

// Ab wann etwas eine Geschichte ist. Liga-Teams spielen pro Spieltag nur 2 bis 4 Spiele, dort reichen kleinere Werte.
export type HighlightThresholds = {
    unbeatenWins: number;        // ungeschlagen mit mindestens so vielen Siegen
    winlessLosses: number;       // leer ausgegangen mit mindestens so vielen Niederlagen
    streakWins: number;          // Siege in Folge
};

export const DEFAULT_THRESHOLDS: HighlightThresholds = { unbeatenWins: 3, winlessLosses: 3, streakWins: 4 };

// "(3–0)" ohne Zeilenumbruch am Strich (Wortverbinder um den Halbgeviertstrich)
export const formatRecord = (wins: number, losses: number) => `(${wins}\u2060–\u2060${losses})`;

const joinNames = (labels: string[]) => labels.length <= 2 ? labels.join(' & ') : `${labels.slice(0, -1).join(', ')} & ${labels.at(-1)}`;

// "Don Promillo bleibt ungeschlagen (3–0)"
export const getUnbeatenHighlight = (records: SessionRecord[], minWins: number, participantNoun = 'Teams', getDisplayName: DisplayName = identity): SessionHighlight | null => {
    const unbeaten = records.filter(record => record.losses === 0 && record.wins >= minWins);
    if (!unbeaten.length)
        return null;

    const names = unbeaten.map(record => record.name);
    if (unbeaten.length === 1)
        return { kind: 'unbeaten', names, text: `${getDisplayName(names[0])} bleibt ungeschlagen ${formatRecord(unbeaten[0].wins, 0)}` };
    if (unbeaten.length === 2)
        return { kind: 'unbeaten', names, text: `${joinNames(names.map(getDisplayName))} bleiben ungeschlagen` };
    return { kind: 'unbeaten', names, text: `${unbeaten.length} ${participantNoun} bleiben ungeschlagen` };
};

// Nackte Meile: 0 Treffer in einem Spiel, auch im Doppel (gleiche Regel wie nackteMeilen.ts). Steht immer ganz oben.
export const getNakedMileHighlight = (games: Match[], getDisplayName: DisplayName = identity): SessionHighlight | null => {
    const names = [...new Set(games.flatMap(match =>
        [...match.team1.players, ...match.team2.players].filter(player => player.score === 0).map(player => player.name)))];
    if (!names.length)
        return null;

    const labels = names.map(getDisplayName);
    return names.length === 1
        ? { kind: 'nakedMile', names, text: `Nackte Meile für ${labels[0]}` }
        : { kind: 'nakedMile', names, text: `Nackte Meilen für ${joinNames(labels)}` };
};

// Normales Spiel geht bis 10 Becher, mehr gibt es nur in der Verlaengerung.
const isOvertime = (match: Match) =>
    Math.max(getTeamScore(match.team1), getTeamScore(match.team2)) > 10
    || !!match.events?.some(event => event.kind === 'overtime');

// In der Historie hat ein gutes Drittel der Spiele nur einen Becher Unterschied, ab 6 ist es selten (~8 %).
const BLOWOUT_MARGIN = 6;

// Halbe Becher kommen in Altdaten vor: "10,5"
const formatScore = (score: number) => score.toLocaleString('de-DE');

const getGameSummary = (match: Match, getDisplayName: DisplayName) => {
    const score1 = getTeamScore(match.team1);
    const score2 = getTeamScore(match.team2);
    const [winner, loser] = score1 > score2 ? [match.team1, match.team2] : [match.team2, match.team1];
    const label = (team: Team) => team.players.length === 1 ? getDisplayName(team.players[0].name) : getTeamLabel(team);
    return {
        winner: label(winner),
        loser: label(loser),
        // "schlaegt" bzw. im Doppel "schlagen"
        beats: winner.players.length > 1 ? 'schlagen' : 'schlägt',
        // Bild zeigt nur das Gewinnerteam, der Gegner steht im Text
        names: winner.players.map(player => player.name),
        score: `${formatScore(Math.max(score1, score2))}:${formatScore(Math.min(score1, score2))}`,
        loserScore: Math.min(score1, score2),
        margin: Math.abs(score1 - score2),
        total: score1 + score2,
        overtime: isOvertime(match),
    };
};

// Spannendstes Spiel: Verlaengerung mit den meisten Bechern, bei mehreren Verlaengerungen mit Anzahl
export const getThrillerHighlight = (games: Match[], getDisplayName: DisplayName = identity): SessionHighlight | null => {
    const overtimes = games
        .map(match => getGameSummary(match, getDisplayName))
        .filter(game => game.overtime)
        .sort((a, b) => b.total - a.total);
    const thriller = overtimes[0];
    if (!thriller)
        return null;

    const more = overtimes.length > 1 ? ` (${overtimes.length}× Verlängerung)` : '';
    return { kind: 'thriller', names: thriller.names, text: `Krimi: ${thriller.winner} ${thriller.beats} ${thriller.loser} ${thriller.score} n. V.${more}` };
};

// Eindeutigstes Spiel: zu Null oder mit mindestens BLOWOUT_MARGIN Bechern Vorsprung
export const getBlowoutHighlight = (games: Match[], getDisplayName: DisplayName = identity): SessionHighlight | null => {
    const blowout = games
        .map(match => getGameSummary(match, getDisplayName))
        .filter(game => game.margin >= BLOWOUT_MARGIN)
        .sort((a, b) => b.margin - a.margin)[0];
    if (!blowout)
        return null;

    return blowout.loserScore === 0
        ? { kind: 'blowout', names: blowout.names, text: `Zu Null: ${blowout.winner} ${blowout.beats} ${blowout.loser} ${blowout.score}` }
        : { kind: 'blowout', names: blowout.names, text: `Deklassierung: ${blowout.winner} ${blowout.beats} ${blowout.loser} ${blowout.score}` };
};

// Laengste Siegesserie des Abends, ohne die Ungeschlagenen (die stehen schon da)
export const getStreakHighlight = (records: SessionRecord[], minWins: number, getDisplayName: DisplayName = identity): SessionHighlight | null => {
    const longestStreak = (results: SessionResult[]) => results.reduce(
        (state, result) => {
            const current = result === 'W' ? state.current + 1 : 0;
            return { current, best: Math.max(state.best, current) };
        },
        { current: 0, best: 0 },
    ).best;

    const streak = records
        .filter(record => record.losses > 0)
        .map(record => ({ record, streak: longestStreak(record.results) }))
        .filter(entry => entry.streak >= minWins)
        .sort((a, b) => b.streak - a.streak)[0];
    return streak
        ? { kind: 'streak', names: [streak.record.name], text: `${getDisplayName(streak.record.name)} gewinnt ${streak.streak} Spiele in Folge` }
        : null;
};

// Leer ausgegangen: alle Spiele verloren
export const getWinlessHighlight = (records: SessionRecord[], minLosses: number, getDisplayName: DisplayName = identity): SessionHighlight | null => {
    const winless = records
        .filter(record => record.wins === 0 && record.losses >= minLosses)
        .sort((a, b) => b.losses - a.losses)[0];
    return winless
        ? { kind: 'winless', names: [winless.name], text: `${getDisplayName(winless.name)} geht leer aus ${formatRecord(0, winless.losses)}` }
        : null;
};

// Die ersten MAX_HIGHLIGHTS vorhandenen Geschichten, candidates in Prioritaet
export const pickHighlights = (candidates: (SessionHighlight | null)[]): SessionHighlight[] =>
    candidates.filter((candidate): candidate is SessionHighlight => !!candidate).slice(0, MAX_HIGHLIGHTS);

// Standard ohne Tabelle: nackte Meile, ungeschlagen, Krimi, Deklassierung, Siegesserie, leer ausgegangen
export const getSessionHighlights = (
    session: Pick<GameSession, 'games' | 'records'>,
    participantNoun = 'Teams',
    getDisplayName: DisplayName = identity,
    thresholds: HighlightThresholds = DEFAULT_THRESHOLDS,
) => pickHighlights([
    getNakedMileHighlight(session.games, getDisplayName),
    getUnbeatenHighlight(session.records, thresholds.unbeatenWins, participantNoun, getDisplayName),
    getThrillerHighlight(session.games, getDisplayName),
    getBlowoutHighlight(session.games, getDisplayName),
    getStreakHighlight(session.records, thresholds.streakWins, getDisplayName),
    getWinlessHighlight(session.records, thresholds.winlessLosses, getDisplayName),
]);
