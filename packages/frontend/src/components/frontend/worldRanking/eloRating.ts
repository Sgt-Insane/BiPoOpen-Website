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
export const ELO_K = 20;
// Neulinge: K startet hier und sinkt bis zum ELO_MIN_GAMES. Spiel auf ELO_K, damit neue Spieler schnell bei ihrer Staerke landen.
export const ELO_K_NEWCOMER = 40;
export const ELO_SCALE = 400;
// Erst ab so vielen Spielen erscheint man in der Liste, gerechnet wird ab dem ersten Spiel.
export const ELO_MIN_GAMES = 20;
// Aktiv = letztes Spiel hoechstens so lange her. Wer pausiert, behaelt sein Rating (kein Punkteverfall).
export const ELO_ACTIVE_MONTHS = 6;
// Trendpfeile und Rating-Veraenderung: Vergleich mit dem Stand vor so vielen Tagen.
export const ELO_TREND_DAYS = 30;
// Rating-Verlauf im Spielerprofil (Sparkline)
export const ELO_HISTORY_DAYS = 90;
// Doppel: so stark werden die Punkte einer Seite nach Treffern verteilt (7:3 Treffer = 1,2 / 0,8)
const ELO_HIT_WEIGHT = 0.5;

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_MS = ELO_ACTIVE_MONTHS * 365 / 12 * DAY_MS;

const getExpectedScore = (own: number, opponent: number) => 1 / (1 + 10 ** ((opponent - own) / ELO_SCALE));

// K nach der Zahl der bisherigen Spiele
const getPlayerK = (games: number) =>
    games >= ELO_MIN_GAMES ? ELO_K : ELO_K_NEWCOMER - (ELO_K_NEWCOMER - ELO_K) * games / ELO_MIN_GAMES;

// Becher-Differenz, auf 10 Becher umgerechnet (Verlaengerung 13:12 ist knapper als 10:9). Faktor = (5 + Differenz) / 7,5:
// 10:9 = 0,8 · 10:7 ≈ 1,07 · 10:5 ≈ 1,33 · 10:0 = 2. Ueber alle Spiele gemittelt ≈ 1, insgesamt gibt es also nicht mehr Punkte.
export const getEloMarginFactor = (winnerScore: number, loserScore: number) =>
    (5 + 10 * (winnerScore - loserScore) / winnerScore) / 7.5;

// Gegenstueck zur Becher-Differenz: Kantersiege des Favoriten zaehlen etwas weniger, die des Aussenseiters etwas mehr
// (200 Vorsprung = 0,92, 200 Rueckstand = 1,1). Sonst rutschen Starke allein durch hohe Siege gegen Schwaechere nach oben.
const getFavoriteFactor = (ratingLead: number) => 2.2 / (ratingLead / 1000 + 2.2);

// Doppel: Punkte einer Seite nach Treffern verteilen, zusammen bleibt es gleich. Wer mehr trifft, bekommt beim Sieg mehr
// und verliert bei der Niederlage weniger. Ohne erfasste Treffer bekommen alle dasselbe.
const getEloHitFactors = (hits: number[] | undefined, players: number, won: boolean) => {
    const total = hits?.reduce((acc, hit) => acc + hit, 0) ?? 0;
    if (!hits || players < 2 || total <= 0) return Array<number>(players).fill(1);
    return hits.map(hit => Math.max(0, 1 + (won ? 1 : -1) * ELO_HIT_WEIGHT * (players * hit / total - 1)));
};

// Spieler vor dem Spiel: Rating und Zahl der bisherigen Spiele (Neulings-K)
export type EloPlayerState = { rating: number; games: number };

// scores fehlt, wenn nur der Sieger bekannt ist (dann ohne Becher-Differenz).
// hits = Treffer je Seite in der Reihenfolge der Spieler, fehlt, wenn sie nicht erfasst wurden.
export type EloResult = { winner: 0 | 1; scores?: [number, number]; hits?: (number[] | undefined)[] };

