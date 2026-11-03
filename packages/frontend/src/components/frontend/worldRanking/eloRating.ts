import { isCupGame } from '@/components/frontend/league/LeagueUtilFunctions';
import { getPlayerForLeagueTeam } from '@/components/frontend/league/LeaguePlayersData';
import { getMatchScore } from '@/util/tournamentMatchFunctions';

////////////////////////
// ROHDATEN           //
////////////////////////
export type RankingTournament = { tournament: Tournament; time: number };

export type RankingData = {
    openGames: Match[];
    leagueGames: Match[];
    tournaments: RankingTournament[];
};

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

// Schluessel eines Spielers in den Elo-Eintraegen (Spielerprofil sucht sich darueber)
export const getEloPlayerKey = (name: string) => normalizeName(getPlayerForLeagueTeam(name) ?? name);

// Liga-/Cup-Spiele speichern den Teamnamen, gewertet wird der Spieler dahinter.
// Anzeigename = haeufigste Schreibweise
const createPlayerNameResolver = () => {
    const spellings: Record<string, Record<string, number>> = {};

    const toPlayerKey = (name: string) => {
        const playerName = (getPlayerForLeagueTeam(name) ?? name).trim().replace(/\s+/g, ' ');
        const key = normalizeName(playerName);
        spellings[key] ??= {};
        spellings[key][playerName] = (spellings[key][playerName] ?? 0) + 1;
        return key;
    };

    const getDisplayNames = (): Record<string, string> => Object.fromEntries(Object.entries(spellings).map(([key, counts]) =>
        [key, Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]]
    ));

    return { toPlayerKey, getDisplayNames };
};

////////////////////////
// ELO-FORMEL         //
////////////////////////
export const ELO_START = 1000;
export const ELO_K = 32;
export const ELO_SCALE = 400;
// Erst ab so vielen Spielen erscheint man in der Liste, gerechnet wird ab dem ersten Spiel.
export const ELO_MIN_GAMES = 20;
// Aktiv = letztes Spiel hoechstens so lange her (6 Monate).
export const ELO_ACTIVE_DAYS = 182;
// Trendpfeile und Rating-Veraenderung: Vergleich mit dem Stand vor so vielen Tagen.
export const ELO_TREND_DAYS = 30;
// Rating-Verlauf im Spielerprofil (Sparkline)
export const ELO_HISTORY_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

const getExpectedScore = (own: number, opponent: number) => 1 / (1 + 10 ** ((opponent - own) / ELO_SCALE));

// Gewinner bekommt genau so viel, wie der Verlierer abgibt (gerundet einmal fuer beide Seiten).
export const getEloDelta = (own: number, opponent: number, won: boolean) => {
    const winner = won ? own : opponent;
    const loser = won ? opponent : own;
    const delta = Math.round(ELO_K * (1 - getExpectedScore(winner, loser)));
    return won ? delta : -delta;
};

// Elo-Wechsel je Seite fuer ein noch nicht gespeichertes Spiel (Vorschau beim Eintragen).
// Gleiche Rechnung wie computeElo: Team-Rating = Durchschnitt, alle Spieler einer Seite bekommen dieselben Punkte.
export const getEloSideDeltas = (sideRatings: number[][], winner: 0 | 1): [number, number] => {
    const averages = sideRatings.map(ratings => ratings.reduce((acc, rating) => acc + rating, 0) / ratings.length);
    const winnerDelta = getEloDelta(averages[winner], averages[1 - winner], true);
    return winner === 0 ? [winnerDelta, -winnerDelta] : [-winnerDelta, winnerDelta];
};

// Fuer das Erklaer-Sheet, damit Anzeige und Berechnung dieselben Werte nutzen.
export const ELO_EXAMPLE_ROWS = [
    { label: 'Beide gleich stark', difference: 0, won: true },
    { label: 'Du bist 200 stärker', difference: 200, won: true },
    { label: 'Du bist 200 schwächer', difference: -200, won: true },
    { label: 'Du bist 200 stärker', difference: 200, won: false },
].map(row => ({ ...row, points: getEloDelta(ELO_START + row.difference, ELO_START, row.won) }));

