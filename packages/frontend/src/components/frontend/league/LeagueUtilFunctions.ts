import axios from "axios";
import { getDemoGames } from "@/util/demoGames";
import { LEAGUE_SEASONS, LEGACY_LEAGUE, LEGACY_SEASON_SLUG, getRegularSeasonGameCount, toLeaguePlayers, type LeagueDivision } from "./LeagueSeasonsData";

/////////////
// GENERAL //
/////////////
export const getAllLeagueGames = async () => {
    let response = await axios.get("/leagueGames/get");
    if(response.status == 200)
        return [...response.data.leagueGames as Match[], ...getDemoGames('league')];

    return [];
}

export const addLeagueGame = async (leagueGame:Match) => {
    let response = await axios.post("/leagueGames/create", leagueGame);
    return response.status == 201
}

export const updateLeagueGame = async (leagueGame:Match) => {
    let response = await axios.patch("/leagueGames/update/" + leagueGame._id, leagueGame);
    return response.status == 201;
}

export const deleteLeagueGame = async (leagueGame: Match) => {
    let response = await axios.delete("/leagueGames/delete/" + leagueGame._id);
    return response.status == 200;
}

////////////////////////
// SAISON / LIGA      //
////////////////////////
// Altdaten haben kein season/league Feld und gehoeren zur ersten Liga der Saison 2025/26.
export const getGameSeason = (match: Match) => match.season ?? LEGACY_SEASON_SLUG;

export const getGameLeague = (match: Match) => match.league ?? LEGACY_LEAGUE;

// Pokalspiele (cupId gesetzt) gehoeren nicht in Liga-Tabellen und Liga-Spielelisten.
export const isCupGame = (match: Match) => !!match.cupId;

export const filterLeagueGames = (leagueGames: Match[], seasonSlug: string, league: number) =>
    leagueGames.filter(match => !isCupGame(match) && getGameSeason(match) === seasonSlug && getGameLeague(match) === league);

// Final Four: Halbfinale 1. gegen 4. und 2. gegen 3., danach das Finale, jeweils Best of 3.
const getSeriesTeamNames = (team: Team | undefined) => team
    ? [team.name, ...team.players.map(player => player.name)].filter(Boolean).map(name => name!.toLocaleLowerCase())
    : [];

// Punkte eines Spiels aus Sicht von team1 der Serie (das Spiel kann die Teams vertauscht eingetragen haben).
export const getSeriesGameScores = (match: Match, team1: Team) => {
    const matchTeam1Score = match.team1.players.reduce((score, player) => score + (player.score ?? 0), 0);
    const matchTeam2Score = match.team2.players.reduce((score, player) => score + (player.score ?? 0), 0);
    const matchUsesTeam1 = getSeriesTeamNames(match.team1).some(name => getSeriesTeamNames(team1).includes(name));
    return matchUsesTeam1
        ? { team1Score: matchTeam1Score, team2Score: matchTeam2Score }
        : { team1Score: matchTeam2Score, team2Score: matchTeam1Score };
};

export const getSeriesResult = (games: Match[], team1: Team | undefined, team2: Team | undefined) => {
    if (!team1 || !team2)
        return { winner: undefined, loser: undefined, games: [] as Match[], team1Wins: 0, team2Wins: 0 };

    const team1Names = getSeriesTeamNames(team1);
    const team2Names = getSeriesTeamNames(team2);
    const seriesGames = games.filter(match => {
        const matchTeam1Names = getSeriesTeamNames(match.team1);
        const matchTeam2Names = getSeriesTeamNames(match.team2);
        return matchTeam1Names.some(name => team1Names.includes(name)) && matchTeam2Names.some(name => team2Names.includes(name))
            || matchTeam1Names.some(name => team2Names.includes(name)) && matchTeam2Names.some(name => team1Names.includes(name));
    }).slice(0, 3);
    let team1Wins = 0;
    let team2Wins = 0;

    seriesGames.forEach(match => {
        const { team1Score, team2Score } = getSeriesGameScores(match, team1);
        if (team1Score > team2Score)
            team1Wins++;
        else if (team2Score > team1Score)
            team2Wins++;
    });

    return {
        winner: team1Wins >= 2 ? team1 : team2Wins >= 2 ? team2 : undefined,
        loser: team1Wins >= 2 ? team2 : team2Wins >= 2 ? team1 : undefined,
        games: seriesGames,
        team1Wins,
        team2Wins,
    };
};

