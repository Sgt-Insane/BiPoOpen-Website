import { getLeagueStandingsForPlayer, isCupGame } from "@/components/frontend/league/LeagueUtilFunctions";
import { checkIfMatchFinished, checkIfTeam1WonVsTeam2, getMatchScore } from "@/util/tournamentMatchFunctions";
import { getBiPoOpenTournamentFallbackTime } from "@/util/bipoOpenTournamentMeta";
import { GameData, getGameData } from "@/util/gameDataCache";
import { calculateBadges, type RecordKey, type RecordStanding } from "./BadgeRegistry";
import { getLeagueTeamForPlayer, getPlayerForLeagueTeam } from "@/components/frontend/league/LeaguePlayersData";
import { ELO_START, buildEloGames, computeElo, getEloMatchChanges, getEloPlayerKey, getEloRanking } from "@/components/frontend/worldRanking/eloRating";

const TREND_PERIOD_DAYS: Record<Exclude<TrendPeriod, 'all'>, number> = {
    '1m': 30,
    '3m': 90,
    '6m': 180,
    '1y': 365,
};

const PLAYER_NAMES_CACHE_KEY = 'bipo-player-names-cache-v3';
const PLAYER_NAMES_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
let cachedPlayerNames: string[] | null = null;
let playerNamesRequest: Promise<string[]> | null = null;
let cachedPlayerMatchCounts: Record<string, number> | null = null;
let playerMatchCountsRequest: Promise<Record<string, number>> | null = null;

// Nach dem Eintragen eines Spiels: neue Spieler und Spielzahlen neu berechnen.
// Serien, Badges und Elo haengen am Datenstand (gameDataCache) und rechnen sich mit neuen Daten selbst neu.
export const clearPlayerCaches = () => {
    cachedPlayerNames = null;
    cachedPlayerMatchCounts = null;

    if (typeof window !== 'undefined') {
        try {
            window.localStorage.removeItem(PLAYER_NAMES_CACHE_KEY);
        } catch {
            // Ignore storage errors.
        }
    }
};

const formatName = (name: string) =>
    name.split(" ").map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");

const normalizePlayerNameForList = (name: string): string => {
    const formattedName = formatName(name);
    return getPlayerForLeagueTeam(formattedName) ?? formattedName;
};

// Rechenergebnisse je Datenstand: neue Daten = neues Objekt = neu rechnen
const memoize = <T>(compute: (data: GameData) => T) => {
    const cache = new WeakMap<GameData, T>();
    return (data: GameData): T => {
        if (!cache.has(data)) cache.set(data, compute(data));
        return cache.get(data)!;
    };
};

const getPlayerNamesFromData = memoize((data: GameData) => {
    const allNames: Set<string> = new Set();
    const matchCounts: Record<string, number> = {};
    const addMatchPlayers = (match: Match) => {
        [...match.team1.players, ...match.team2.players].forEach(player => {
            const name = normalizePlayerNameForList(player.name);
            allNames.add(name);
            matchCounts[name] = (matchCounts[name] ?? 0) + 1;
        });
    };

    data.openGames.forEach(addMatchPlayers);
    data.leagueGames.forEach(addMatchPlayers);
    data.tournaments.forEach(({ tournament }) => {
        tournament.teams.forEach(team => {
            team.players.forEach(player => allNames.add(normalizePlayerNameForList(player.name)));
        });
        [...tournament.groupPhase.matches, ...tournament.koPhase.matches]
            .flat()
            .filter(checkIfMatchFinished)
            .forEach(addMatchPlayers);
    });

    return { names: Array.from(allNames).sort(), matchCounts };
});

