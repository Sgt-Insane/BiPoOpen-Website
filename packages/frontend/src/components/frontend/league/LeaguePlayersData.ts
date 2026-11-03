import { LEAGUE_SEASONS, LEGACY_SEASON_SLUG, getSeason, getSeasonTeams } from './LeagueSeasonsData';

export type LeaguePlayerData = {
    teamName: string;
    playerName: string;
    logo: string;
};

// Abgeleitet aus LeagueSeasonsData: alle Teams ueber alle Saisons und Ligen, dedupliziert.
// Saisonuebergreifende Konsumenten (Spielerprofil, Badges, OG-Bilder) nutzen weiterhin diese Liste.
export const LEAGUE_PLAYER_DATA: LeaguePlayerData[] = (() => {
    const teamsByName = new Map<string, LeaguePlayerData>();

    LEAGUE_SEASONS.forEach((season) => {
        season.divisions.forEach((division) => {
            division.teams.forEach(({ teamName, playerName, logo }) => {
                // Neuere Saisons stehen weiter hinten und gewinnen bei gleichem Teamnamen.
                teamsByName.set(teamName, { teamName, playerName, logo });
            });
        });
    });

    return [...teamsByName.values()];
})();

const normalizeName = (value: string): string =>
    value
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

export const getLeagueTeamForPlayer = (playerName: string): string | null => {
    for (const entry of LEAGUE_PLAYER_DATA) {
        if (normalizeName(entry.playerName) === normalizeName(playerName)) return entry.teamName;
    }
    return null;
};

export const getPlayerForLeagueTeam = (teamName: string): string | null => {
    const exact = LEAGUE_PLAYER_DATA.find(entry => entry.teamName === teamName);
    if (exact) return exact.playerName;

    const normalizedTeamName = normalizeName(teamName);
    for (const entry of LEAGUE_PLAYER_DATA) {
        if (normalizeName(entry.teamName) === normalizedTeamName) return entry.playerName;
    }

    return null;
};

// Team-Logo aus LeagueSeasonsData, zuerst aus der angegebenen Saison, sonst saisonuebergreifend.
export const getLeagueTeamLogo = (teamName: string, seasonSlug?: string): string | undefined => {
    const normalizedTeamName = normalizeName(teamName);
    const seasonTeam = getSeasonTeams(getSeason(seasonSlug)).find(team => normalizeName(team.teamName) === normalizedTeamName);
    if (seasonTeam) return seasonTeam.logo;

    return LEAGUE_PLAYER_DATA.find(entry => normalizeName(entry.teamName) === normalizedTeamName)?.logo;
};

// Liga-/Pokalspiele speichern das Team nur als Spielername. Ohne explizites Logo wuerde Avatar ueber den
// Namen aufloesen und bei gleichnamigen Spielern (z.B. "Michael Weck") das Profilbild statt des Team-Logos zeigen.
export const withLeagueTeamLogos = (match: Match): Match => {
    if (match.team1?.players.length !== 1 || match.team2?.players.length !== 1)
        return match;

    const seasonSlug = match.season ?? LEGACY_SEASON_SLUG;
    const withLogo = (team: Team): Team => {
        if (team.logo) return team;
        const logo = getLeagueTeamLogo(team.players[0].name, seasonSlug);
        return logo ? { ...team, logo } : team;
    };

    return { ...match, team1: withLogo(match.team1), team2: withLogo(match.team2) };
};