export type SeriesResult = ReturnType<typeof getSeriesResult>;

export const getSeriesTeamName = (team: Team | undefined, placeholder: string) => {
    if (!team)
        return placeholder;

    return team.name || team.players.map(player => player.name.trim()).filter(Boolean).join(' & ') || placeholder;
};

// Endstand einer Liga in einer Saison: Tabelle der Hauptrunde, nach gespieltem Final Four dessen Ergebnis.
// finalRanking (Teamnamen): Meister, Finalist, Halbfinal-Verlierer nach Setzplatz, dann der Rest der Tabelle.
// null, solange das Finale nicht entschieden ist.
export const getDivisionResult = (leagueGames: Match[], seasonSlug: string, division: LeagueDivision) => {
    const regularSeasonGameCount = getRegularSeasonGameCount(division);
    const divisionGames = filterLeagueGames(leagueGames, seasonSlug, division.league)
        .sort((match1, match2) => (match1.time ?? 0) - (match2.time ?? 0));
    const regularSeasonGames = divisionGames.slice(0, regularSeasonGameCount);
    const finalFourGames = divisionGames.slice(regularSeasonGameCount);
    const table = getLeagueList(regularSeasonGames, toLeaguePlayers(division.teams));

    const noResult = { table, champion: undefined as string | undefined, finalGames: [] as Match[], finalRanking: null as string[] | null };

    // Final Four startet erst, wenn die Hauptrunde komplett gespielt ist.
    if (!division.hasFinalFour || regularSeasonGameCount === 0 || regularSeasonGames.length < regularSeasonGameCount || table.length < 4)
        return noResult;

    const playerNameByTeam = (teamName: string) =>
        division.teams.find(team => team.teamName === teamName)?.playerName ?? teamName;
    const seeds = table.slice(0, 4).map(standing => ({
        _id: '',
        name: standing.name,
        players: [{ _id: '', name: playerNameByTeam(standing.name), score: 0 }],
    } as Team));

    const semiFinal1 = getSeriesResult(finalFourGames, seeds[0], seeds[3]);
    const semiFinal2 = getSeriesResult(finalFourGames, seeds[1], seeds[2]);
    const final = getSeriesResult(finalFourGames, semiFinal1.winner, semiFinal2.winner);
    if (!final.winner || !final.loser || !final.games.length)
        return noResult;

    const semiFinalLosers = [semiFinal1.loser!, semiFinal2.loser!].sort((team1, team2) => seeds.indexOf(team1) - seeds.indexOf(team2));
    return {
        table,
        champion: final.winner.name!,
        finalGames: final.games,
        finalRanking: [final.winner, final.loser, ...semiFinalLosers].map(team => team.name!)
            .concat(table.slice(4).map(standing => standing.name)),
    };
};

// Team, Liga und Platzierung fuer jede Saison, in der der Spieler gemeldet ist (neueste zuerst).
// Platz nach dem Final Four, solange das nicht entschieden ist nach der Hauptrunden-Tabelle.
// null, solange das Team noch kein Spiel hat.
export const getLeagueStandingsForPlayer = (leagueGames: Match[], playerName: string): LeagueStanding[] => {
    const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

    return [...LEAGUE_SEASONS].reverse().flatMap(season => season.divisions.flatMap(division => {
        const team = division.teams.find(team => normalizeName(team.playerName) === normalizeName(playerName));
        if (!team) return [];

        const { table, champion, finalRanking } = getDivisionResult(leagueGames, season.slug, division);
        const entry = table.find(player => player.name === team.teamName);
        const tablePlacement = entry && entry.ammountOfMatches > 0 ? entry.placement! + 1 : null;
        const finalPlacement = finalRanking ? finalRanking.indexOf(team.teamName) + 1 : 0;

        return [{
            teamName: team.teamName,
            seasonSlug: season.slug,
            league: division.league,
            divisionLabel: division.label,
            seasonLabel: season.label,
            placement: finalPlacement || tablePlacement,
            champion: champion === team.teamName,
        }];
    }));
}