export const getAllPlayerNames = async (): Promise<string[]> => {
    if (cachedPlayerNames) return cachedPlayerNames;
    if (playerNamesRequest) return playerNamesRequest;

    if (typeof window !== 'undefined') {
        try {
            const rawCache = window.localStorage.getItem(PLAYER_NAMES_CACHE_KEY);
            if (rawCache) {
                const parsed = JSON.parse(rawCache) as {
                    timestamp: number;
                    names: string[];
                    matchCounts: Record<string, number>;
                };
                if (
                    parsed &&
                    Array.isArray(parsed.names) &&
                    parsed.matchCounts &&
                    typeof parsed.timestamp === 'number' &&
                    Date.now() - parsed.timestamp < PLAYER_NAMES_CACHE_TTL_MS
                ) {
                    cachedPlayerNames = parsed.names;
                    cachedPlayerMatchCounts = parsed.matchCounts;
                    return cachedPlayerNames;
                }
            }
        } catch {
            // Ignore cache parse/storage errors and continue with network fetch.
        }
    }

    playerNamesRequest = (async () => {
        const { names, matchCounts } = getPlayerNamesFromData(await getGameData());
        cachedPlayerNames = names;
        cachedPlayerMatchCounts = matchCounts;

        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(
                    PLAYER_NAMES_CACHE_KEY,
                    JSON.stringify({ timestamp: Date.now(), names, matchCounts })
                );
            } catch {
                // Ignore storage quota/private mode errors.
            }
        }

        return names;
    })();

    try {
        return await playerNamesRequest;
    } finally {
        playerNamesRequest = null;
    }
};

export const getPlayerMatchCounts = async (): Promise<Record<string, number>> => {
    if (cachedPlayerMatchCounts) return cachedPlayerMatchCounts;
    if (playerMatchCountsRequest) return playerMatchCountsRequest;

    playerMatchCountsRequest = getAllPlayerNames().then(() => cachedPlayerMatchCounts ?? {});
    try {
        return await playerMatchCountsRequest;
    } finally {
        playerMatchCountsRequest = null;
    }
};

////////////////////////
// SPIELE JE SPIELER  //
////////////////////////
// Einmal alle Spiele nach Spielernamen sortieren, statt fuer jeden Spieler alle Spiele zu durchsuchen.
// Offene Spiele und Liga: Name klein geschrieben. Turniere: exakter Name, nur beendete Spiele.
type PlayerMatchIndex = {
    open: Map<string, Match[]>;
    league: Map<string, Match[]>;
    tournaments: { year: string; hitsTracked: boolean; byName: Map<string, Match[]> }[];
};

const addToIndex = (index: Map<string, Match[]>, match: Match, toKey: (name: string) => string) => {
    const keys = new Set([...match.team1.players, ...match.team2.players].map(player => toKey(player.name)));
    keys.forEach(key => {
        const matches = index.get(key);
        if (matches) matches.push(match);
        else index.set(key, [match]);
    });
};

const getPlayerMatchIndex = memoize((data: GameData): PlayerMatchIndex => {
    const toLower = (name: string) => name.toLowerCase();
    const open = new Map<string, Match[]>();
    const league = new Map<string, Match[]>();
    data.openGames.forEach(match => addToIndex(open, match, toLower));
    data.leagueGames.forEach(match => addToIndex(league, match, toLower));

    // 2020-2022: Treffer pro Spieler wurden nicht erfasst (trackPlayerShots = false).
    // Diese Spiele bleiben in der Wertung (Spiele/Siege), fließen aber nicht in die Trefferquote ein.
    const tournaments = data.tournaments.map(({ year, tournament }) => {
        const byName = new Map<string, Match[]>();
        [...tournament.groupPhase.matches, ...tournament.koPhase.matches]
            .flat()
            .filter(checkIfMatchFinished)
            .forEach(match => addToIndex(byName, match, name => name));
        return { year, hitsTracked: tournament.settings.trackPlayerShots, byName };
    });

    return { open, league, tournaments };
});

const isPlayerInTeam = (team: Team, nameLower: string) => team.players.some(p => p.name.toLowerCase() === nameLower);

const getNormalizedPlayerCombination = (players: Match['team1']['players']): string =>
    players
        .map(p => formatName(p.name))
        .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
        .join(" & ");

const getOpponentName = (match: Match, playerName: string): string => {
    let isTeam1 = isPlayerInTeam(match.team1, playerName.toLowerCase());
    return getNormalizedPlayerCombination(isTeam1 ? match.team2.players : match.team1.players);
};

const getPartnerName = (match: Match, playerName: string): string | null => {
    let lo = playerName.toLowerCase();
    let team = isPlayerInTeam(match.team1, lo) ? match.team1.players : match.team2.players;
    if (team.length < 2) return null;
    let partner = team.find(p => p.name.toLowerCase() !== lo);
    return partner ? formatName(partner.name) : null;
};