// Zwischenwert fuer den Hinweis, dass stufenlos gerechnet wird
export const ELO_EXAMPLE_IN_BETWEEN = {
    difference: 100,
    favorite: getEloDelta(ELO_START + 100, ELO_START, true),
    underdog: getEloDelta(ELO_START, ELO_START + 100, true),
};

////////////////////////
// SPIELE             //
////////////////////////
// Alle Spielarten werden in eine gemeinsame, chronologische Liste umgerechnet.
type EloSide = { players: string[]; teamName?: string };

export type EloGame = {
    matchId?: string;
    time: number;
    order: number;
    sourceLabel: string;
    sides: [EloSide, EloSide];
    winner: 0 | 1;
};

export type EloGames = { games: EloGame[]; displayNames: Record<string, string> };

const getTeamScore = (team: Team) => team.players.reduce((acc, player) => acc + (player.score ?? 0), 0);

export const buildEloGames = (data: RankingData): EloGames => {
    const games: EloGame[] = [];
    const { toPlayerKey, getDisplayNames } = createPlayerNameResolver();

    const addGame = (match: Match, sourceLabel: string, time: number, team1: Team, team2: Team, team1Score: number, team2Score: number, useTeamNames: boolean) => {
        // Nur Sieg oder Niederlage zaehlt, Unentschieden fliegen raus
        if (team1Score === team2Score) return;

        // Leere Spieler (z.B. nicht ausgefuelltes Zusatzfeld beim Eintragen) werden ignoriert
        const toSide = (team: Team): EloSide => ({
            players: [...new Set(team.players.filter(player => player.name?.trim()).map(player => toPlayerKey(player.name)))],
            teamName: useTeamNames ? team.name : undefined,
        });
        const sides: [EloSide, EloSide] = [toSide(team1), toSide(team2)];
        if (sides.some(side => !side.players.length)) return;
        if (sides[0].players.some(player => sides[1].players.includes(player))) return;

        const matchId = match._id && match._id !== 'placeholder' ? match._id : undefined;
        games.push({ matchId, time, order: games.length, sourceLabel, sides, winner: team1Score > team2Score ? 0 : 1 });
    };

    data.openGames
        .filter(match => match.time)
        .forEach(match => addGame(match, 'Offen', match.time!, match.team1, match.team2, getTeamScore(match.team1), getTeamScore(match.team2), false));

    // Liga und Cup: 1. und 2. Liga ohne Faktor, Final Four zaehlt wie jedes andere Spiel
    data.leagueGames
        .filter(match => match.time && match.team1.players.length === 1 && match.team2.players.length === 1)
        .forEach(match => {
            const toLeagueTeam = (team: Team): Team => ({ ...team, name: team.players[0].name });
            addGame(match, isCupGame(match) ? 'Cup' : 'Liga', match.time!, toLeagueTeam(match.team1), toLeagueTeam(match.team2),
                getTeamScore(match.team1), getTeamScore(match.team2), true);
        });

    // Turniere: Gruppenphase vor K.o.-Phase, Spiele ohne Zeitstempel bekommen den Turnierzeitpunkt
    data.tournaments.forEach(({ tournament, time }) => {
        // "Weck BiPo Open 2026" -> "BiPo Open 2026"
        const year = tournament.name.match(/\d{4}/)?.[0];
        const sourceLabel = year ? `BiPo Open ${year}` : tournament.name;

        [...tournament.groupPhase.matches.flat(), ...tournament.koPhase.matches.flat()].forEach(match => {
            const team1Score = getMatchScore(match, true);
            const team2Score = getMatchScore(match, false);
            if (team1Score === undefined || team2Score === undefined) return;
            addGame(match, sourceLabel, match.time ?? time, match.team1, match.team2, team1Score, team2Score, true);
        });
    });

    games.sort((game1, game2) => game1.time - game2.time || game1.order - game2.order);

    return { games, displayNames: getDisplayNames() };
};

////////////////////////
// BERECHNUNG         //
////////////////////////
export type EloMode = 'players' | 'teams';

export type EloRecentGame = { time: number; won: boolean; delta: number; opponent: string; context: string };