// Elo-Wechsel je Spieler, auch fuer die Vorschau beim Eintragen. Team-Rating = Durchschnitt der Spieler.
// Der Gewinner bekommt, was der Verlierer abgibt. Abweichen koennen nur Neulinge (hoeheres K) und Doppel (Treffer-Verteilung).
export const getEloDeltas = (sides: EloPlayerState[][], { winner, scores, hits }: EloResult): number[][] => {
    const averages = sides.map(players => players.reduce((acc, player) => acc + player.rating, 0) / players.length);
    const lead = averages[winner] - averages[1 - winner];
    const resultFactor = scores ? getEloMarginFactor(scores[winner], scores[1 - winner]) * getFavoriteFactor(lead) : 1;
    const points = (1 - getExpectedScore(averages[winner], averages[1 - winner])) * resultFactor;

    return sides.map((players, sideIndex) => {
        const won = sideIndex === winner;
        const hitFactors = getEloHitFactors(hits?.[sideIndex], players.length, won);
        return players.map((player, playerIndex) => {
            const delta = Math.round(getPlayerK(player.games) * points * hitFactors[playerIndex]);
            return won ? delta : -delta;
        });
    });
};

// Fuer das Erklaer-Sheet, damit Anzeige und Berechnung dieselben Werte nutzen (Einzel, beide schon in der Liste).
// Zeilen: eigener Rating-Unterschied zum Gegner, Spalten: Ergebnis des Siegs.
export const ELO_EXAMPLE_RESULTS: [number, number][] = [[10, 9], [10, 5], [10, 0]];

const getExampleDelta = (difference: number, scores: [number, number]) =>
    getEloDeltas([[{ rating: ELO_START + difference, games: ELO_MIN_GAMES }], [{ rating: ELO_START, games: ELO_MIN_GAMES }]], { winner: 0, scores })[0][0];

export const ELO_EXAMPLE_ROWS = [300, 200, 100, 0, -100, -200, -300].map(difference => ({
    difference,
    points: ELO_EXAMPLE_RESULTS.map(scores => getExampleDelta(difference, scores)),
}));

// Doppel: Treffer im Team und der jeweilige Anteil an den Punkten
export const ELO_EXAMPLE_HITS = { hits: [7, 3], factors: getEloHitFactors([7, 3], 2, true) };

////////////////////////
// SPIELE             //
////////////////////////
// Alle Spielarten werden in eine gemeinsame, chronologische Liste umgerechnet.
// hits = Treffer je Spieler (Reihenfolge wie players), fehlt, wenn sie nicht erfasst wurden.
type EloSide = { players: string[]; teamName?: string; hits?: number[] };

export type EloGame = {
    matchId?: string;
    time: number;
    order: number;
    sourceLabel: string;
    sides: [EloSide, EloSide];
    winner: 0 | 1;
    scores?: [number, number]; // fehlt, wenn nur der Sieger bekannt ist
};

export type EloGames = { games: EloGame[]; displayNames: Record<string, string> };

// BiPo Open 2020: nur der Sieger ist erfasst (alle Spiele stehen als 10:0 drin), die Becher-Differenz zaehlt dort nicht.
const WINNER_ONLY_YEARS = ['2020'];

const getTeamScore = (team: Team) => team.players.reduce((acc, player) => acc + (player.score ?? 0), 0);

