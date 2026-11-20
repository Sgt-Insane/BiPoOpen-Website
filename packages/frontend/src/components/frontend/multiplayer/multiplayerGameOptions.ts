import { CURRENT_SEASON_SLUG, getRegularSeasonGameCount, getSeason } from '../league/LeagueSeasonsData';
import { filterLeagueGames, getAllLeagueGames, getLeagueGameSubtitle } from '../league/LeagueUtilFunctions';
import { getLeagueTeamLogo } from '../league/LeaguePlayersData';
import { getCupGames, getCupRoundGames, getLeagueCup, getPairingResult, getPlannedRoundNames } from '../league/cup/LeagueCupUtilFunctions';
import { normalizeTeams } from '../biPoKnecht/KnechtUtilFunctions';
import { getCurrentLeagueTeam } from './useProfile';
import { getTeamPlayers, type MpGameKind, type MpPlayer } from './multiplayerTypes';

// Welche Spiele die Spieler der Lobby gerade machen koennen: immer ein offenes Spiel,
// im 1 gegen 1 zusaetzlich ein noch offenes Liga-Spiel bzw. eine offene Pokal-Paarung ihrer Teams.

export type { MpGameKind };
export type MpGameOption = { kind: MpGameKind; label: string; detail: string; match: Match };

const toTeam = (name: string, logo?: string): Team => ({
    _id: 'placeholder',
    ...(logo && { logo }),
    players: [{ _id: 'placeholder', name, score: 0 }],
});

export const buildOpenMatch = (players: MpPlayer[]): Match => normalizeTeams({
    _id: 'placeholder',
    team1: { _id: 'placeholder', players: getTeamPlayers(players, 0).map(player => ({ _id: 'placeholder', name: player.name, score: 0 })) },
    team2: { _id: 'placeholder', players: getTeamPlayers(players, 1).map(player => ({ _id: 'placeholder', name: player.name, score: 0 })) },
});

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

const countGamesBetween = (games: Match[], teamA: string, teamB: string) => games.filter(match => {
    const names = [match.team1.players[0]?.name ?? '', match.team2.players[0]?.name ?? ''];
    return names.some(name => sameName(name, teamA)) && names.some(name => sameName(name, teamB));
}).length;

export const getGameOptions = async (players: MpPlayer[]): Promise<MpGameOption[]> => {
    const options: MpGameOption[] = [{ kind: 'open', label: 'Offenes Spiel', detail: 'Zählt für die Weltrangliste', match: buildOpenMatch(players) }];

    const [home, away] = [getTeamPlayers(players, 0), getTeamPlayers(players, 1)];
    if (home.length !== 1 || away.length !== 1) return options;

    const teams = [getCurrentLeagueTeam(home[0].name), getCurrentLeagueTeam(away[0].name)];
    if (!teams[0] || !teams[1] || sameName(teams[0].teamName, teams[1].teamName)) return options;
    const [team1, team2] = teams as NonNullable<typeof teams[number]>[];
    const season = getSeason(CURRENT_SEASON_SLUG);
    if (!season) return options;

    let leagueGames: Match[];
    try {
        leagueGames = await getAllLeagueGames();
    } catch {
        return options;
    }
    const teamMatch = (extra: Partial<Match>): Match => ({
        _id: 'placeholder',
        ...extra,
        team1: toTeam(team1.teamName, getLeagueTeamLogo(team1.teamName, season.slug)),
        team2: toTeam(team2.teamName, getLeagueTeamLogo(team2.teamName, season.slug)),
    });

    // Liga: gleiche Liga, Hin- und Rueckspiel noch nicht beide gespielt, Hauptrunde laeuft noch
    if (team1.league === team2.league) {
        const division = season.divisions.find(entry => entry.league === team1.league);
        const divisionGames = filterLeagueGames(leagueGames, season.slug, team1.league);
        const played = countGamesBetween(divisionGames, team1.teamName, team2.teamName);
        if (division && played < 2 && divisionGames.length < getRegularSeasonGameCount(division)) {
            const newestFirst = [...divisionGames].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
            options.push({
                kind: 'league',
                label: 'Liga-Spiel',
                detail: `${getLeagueGameSubtitle(division, newestFirst)} · ${played === 0 ? 'Hinspiel' : 'Rückspiel'}`,
                match: teamMatch({ season: season.slug, league: team1.league }),
            });
        }
    }

    // Pokal: offene Paarung der laufenden Runde
    if (season.hasCup) {
        try {
            const cup = await getLeagueCup(season.slug);
            const roundIndex = (cup?.rounds.length ?? 0) - 1;
            const round = cup?.rounds[roundIndex];
            const pairing = round?.pairings.find(entry =>
                (sameName(entry.team1, team1.teamName) && sameName(entry.team2, team2.teamName))
                || (sameName(entry.team1, team2.teamName) && sameName(entry.team2, team1.teamName)));
            if (cup && round && pairing) {
                const roundGames = getCupRoundGames(getCupGames(leagueGames, cup), roundIndex);
                if (!getPairingResult(pairing, roundGames, round.bestOf).winner) {
                    const roundName = getPlannedRoundNames(cup.participants.length)[roundIndex];
                    options.push({
                        kind: 'cup',
                        label: 'Cup-Spiel',
                        detail: ['League Cup', roundName, round.bestOf > 1 ? `Best of ${round.bestOf}` : ''].filter(Boolean).join(' · '),
                        match: teamMatch({ season: cup.season, cupId: cup._id, cupRound: roundIndex }),
                    });
                }
            }
        } catch { /* ohne Pokal-Daten nur Liga / offen */ }
    }

    return options;
};