const createHistoryEntry = (match: Match, source: string, playerName: string, time: number, hitsTracked: boolean): MatchHistoryEntry => {
    const lo = playerName.toLowerCase();
    const isTeam1 = isPlayerInTeam(match.team1, lo);
    const team1Won = checkIfTeam1WonVsTeam2(match);
    const player = (isTeam1 ? match.team1 : match.team2).players.find(p => p.name.toLowerCase() === lo);

    return {
        match,
        source,
        time,
        won: team1Won != undefined && (isTeam1 ? team1Won : !team1Won),
        hits: player?.score ?? 0,
        hitsTracked,
        ownScore: getMatchScore(match, isTeam1) ?? 0,
        opponentScore: getMatchScore(match, !isTeam1) ?? 0,
    };
};

// Alle Spiele eines Spielers aus allen Quellen, neuestes zuerst
const buildPlayerHistory = (data: GameData, playerName: string) => {
    const index = getPlayerMatchIndex(data);
    const playerNameLower = playerName.toLowerCase();
    const matchHistory: MatchHistoryEntry[] = [];

    const isSize = (match: Match, size: number) => match.team1.players.length === size && match.team2.players.length === size;
    const addMatches = (matches: Match[], source: string, nameInMatch: string) =>
        matches.forEach(match => matchHistory.push(createHistoryEntry(match, source, nameInMatch, match.time || 0, true)));

    // 1. Offene Spiele
    const openMatches = index.open.get(playerNameLower) ?? [];
    addMatches(openMatches.filter(match => isSize(match, 1)), "Offene Spiele 1v1", playerName);
    addMatches(openMatches.filter(match => isSize(match, 2)), "Offene Spiele 2v2", playerName);

    // 2. Liga (ueber das Team des Spielers) - Pokalspiele laufen als eigene Kategorie
    const leagueTeam = getLeagueTeamForPlayer(playerName);
    const leagueName = leagueTeam ?? playerName;
    const leagueMatches = (index.league.get(leagueName.toLowerCase()) ?? []).filter(match => isSize(match, 1));
    addMatches(leagueMatches.filter(match => !isCupGame(match)), "BiPo League", leagueName);
    addMatches(leagueMatches.filter(isCupGame), "BiPo League Cup", leagueName);

    // 3. Turniere - alle BiPo Open Turniere in einer Kategorie
    index.tournaments.forEach(({ year, hitsTracked, byName }) => {
        const fallbackTime = getBiPoOpenTournamentFallbackTime(year);
        (byName.get(playerName) ?? []).forEach(match => matchHistory.push(
            createHistoryEntry(match, "BiPo Open Turniere", playerName, match.time && match.time > 0 ? match.time : fallbackTime, hitsTracked)
        ));
    });

    matchHistory.sort((a, b) => b.time - a.time);
    return { leagueTeam, matchHistory };
};

////////////////////////
// STATISTIK          //
////////////////////////
const calculateStreaksFromResults = (matchHistory: { time: number; won: boolean }[]) => {
    let sorted = [...matchHistory].filter(m => m.time > 0).sort((a, b) => a.time - b.time);
    let best = 0, temp = 0, worstLosing = 0, tempLosing = 0;

    sorted.forEach(e => {
        if (e.won) {
            temp++;
            if (temp > best) best = temp;
            tempLosing = 0;
        } else {
            temp = 0;
            tempLosing++;
            if (tempLosing > worstLosing) worstLosing = tempLosing;
        }
    });

    return { current: temp, best, longestLosing: worstLosing };
};