////////////////
// STATISTICS //
////////////////
export const getPlayersWithStats = (leagueGames:Match[], leaguePlayers: LeaguePlayer[]) => {
    let playerWithStats:PlayerWithStats[] = [];

    leaguePlayers.forEach((leaguePlayer) => {
        let name = leaguePlayer.name.toLocaleLowerCase();

        let ammountOfMatches = getMatchesFromPlayer(leagueGames, name).length;
        let ammountOfHitsFromPlayer = getAmmountOfHitsFromPlayer(leagueGames, name);
        let ammountOfEnemyHitsFromPlayer = getAmmountOfEnemyHitsFromPlayer(leagueGames, name);
        let wins = getAmmountOfWinsFromPlayer(leagueGames, name);

        let player = {
            name: leaguePlayer.name,
            ammountOfMatches: ammountOfMatches,
            ammountOfMatchesWithTrackedShots: ammountOfMatches,
            ammountOfDrunkenCups: getAmmountOfDrunkenCupsFromPlayer(leagueGames, name),
            wins: wins,
            looses: ammountOfMatches - wins,
            averageWins: Math.round((ammountOfMatches == 0 ? 0 : wins / ammountOfMatches) * 100),
            hits: ammountOfHitsFromPlayer,
            averageHits: ammountOfMatches === 0 ? 0 : ammountOfHitsFromPlayer / ammountOfMatches,
            hitDifference: ammountOfHitsFromPlayer + " : " + ammountOfEnemyHitsFromPlayer,
            hitDifferenceNumber: ammountOfHitsFromPlayer - ammountOfEnemyHitsFromPlayer
        };

        playerWithStats.push(player); 
    });
    
    return playerWithStats;
}

export const getMatchesFromPlayer = (leagueGames:Match[], playerName:string) => { 
    let matchesFromPlayer:Match[] = [];

    leagueGames.forEach((leagueGame) => {
        if(leagueGame.team1!.players.map(player => player.name.toLowerCase()).includes(playerName) || leagueGame.team2!.players.map(player => player.name.toLowerCase()).includes(playerName)){
            if(leagueGame.team1!.players.length == 1 && leagueGame.team2!.players.length == 1){
                matchesFromPlayer.push(leagueGame);
            }
        }
    });

    return matchesFromPlayer;
}

// Ergebnisse der letzten Spiele eines Spielers, aeltestes zuerst: 'W' = Sieg, 'L' = Niederlage.
// Spiele ohne Zeit zaehlen als neueste, wie in splitLeagueGamesByRound.
export const getRecentForm = (leagueGames:Match[], playerName:string, count = 5) => {
    const name = playerName.toLowerCase();
    const getScore = (team: Match['team1']) => team.players.reduce((acc, player) => acc + player.score, 0);

    return getMatchesFromPlayer(leagueGames, name)
        .map((match, index) => ({ match, index }))
        .sort((a, b) => (a.match.time ?? Number.MAX_SAFE_INTEGER) - (b.match.time ?? Number.MAX_SAFE_INTEGER) || a.index - b.index)
        .slice(-count)
        .map(({ match }) => {
            const isTeam1 = match.team1.players.some(player => player.name.toLowerCase() === name);
            const ownScore = getScore(isTeam1 ? match.team1 : match.team2);
            const enemyScore = getScore(isTeam1 ? match.team2 : match.team1);
            return ownScore > enemyScore ? 'W' : 'L';
        });
}

