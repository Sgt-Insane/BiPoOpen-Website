import { getLeagueList, getWithdrawnStandings } from './LeagueUtilFunctions';
import {
    MIN_SESSION_GAMES, buildGameTimeline, formatRecord, getBlowoutHighlight, getNakedMileHighlight, getStreakHighlight, getThrillerHighlight, getUnbeatenHighlight,
    getWinlessHighlight, pickHighlights,
    type GameSession, type GameSinglesDay, type HighlightThresholds, type SessionHighlight,
} from '@/components/shared/GameTimeline/gameTimeline';

// Liga-Spieltage: ein Block im Zeitstrahl (gameTimeline) mit Nummer, Final 4 und Tabellenaenderung.

export type Matchday = GameSession & {
    number: number;              // Spieltag-Nummer, 0 bei reinen Final-4-Abenden
    isFinalFour: boolean;        // nur Final-4-Spiele, keine Tabellenaenderung
};

export type MatchdayEntry = Matchday | GameSinglesDay;

// Hauptrunden-Spiele wie in LeagueTable: die ersten regularSeasonGameCount eingetragenen Spiele.
// leagueGames: neueste zuerst. Ohne Spielanzahl (Liga ohne Teams) zaehlt alles zur Hauptrunde.
export const getRegularSeasonGames = (leagueGames: Match[], regularSeasonGameCount: number) =>
    regularSeasonGameCount > 0 ? leagueGames.toReversed().toSpliced(regularSeasonGameCount) : leagueGames.toReversed();

// Zeitstrahl einer Liga, neueste zuerst. leagueGames: neueste zuerst.
// Abende nur mit Spielen nach der Hauptrunde sind Final-4-Abende und immer ein eigener Block, auch mit wenigen Spielen.
export const getMatchdayTimeline = (leagueGames: Match[], regularSeasonGameCount: number): MatchdayEntry[] => {
    const regularGames = new Set(getRegularSeasonGames(leagueGames, regularSeasonGameCount));
    const isFinalFour = (games: Match[]) => games.every(match => !regularGames.has(match));

    const timeline = buildGameTimeline(leagueGames, { isSession: games => games.length >= MIN_SESSION_GAMES || isFinalFour(games) });

    // Spieltage chronologisch durchnummerieren
    let matchdayNumber = 0;
    return timeline.toReversed().map((entry): MatchdayEntry => {
        if (entry.kind !== 'session')
            return entry;
        const finalFour = isFinalFour(entry.games);
        return { ...entry, isFinalFour: finalFour, number: finalFour ? 0 : ++matchdayNumber };
    }).reverse();
};

export type MatchdayTableRow = {
    name: string;
    position: number;            // 1-basiert
    change: number | null;       // + = aufgestiegen, null = keine Vorher-Tabelle (erster Spieltag)
    wins: number;
    losses: number;
    withdrawn: boolean;
};

// Tabelle nach dem Spieltag mit Platzveraenderung gegenueber vorher. regularGames: Hauptrunden-Spiele (getRegularSeasonGames).
export const getMatchdayTable = (
    regularGames: Match[],
    matchday: Pick<Matchday, 'games'>,
    leaguePlayers: LeaguePlayer[],
    withdrawnPlayers: LeaguePlayer[] = [],
): MatchdayTableRow[] => {
    // Abende liegen zeitlich hintereinander, die Grenzen ergeben sich aus erstem und letztem Spiel.
    const getTime = (match: Match) => match.time ?? Number.MAX_SAFE_INTEGER;
    const startTime = getTime(matchday.games[0]);
    const endTime = getTime(matchday.games.at(-1)!);
    const gamesBefore = regularGames.filter(match => getTime(match) < startTime);
    const gamesAfter = regularGames.filter(match => getTime(match) <= endTime);

    const before = getLeagueList(gamesBefore, leaguePlayers);
    const after = getLeagueList(gamesAfter, leaguePlayers);
    const positionBefore = new Map(before.map((standing, index) => [standing.name, index]));
    const hasTableBefore = gamesBefore.length > 0;

    return [
        ...after.map((standing, index) => ({
            name: standing.name,
            position: index + 1,
            change: hasTableBefore ? positionBefore.get(standing.name)! - index : null,
            wins: standing.wins,
            losses: standing.looses,
            withdrawn: false,
        })),
        ...getWithdrawnStandings(withdrawnPlayers, leaguePlayers.length).map(standing => ({
            name: standing.name,
            position: standing.placement! + 1,
            change: hasTableBefore ? 0 : null,
            wins: 0,
            losses: 0,
            withdrawn: true,
        })),
    ];
};