const calculateExtraStatsFromResults = (matchHistory: MatchHistoryEntry[]): ExtraStats => {
    let fastestWinMinutes: number | null = null;

    matchHistory.forEach(({ match, time, won }) => {
        if (!match.endTime || !time || time === 0) return;
        if (!won) return;
        let duration = (match.endTime - time) / 60000;
        if (duration > 0 && (fastestWinMinutes === null || duration < fastestWinMinutes)) {
            fastestWinMinutes = Math.round(duration * 10) / 10;
        }
    });

    let timeBlocks: Map<number, { wins: number; total: number }> = new Map();
    matchHistory.forEach(({ time, won }) => {
        if (!time || time === 0) return;
        let hour = new Date(time).getHours();
        let blockStart = Math.floor(hour / 2) * 2;
        let block = timeBlocks.get(blockStart) || { wins: 0, total: 0 };
        block.total++;
        if (won) block.wins++;
        timeBlocks.set(blockStart, block);
    });

    let timeOfDayStats: TimeOfDayBlock[] = [];
    for (let h = 0; h < 24; h += 2) {
        let block = timeBlocks.get(h);
        if (!block || block.total === 0) continue;
        timeOfDayStats.push({
            label: `${h}–${h + 2} Uhr`,
            wins: block.wins,
            losses: block.total - block.wins,
            total: block.total,
            winrate: Math.round(block.wins / block.total * 100),
        });
    }

    // Nur Zeitbloecke mit mehr als 4 Spielen
    let bestTimeOfDay: string | null = null;
    let bestTimeWinrate: number | null = null;
    let mostActiveTimeOfDay: string | null = null;
    let mostActiveGames: number | null = null;
    timeOfDayStats.forEach(block => {
        if (block.total <= 4) return;
        if (bestTimeWinrate === null || block.winrate > bestTimeWinrate) {
            bestTimeWinrate = block.winrate;
            bestTimeOfDay = block.label;
        }
        if (mostActiveGames === null || block.total > mostActiveGames) {
            mostActiveGames = block.total;
            mostActiveTimeOfDay = block.label;
        }
    });

    return { fastestWinMinutes, bestTimeOfDay, bestTimeWinrate, longestLosingStreak: 0, timeOfDayStats, mostActiveTimeOfDay, mostActiveGames };
};

// Kennzahlen, Partner und Gegner fuer eine (gefilterte) Spieleliste
const summarizeHistory = (history: MatchHistoryEntry[], playerName: string, leagueTeam: string | null) => {
    const categoriesBySource: Map<string, CategoryStats> = new Map();
    history.forEach(m => {
        const existing = categoriesBySource.get(m.source) || { name: m.source, matches: 0, wins: 0, hits: 0, averageHits: 0, trackedMatches: 0 };
        existing.matches++;
        if (m.won) existing.wins++;
        existing.hits += m.hits;
        if (m.hitsTracked) existing.trackedMatches++;
        categoriesBySource.set(m.source, existing);
    });
    const categories = Array.from(categoriesBySource.values()).map(c => {
        c.averageHits = c.trackedMatches > 0 ? c.hits / c.trackedMatches : 0;
        return c;
    });

    const totalMatches = history.length;
    const totalWins = history.filter(m => m.won).length;
    const totalHits = history.reduce((a, m) => a + m.hits, 0);
    const totalTrackedMatches = history.filter(m => m.hitsTracked).length;

    const streaks = calculateStreaksFromResults(history);
    const extraStats = calculateExtraStatsFromResults(history);
    extraStats.longestLosingStreak = streaks.longestLosing;

    const rivals: Map<string, { wins: number; losses: number }> = new Map();
    const partners: Map<string, { matches: number; wins: number; losses: number }> = new Map();
    const leagueTeamLower = leagueTeam?.toLowerCase();
    history.forEach(({ match, won }) => {
        const isLeagueMatch = !!leagueTeamLower && (isPlayerInTeam(match.team1, leagueTeamLower) || isPlayerInTeam(match.team2, leagueTeamLower));
        const effectiveName = isLeagueMatch ? leagueTeam! : playerName;

        const oppName = getOpponentName(match, effectiveName);
        const rival = rivals.get(oppName) || { wins: 0, losses: 0 };
        if (won) rival.wins++; else rival.losses++;
        rivals.set(oppName, rival);

        const partnerName = getPartnerName(match, effectiveName);
        if (partnerName) {
            const partner = partners.get(partnerName) || { matches: 0, wins: 0, losses: 0 };
            partner.matches++;
            if (won) partner.wins++; else partner.losses++;
            partners.set(partnerName, partner);
        }
    });

    return {
        totalMatches,
        totalWins,
        totalLosses: totalMatches - totalWins,
        winrate: totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0,
        totalHits,
        averageHits: totalTrackedMatches > 0 ? Math.round((totalHits / totalTrackedMatches) * 100) / 100 : 0,
        currentWinStreak: streaks.current,
        bestWinStreak: streaks.best,
        categories,
        recentForm: history.filter(m => m.time > 0).slice(0, 10).map(m => m.won ? 'W' : 'L') as ('W' | 'L')[],
        matchHistory: history,
        rivals: Array.from(rivals.entries())
            .map(([name, rival]) => ({ name, wins: rival.wins, losses: rival.losses, matches: rival.wins + rival.losses }))
            .sort((a, b) => b.matches - a.matches)
            .slice(0, 5),
        partners: Array.from(partners.entries())
            .map(([name, partner]) => ({ name, matches: partner.matches, wins: partner.wins, losses: partner.losses }))
            .sort((a, b) => b.matches - a.matches)
            .slice(0, 5),
        extraStats,
    };
};