export const getAmmountOfWinsFromPlayer = (leagueGames:Match[], playerName:string) => {
    let wins = 0;
    
    let matches = getMatchesFromPlayer(leagueGames, playerName);
    
    matches.forEach((match) => {
        if((match.team1!.players.map(player => player.name.toLowerCase()).includes(playerName))){
            let team1Score = match.team1!.players.reduce((acc, player) => acc + player.score, 0);
            let team2Score = match.team2!.players.reduce((acc, player) => acc + player.score, 0);
            if(team1Score > team2Score)
                wins ++;
        }

        if((match.team2!.players.map(player => player.name.toLowerCase()).includes(playerName))){
            let team1Score = match.team1!.players.reduce((acc, player) => acc + player.score, 0);
            let team2Score = match.team2!.players.reduce((acc, player) => acc + player.score, 0);
            if(team2Score > team1Score)
                wins ++;
        }
    });

    return wins;
}

export const getAmmountOfHitsFromPlayer = (leagueGames:Match[], playerName:string) => {
    let score = 0;

    let matches = getMatchesFromPlayer(leagueGames, playerName);

    matches.forEach((match) => {
        if(match.team1.players.map(player => player.name.toLowerCase()).includes(playerName))
            score += match.team1.players.find(player => player.name.toLowerCase() == playerName)!.score;
        if(match.team2.players.map(player => player.name.toLowerCase()).includes(playerName))
            score += match.team2.players.find(player => player.name.toLowerCase() == playerName)!.score;
    });

    return score;
}

export const getAmmountOfEnemyHitsFromPlayer = (leagueGames:Match[], playerName:string) => {
    let enemyScore = 0;

    let matches = getMatchesFromPlayer(leagueGames, playerName);
    
    matches.forEach((match) => {
        if(match.team1.players.map(player => player.name.toLowerCase()).includes(playerName))
            enemyScore += match.team2.players.reduce((acc, player) => acc + player.score, 0);
        if(match.team2.players.map(player => player.name.toLowerCase()).includes(playerName))
            enemyScore += match.team1.players.reduce((acc, player) => acc + player.score, 0);
    });

    return enemyScore;
}

export const getAmmountOfDrunkenCupsFromPlayer = (openGames:Match[], playerName:string) => {
    // let leftOverCups = 0;
    // let enemyHits = 0;

    // let matches = getMatchesFromPlayer(openGames, playerName);

    // matches.forEach((match) => {
    //     // Getroffene Becher vom Gegner die Getrunken wurden
    //     if(match.team1.name == teamName)
    //         enemyHits += match.result.team2Score;               
    //     if(match.team2.name == teamName)
    //         enemyHits += match.result.team1Score;           

    //     // Stehengebliebene Becher vom Gegner bei Niederlage
    //     if(match.team1.name == teamName && match.result.team1Score < match.result.team2Score)
    //         leftOverCups += match.result.team2Score - match.result.team1Score;
    //     if(match.team2.name == teamName && match.result.team1Score > match.result.team2Score)
    //         leftOverCups += match.result.team1Score - match.result.team2Score;
    // });

    // return (leftOverCups + enemyHits);

    return 1;
}


export const getLeagueList = (leagueMatches:Match[], leaguePlayers:LeaguePlayer[]) => {
    let playersWithStats = getPlayersWithStats(leagueMatches, leaguePlayers);

    // Sort after wins, hit difference and direct win against component
    playersWithStats.sort((player1, player2) => {
        // 1. Priorität: Anzahl der Siege (wins)
        if (player1.wins !== player2.wins) {
            return player2.wins - player1.wins;
        }

        // 2. Priorität: Trefferdifferenz (hitDifferenceNumber)
        if (player1.hitDifferenceNumber !== player2.hitDifferenceNumber) {
            return player2.hitDifferenceNumber - player1.hitDifferenceNumber;
        }

        // 3. Priorität: Erzielte Treffer (Mehr ist besser)
        // HINWEIS: Ersetze 'hitsWon' mit deiner Variable für die eigenen Treffer
        const p1OwnHits = parseInt(player1.hitDifference.split(':')[0]);
        const p2OwnHits = parseInt(player2.hitDifference.split(':')[0]);

        return p2OwnHits - p1OwnHits;
    });
    

    // Set placement
    for (let i = 0; i < playersWithStats.length; i++) {
        playersWithStats[i].placement = i;

        let playersWithSameScore = playersWithStats.filter((player) => 
            player.wins == playersWithStats[i].wins && 
            player.hitDifferenceNumber == playersWithStats[i].hitDifferenceNumber &&
            player.hitDifference.split(':')[0] == playersWithStats[i].hitDifference.split(':')[0]
        )
        if(playersWithSameScore.length > 1){
            playersWithSameScore.forEach((playerWithSameScore) => {
                playerWithSameScore.placement = playersWithSameScore[0].placement;
            });
        }
    }

    return playersWithStats;
}