const JUMP_PLACES = 3;

// Liga-Teams spielen pro Spieltag nur 2 bis 4 Spiele: 2–0 ist schon eine Geschichte
const LEAGUE_THRESHOLDS: HighlightThresholds = { unbeatenWins: 2, winlessLosses: 2, streakWins: 3 };

// Bis zu drei Geschichten eines Spieltags in Prioritaet: nackte Meile, neuer Tabellenfuehrer, ungeschlagen, Krimi,
// Tabellensprung, Deklassierung, Siegesserie, leer ausgegangen.
// table: Tabelle nach dem Spieltag (getMatchdayTable), null bei Final-4-Abenden.
export const getMatchdayHighlights = (
    matchday: Pick<Matchday, 'games' | 'records'>,
    table: MatchdayTableRow[] | null,
    getDisplayName: (teamName: string) => string = name => name,
): SessionHighlight[] => {
    const leader = table?.[0];
    const newLeader = leader && leader.change !== null && leader.change > 0 ? leader : null;
    let unbeaten = getUnbeatenHighlight(matchday.records, LEAGUE_THRESHOLDS.unbeatenWins, 'Teams', getDisplayName);

    // Neuer Tabellenfuehrer, der als Einziger ungeschlagen bleibt: eine Zeile statt zwei
    const leaderRecord = newLeader && matchday.records.find(record => record.name.toLocaleLowerCase() === newLeader.name.toLocaleLowerCase());
    const leaderUnbeaten = !!leaderRecord && unbeaten?.names.length === 1 && unbeaten.names[0] === leaderRecord.name;
    const leaderHighlight = newLeader
        ? {
            kind: 'leader',
            names: [newLeader.name],
            text: leaderUnbeaten
                ? `${getDisplayName(newLeader.name)} übernimmt ungeschlagen die Tabellenführung ${formatRecord(leaderRecord!.wins, 0)}`
                : `${getDisplayName(newLeader.name)} übernimmt die Tabellenführung`,
        }
        : null;
    if (leaderUnbeaten)
        unbeaten = null;

    // Groesster Sprung in der Tabelle, nicht fuer Teams, die schon genannt sind (Tabellenfuehrer, ungeschlagen)
    const named = new Set([newLeader?.name, ...(unbeaten?.names ?? [])].filter(Boolean).map(name => name!.toLocaleLowerCase()));
    const jump = table
        ?.filter(row => (row.change ?? 0) >= JUMP_PLACES && !named.has(row.name.toLocaleLowerCase()))
        .sort((a, b) => b.change! - a.change!)[0];
    const jumpHighlight = jump
        ? { kind: 'jump', names: [jump.name], text: `${getDisplayName(jump.name)} springt ${jump.change} Plätze nach oben` }
        : null;

    return pickHighlights([
        getNakedMileHighlight(matchday.games, getDisplayName),
        leaderHighlight,
        unbeaten,
        getThrillerHighlight(matchday.games, getDisplayName),
        jumpHighlight,
        getBlowoutHighlight(matchday.games, getDisplayName),
        getStreakHighlight(matchday.records, LEAGUE_THRESHOLDS.streakWins, getDisplayName),
        getWinlessHighlight(matchday.records, LEAGUE_THRESHOLDS.winlessLosses, getDisplayName),
    ]);
};