export const buildEloGames = (data: RankingData): EloGames => {
    const games: EloGame[] = [];
    const { toPlayerKey, getDisplayNames } = createPlayerNameResolver();

    // trackHits: Treffer je Spieler erfasst (Turniere erst seit 2023), winnerOnly: Ergebnis nicht erfasst
    const addGame = (match: Match, sourceLabel: string, time: number, team1: Team, team2: Team, team1Score: number, team2Score: number,
        useTeamNames: boolean, { trackHits = true, winnerOnly = false } = {}) => {
        // Unentschieden fliegen raus
        if (team1Score === team2Score) return;

        // Leere Spieler (z.B. nicht ausgefuelltes Zusatzfeld beim Eintragen) werden ignoriert, doppelt eingetragene zusammengefasst
        const toSide = (team: Team): EloSide => {
            const hits = new Map<string, number>();
            team.players.filter(player => player.name?.trim()).forEach(player => {
                const key = toPlayerKey(player.name);
                hits.set(key, (hits.get(key) ?? 0) + (player.score ?? 0));
            });
            return { players: [...hits.keys()], teamName: useTeamNames ? team.name : undefined, hits: trackHits ? [...hits.values()] : undefined };
        };
        const sides: [EloSide, EloSide] = [toSide(team1), toSide(team2)];
        if (sides.some(side => !side.players.length)) return;
        if (sides[0].players.some(player => sides[1].players.includes(player))) return;

        const matchId = match._id && match._id !== 'placeholder' ? match._id : undefined;
        games.push({
            matchId, time, order: games.length, sourceLabel, sides, winner: team1Score > team2Score ? 0 : 1,
            scores: winnerOnly ? undefined : [team1Score, team2Score],
        });
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
        const options = { trackHits: tournament.settings.trackPlayerShots, winnerOnly: !!year && WINNER_ONLY_YEARS.includes(year) };

        [...tournament.groupPhase.matches.flat(), ...tournament.koPhase.matches.flat()].forEach(match => {
            const team1Score = getMatchScore(match, true);
            const team2Score = getMatchScore(match, false);
            if (team1Score === undefined || team2Score === undefined) return;
            addGame(match, sourceLabel, match.time ?? time, match.team1, match.team2, team1Score, team2Score, true, options);
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

        // Team-Rating = Durchschnitt der Spieler, Treffer-Verteilung nur bei einzeln gewerteten Spielern
        const sideRatings = sideRecords.map(entries => entries.reduce((acc, entry) => acc + entry.rating, 0) / entries.length);
        const deltas = getEloDeltas(sideRecords, {
            winner: game.winner,
            scores: game.scores,
            hits: mode === 'players' ? game.sides.map(side => side.hits) : undefined,
        });

        sideRecords.forEach((entries, sideIndex) => {
            const won = sideIndex === game.winner;
            const side = game.sides[sideIndex];
            const opponentSide = game.sides[1 - sideIndex];
            const opponentRating = Math.round(sideRatings[1 - sideIndex]);
            const opponentRatingLabel = `${opponentSide.players.length > 1 ? 'Gegner-Ø' : 'Gegner'} ${opponentRating}`;

            entries.forEach((entry, entryIndex) => {
                const delta = deltas[sideIndex][entryIndex];
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
// rating = Stand nach dem Spiel, delta = Veraenderung, bei mehreren Spielern jeweils der Durchschnitt.
export type EloMatchSide = { rating: number; delta: number; players: number };

// Schluessel = Match-_id, Unentschieden und nicht gewertete Spiele fehlen.
export const getEloMatchChanges = ({ games }: EloGames): Map<string, [EloMatchSide, EloMatchSide]> => {
    const players = new Map<string, EloPlayerState>();
    const changes = new Map<string, [EloMatchSide, EloMatchSide]>();
    const average = (values: number[]) => values.reduce((acc, value) => acc + value, 0) / values.length;

    games.forEach(game => {
        const before = game.sides.map(side => side.players.map(player => players.get(player) ?? { rating: ELO_START, games: 0 }));
        const deltas = getEloDeltas(before, { winner: game.winner, scores: game.scores, hits: game.sides.map(side => side.hits) });
        const after = before.map((states, sideIndex) => states.map((state, playerIndex) => state.rating + deltas[sideIndex][playerIndex]));
        game.sides.forEach((side, sideIndex) => side.players.forEach((player, playerIndex) =>
            players.set(player, { rating: after[sideIndex][playerIndex], games: before[sideIndex][playerIndex].games + 1 })
        ));

        if (!game.matchId) return;
        const toSide = (sideIndex: number): EloMatchSide => ({
            rating: Math.round(average(after[sideIndex])),
            delta: Math.round(average(deltas[sideIndex])),
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

const isRecent = (lastTime: number, referenceTime: number) => referenceTime - lastTime <= ACTIVE_MS;
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