const getLeagueMatchupKey = (match: Match) => {
    const team1Name = match.team1.players[0]?.name?.toLocaleLowerCase() ?? '';
    const team2Name = match.team2.players[0]?.name?.toLocaleLowerCase() ?? '';

    return [team1Name, team2Name].sort().join('::');
}

export const splitLeagueGamesByRound = (leagueMatches: Match[]) => {
    const sorted1v1Matches = leagueMatches
        .filter((match) => match.team1.players.length === 1 && match.team2.players.length === 1)
        .map((match, index) => ({ match, index }))
        .sort((a, b) => {
            const aTime = a.match.time ?? Number.MAX_SAFE_INTEGER;
            const bTime = b.match.time ?? Number.MAX_SAFE_INTEGER;

            if (aTime !== bTime)
                return aTime - bTime;

            return a.index - b.index;
        })
        .map(entry => entry.match);

    const matchCountsByMatchup: Record<string, number> = {};
    const hinrunde: Match[] = [];
    const rueckrunde: Match[] = [];

    sorted1v1Matches.forEach((match) => {
        const matchupKey = getLeagueMatchupKey(match);
        const playedCount = (matchCountsByMatchup[matchupKey] || 0) + 1;
        matchCountsByMatchup[matchupKey] = playedCount;

        if (playedCount === 1)
            hinrunde.push(match);
        if (playedCount === 2)
            rueckrunde.push(match);
    });

    return {
        hinrunde,
        rueckrunde
    };
}

// Untertitel beim Eintragen, z.B. "BiPo League · 1. Liga · Hinrunde".
// Hinrunde, bis jede Paarung einmal gespielt ist (wie LeagueDrawDrawer), danach Rueckrunde. divisionGames: neueste zuerst.
export const getLeagueGameSubtitle = (division: LeagueDivision, divisionGames: Match[]) => {
    const teamCount = division.teams.length;
    const regularSeasonGameCount = getRegularSeasonGameCount(division);
    const regularSeasonGames = divisionGames.toReversed().toSpliced(regularSeasonGameCount);
    const hinrundeGameCount = teamCount * (teamCount - 1) / 2;
    const round = regularSeasonGames.length >= regularSeasonGameCount
        ? (division.hasFinalFour ? 'Final Four' : '')
        : splitLeagueGamesByRound(regularSeasonGames).hinrunde.length >= hinrundeGameCount ? 'Rückrunde' : 'Hinrunde';
    return ['BiPo League', division.label, round].filter(part => part).join(' · ');
}

// Gegner je Team aus den Spielen einer Runde. Namen kleingeschrieben wie in getLeagueMatchupKey.
export const getPlayedOpponents = (roundMatches: Match[]) => {
    const playedOpponents = new Map<string, Set<string>>();

    const addOpponent = (teamName: string, opponentName: string) => {
        if (!playedOpponents.has(teamName))
            playedOpponents.set(teamName, new Set());
        playedOpponents.get(teamName)!.add(opponentName);
    }

    roundMatches.forEach((match) => {
        const team1Name = match.team1.players[0]?.name?.toLocaleLowerCase() ?? '';
        const team2Name = match.team2.players[0]?.name?.toLocaleLowerCase() ?? '';

        addOpponent(team1Name, team2Name);
        addOpponent(team2Name, team1Name);
    });

    return playedOpponents;
}