export type EloRecord = {
    key: string;
    name: string;
    members: string[]; // Anzeigenamen der Spieler (1 bei Spielern, 2 bei festen Teams)
    rating: number;
    peak: number;
    games: number;
    wins: number;
    lastTime: number;
    partners: Record<string, number>;
    recent: EloRecentGame[]; // neuestes zuerst
    // Stand vor ELO_TREND_DAYS Tagen. undefined = damals noch kein Spiel.
    before?: { rating: number; games: number; lastTime: number };
    // Rating-Verlauf seit dem Stand vor ELO_HISTORY_DAYS Tagen, erster Wert = Stand damals (Sparkline im Spielerprofil)
    historyRatings: number[];
};

const RECENT_GAMES = 4;

export const computeElo = ({ games, displayNames }: EloGames, now: number, mode: EloMode): EloRecord[] => {
    const records = new Map<string, EloRecord>();
    const trendTime = now - ELO_TREND_DAYS * DAY_MS;
    let snapshotTaken = false;
    const historyTime = now - ELO_HISTORY_DAYS * DAY_MS;
    let historyStarted = false;

    const getName = (key: string) => displayNames[key] ?? key;

    const getRecord = (key: string, members: string[]) => {
        let record = records.get(key);
        if (!record) {
            record = {
                key, name: members.map(getName).join(' & '), members: members.map(getName),
                rating: ELO_START, peak: ELO_START, games: 0, wins: 0, lastTime: 0, partners: {}, recent: [],
                historyRatings: historyStarted ? [ELO_START] : [],
            };
            records.set(key, record);
        }
        return record;
    };

    const takeSnapshot = () => {
        records.forEach(record => {
            record.before = { rating: record.rating, games: record.games, lastTime: record.lastTime };
        });
        snapshotTaken = true;
    };

    const startHistory = () => {
        records.forEach(record => record.historyRatings = [record.rating]);
        historyStarted = true;
    };

    const getOpponentLabel = (side: EloSide) => side.teamName || side.players.map(getName).join(' & ');

    games.forEach(game => {
        if (!historyStarted && game.time > historyTime) startHistory();
        if (!snapshotTaken && game.time > trendTime) takeSnapshot();

        // Teams: nur Doppel, ein Eintrag pro Spielerpaar
        if (mode === 'teams' && game.sides.some(side => side.players.length !== 2)) return;

        // Pro Seite die Eintraege, die das Ergebnis bekommen
        const sideRecords = game.sides.map(side => mode === 'teams'
            ? [getRecord([...side.players].sort().join('|'), [...side.players].sort())]
            : side.players.map(player => getRecord(player, [player]))
        );

        // Team-Rating = Durchschnitt der Spieler
        const sideRatings = sideRecords.map(entries => entries.reduce((acc, entry) => acc + entry.rating, 0) / entries.length);
        const winnerDelta = getEloDelta(sideRatings[game.winner], sideRatings[1 - game.winner], true);

        sideRecords.forEach((entries, sideIndex) => {
            const won = sideIndex === game.winner;
            const delta = won ? winnerDelta : -winnerDelta;
            const side = game.sides[sideIndex];
            const opponentSide = game.sides[1 - sideIndex];
            const opponentRating = Math.round(sideRatings[1 - sideIndex]);
            const opponentRatingLabel = `${opponentSide.players.length > 1 ? 'Gegner-Ø' : 'Gegner'} ${opponentRating}`;

            entries.forEach(entry => {
                const partners = mode === 'players' ? side.players.filter(player => player !== entry.key) : [];
                partners.forEach(partner => entry.partners[partner] = (entry.partners[partner] ?? 0) + 1);

                const context = [game.sourceLabel, ...(partners.length ? [`mit ${partners.map(getName).join(' & ')}`] : [])].join(', ');

                entry.rating += delta;
                entry.peak = Math.max(entry.peak, entry.rating);
                if (historyStarted) entry.historyRatings.push(entry.rating);
                entry.games++;
                if (won) entry.wins++;
                entry.lastTime = Math.max(entry.lastTime, game.time);
                entry.recent.unshift({ time: game.time, won, delta, opponent: getOpponentLabel(opponentSide), context: `${context} · ${opponentRatingLabel}` });
                entry.recent.length = Math.min(entry.recent.length, RECENT_GAMES);
            });
        });
    });

    if (!historyStarted) startHistory();
    if (!snapshotTaken) takeSnapshot();

    return [...records.values()];
};