////////////////////////
// SPIELERUEBERGREIFEND //
////////////////////////
// Rekordhalter im Zeitverlauf: alle Spiele aller Spieler chronologisch durchgehen.
// Der Rekord wechselt nur, wenn jemand den Wert uebertrifft, bei Gleichstand bleibt er beim bisherigen Halter.
type RecordReign = { holder: string; from: number };

const getRecordReigns = memoize((data: GameData) => {
    const events: { time: number; name: string; won: boolean; hits: number }[] = [];
    getPlayerNamesFromData(data).names.forEach(name => {
        buildPlayerHistory(data, name).matchHistory.forEach(({ time, won, hits }) => events.push({ time, name, won, hits }));
    });
    events.sort((a, b) => a.time - b.time);

    const records = Object.fromEntries((['most-games', 'most-wins', 'most-hits', 'streak-record', 'loss-streak-record'] as RecordKey[])
        .map(key => [key, { value: 0, reigns: [] as RecordReign[] }])) as Record<RecordKey, { value: number; reigns: RecordReign[] }>;

    const update = (key: RecordKey, name: string, value: number, time: number) => {
        const record = records[key];
        if (value <= record.value) return;
        record.value = value;
        if (record.reigns[record.reigns.length - 1]?.holder !== name) record.reigns.push({ holder: name, from: time });
    };

    const players = new Map<string, { games: number; wins: number; hits: number; streak: number; losing: number }>();
    events.forEach(({ time, name, won, hits }) => {
        let player = players.get(name);
        if (!player) players.set(name, player = { games: 0, wins: 0, hits: 0, streak: 0, losing: 0 });

        player.games++;
        if (won) player.wins++;
        player.hits += hits;
        update('most-games', name, player.games, time);
        update('most-wins', name, player.wins, time);
        update('most-hits', name, player.hits, time);

        // Serien wie calculateStreaksFromResults nur ueber Spiele mit Zeitstempel
        if (time <= 0) return;
        player.streak = won ? player.streak + 1 : 0;
        player.losing = won ? 0 : player.losing + 1;
        update('streak-record', name, player.streak, time);
        update('loss-streak-record', name, player.losing, time);
    });

    return records;
});

const getPlayerBadges = (data: GameData, playerName: string, matchHistory: MatchHistoryEntry[]) => {
    const totalMatches = matchHistory.length;
    const totalWins = matchHistory.filter(m => m.won).length;
    const totalHits = matchHistory.reduce((a, m) => a + m.hits, 0);
    const streaks = calculateStreaksFromResults(matchHistory);
    const reigns = getRecordReigns(data);

    const getStanding = (key: RecordKey, own: number): RecordStanding => {
        const { value, reigns: history } = reigns[key];
        const lastOwnReign = history.map(reign => reign.holder).lastIndexOf(playerName);
        const isCurrent = lastOwnReign >= 0 && lastOwnReign === history.length - 1;
        return {
            own,
            record: value,
            holder: history[history.length - 1]?.holder ?? '',
            status: isCurrent ? 'current' : lastOwnReign >= 0 ? 'former' : 'never',
            until: lastOwnReign >= 0 && !isCurrent ? history[lastOwnReign + 1].from : null,
        };
    };

    return calculateBadges({
        data,
        playerName,
        allMatchHistory: matchHistory,
        totalMatches,
        totalWins,
        totalHits,
        winrate: totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0,
        records: {
            'most-games': getStanding('most-games', totalMatches),
            'most-wins': getStanding('most-wins', totalWins),
            'most-hits': getStanding('most-hits', totalHits),
            'streak-record': getStanding('streak-record', streaks.best),
            'loss-streak-record': getStanding('loss-streak-record', streaks.longestLosing),
        },
    });
};

// Freigeschaltete Badges aller Spieler, nach Badge-ID
const getBadgeHoldersById = memoize((data: GameData) => {
    const holders = new Map<string, string[]>();
    getPlayerNamesFromData(data).names.forEach(name => {
        const { matchHistory } = buildPlayerHistory(data, name);
        if (!matchHistory.length) return;
        getPlayerBadges(data, name, matchHistory)
            .filter(badge => !badge.locked)
            .forEach(badge => holders.set(badge.id, [...(holders.get(badge.id) ?? []), name]));
    });
    return holders;
});

export const getBadgeHolders = async (badgeId: string): Promise<string[]> =>
    [...(getBadgeHoldersById(await getGameData()).get(badgeId) ?? [])].sort();

// Freigeschaltete Badges einzelner Spieler, z.B. vor und nach dem Eintragen eines Spiels.
// Namen wie im Spiel eingetragen (Liga: Teamname), Schluessel ist der Profilname.
export const getUnlockedBadges = (data: GameData, names: string[]) => new Map(names.map(name => {
    const playerName = normalizePlayerNameForList(name);
    const { matchHistory } = buildPlayerHistory(data, playerName);
    const badges = matchHistory.length ? getPlayerBadges(data, playerName, matchHistory).filter(badge => !badge.locked) : [];
    return [playerName, badges];
}));

const getEloGames = memoize(buildEloGames);

// Elo-Rangliste wie auf der Weltranglisten-Seite (Spieler)
const getEloRecords = memoize((data: GameData) => {
    const now = Date.now();
    const records = computeElo(getEloGames(data), now, 'players');
    const ranking = getEloRanking(records, now);
    return {
        records: new Map(records.map(record => [record.key, record])),
        ranks: new Map(ranking.active.map(entry => [entry.key, entry.rank])),
        inactive: new Set(ranking.inactive.map(entry => entry.key)),
    };
});

// Aktuelles Elo eines Spielers (Liga: Teamname geht auch), null = noch kein gewertetes Spiel
export const getPlayerEloRating = (data: GameData, playerName: string): number | null =>
    getEloRecords(data).records.get(getEloPlayerKey(playerName))?.rating ?? null;

// Elo je Seite nach jedem Spiel, Schluessel = Match-_id
export const getMatchEloChanges = memoize((data: GameData) => getEloMatchChanges(getEloGames(data)));

const getPlayerElo = (data: GameData, playerName: string): PlayerEloSummary | null => {
    const { records, ranks, inactive } = getEloRecords(data);
    const key = getEloPlayerKey(playerName);
    const record = records.get(key);
    if (!record) return null;

    return {
        rank: ranks.get(key) ?? null,
        inactive: inactive.has(key),
        rating: record.rating,
        ratingChange: record.rating - (record.historyRatings[0] ?? ELO_START),
        peak: record.peak,
        games: record.games,
        historyRatings: record.historyRatings,
    };
};

////////////////////////
// PROFIL             //
////////////////////////
export const buildPlayerProfileData = (data: GameData, playerName: string, trendPeriod: TrendPeriod = 'all'): PlayerProfileData => {
    const { leagueTeam, matchHistory } = buildPlayerHistory(data, playerName);

    // Gewaehlter Zeitraum
    let filteredHistory = matchHistory;
    if (trendPeriod !== 'all') {
        const cutoff = Date.now() - TREND_PERIOD_DAYS[trendPeriod] * 24 * 60 * 60 * 1000;
        filteredHistory = matchHistory.filter(m => m.time > cutoff && m.time > 0);
    }

    // Kopfbereich und Badges immer ueber alle Spiele
    const firstGameTime = matchHistory
        .filter(m => m.time > 0)
        .reduce<number | null>((min, m) => (min === null || m.time < min ? m.time : min), null);

    return {
        name: playerName,
        leagueTeam,
        leagueStandings: getLeagueStandingsForPlayer(data.leagueGames, playerName),
        firstGameTime,
        allTimeMatches: matchHistory.length,
        elo: getPlayerElo(data, playerName),
        ...summarizeHistory(filteredHistory, playerName, leagueTeam),
        badges: matchHistory.length ? getPlayerBadges(data, playerName, matchHistory) : [],
    };
};

export const PROFILE_GAME_TYPE_SOURCES: Record<'1v1' | '2v2', string[]> = {
    '1v1': ['Offene Spiele 1v1', 'BiPo League', 'BiPo League Cup'],
    '2v2': ['Offene Spiele 2v2', 'BiPo Open Turniere'],
};

export const filterProfileDataByGameType = (data: PlayerProfileData, gameType: '1v1' | '2v2'): PlayerProfileData => {
    const sources = PROFILE_GAME_TYPE_SOURCES[gameType];
    const history = data.matchHistory.filter(m => sources.includes(m.source));
    return { ...data, ...summarizeHistory(history, data.name, data.leagueTeam) };
};