////////////////////////
// JE SPIEL           //
////////////////////////
// Elo je Seite nach einem Spiel (Spieler-Wertung wie computeElo), z.B. fuer die Elo-Zeile im MatchElement.
// rating = Stand nach dem Spiel, bei mehreren Spielern der Durchschnitt.
export type EloMatchSide = { rating: number; delta: number; players: number };

// Schluessel = Match-_id, Unentschieden und nicht gewertete Spiele fehlen.
export const getEloMatchChanges = ({ games }: EloGames): Map<string, [EloMatchSide, EloMatchSide]> => {
    const ratings = new Map<string, number>();
    const changes = new Map<string, [EloMatchSide, EloMatchSide]>();

    games.forEach(game => {
        const before = game.sides.map(side => side.players.map(player => ratings.get(player) ?? ELO_START));
        const deltas = getEloSideDeltas(before, game.winner);
        game.sides.forEach((side, sideIndex) =>
            side.players.forEach((player, playerIndex) => ratings.set(player, before[sideIndex][playerIndex] + deltas[sideIndex]))
        );

        if (!game.matchId) return;
        const toSide = (sideIndex: number): EloMatchSide => ({
            rating: Math.round(before[sideIndex].reduce((acc, rating) => acc + rating, 0) / before[sideIndex].length + deltas[sideIndex]),
            delta: deltas[sideIndex],
            players: before[sideIndex].length,
        });
        changes.set(game.matchId, [toSide(0), toSide(1)]);
    });

    return changes;
};

////////////////////////
// RANGLISTE          //
////////////////////////
export type EloEntry = EloRecord & {
    rank: number | null; // null = inaktiv
    // Platzveraenderung zum Stand vor ELO_TREND_DAYS Tagen. null = damals noch nicht in der Liste.
    trend: number | null;
    ratingChange: number;
    favoritePartner?: string;
};

export type EloRanking = { active: EloEntry[]; inactive: EloEntry[] };

const isRecent = (lastTime: number, referenceTime: number) => referenceTime - lastTime <= ELO_ACTIVE_DAYS * DAY_MS;
const isListed = (games: number, lastTime: number, referenceTime: number) =>
    games >= ELO_MIN_GAMES && isRecent(lastTime, referenceTime);

// Gleiches Rating = gleicher Platz (1, 2, 2, 4)
const getRanks = <T>(entries: T[], getRating: (entry: T) => number) => {
    let rank = 0;
    return entries.map((entry, index) => {
        if (index === 0 || getRating(entries[index - 1]) !== getRating(entry)) rank = index + 1;
        return rank;
    });
};

const byRating = (record1: EloRecord, record2: EloRecord) => record2.rating - record1.rating || record1.name.localeCompare(record2.name);

export const getEloRanking = (records: EloRecord[], now: number): EloRanking => {
    const trendTime = now - ELO_TREND_DAYS * DAY_MS;

    const previous = records
        .filter(record => record.before && isListed(record.before.games, record.before.lastTime, trendTime))
        .sort((record1, record2) => record2.before!.rating - record1.before!.rating || record1.name.localeCompare(record2.name));
    const previousRanks = getRanks(previous, record => record.before!.rating);
    const previousRankByKey = new Map(previous.map((record, index) => [record.key, previousRanks[index]]));
    const nameByKey = new Map(records.map(record => [record.key, record.name]));

    const toEntry = (record: EloRecord, rank: number | null): EloEntry => {
        const previousRank = previousRankByKey.get(record.key);
        const favoritePartner = Object.entries(record.partners).sort((a, b) => b[1] - a[1])[0]?.[0];
        return {
            ...record,
            rank,
            trend: rank === null || previousRank === undefined ? null : previousRank - rank,
            ratingChange: record.rating - (record.before?.rating ?? ELO_START),
            favoritePartner: favoritePartner && nameByKey.get(favoritePartner),
        };
    };

    const listed = records.filter(record => isListed(record.games, record.lastTime, now)).sort(byRating);
    const ranks = getRanks(listed, record => record.rating);

    // Inaktive behalten ihr Rating
    const inactive = records
        .filter(record => record.games >= ELO_MIN_GAMES && !isRecent(record.lastTime, now))
        .sort(byRating);

    return {
        active: listed.map((record, index) => toEntry(record, ranks[index])),
        inactive: inactive.map(record => toEntry(record, null)),
    };
};
