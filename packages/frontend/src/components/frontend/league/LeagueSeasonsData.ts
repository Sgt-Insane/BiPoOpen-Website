import { winterThemeActive } from '@/components/shared/winter/winterTheme';

export type LeagueTeam = {
    teamName: string;        // Name, unter dem die Spiele gespeichert sind und der ueberall angezeigt wird
    shortName?: string;      // Abkuerzung sehr langer Namen, nur in der Ligatabelle (Spalte auf dem Handy zu schmal)
    playerName: string;
    logo: string;
    // Waehrend der Saison ausgestiegen: Spiele wurden geloescht, das Team spielt nicht mehr mit
    // und steht fest auf dem letzten Tabellenplatz (zaehlt damit als Absteiger).
    withdrawn?: boolean;
};

export type LeagueDivision = {
    league: number;          // Wert, der am Spiel in der DB landet: 1 | 2
    label: string;           // "1. Liga"
    teams: LeagueTeam[];
    hasFinalFour: boolean;
    finalFourSeeds: number;      // sportlich: wer sich fuer das Final Four qualifiziert (Seeding + Badges)
    highlightTopSlots: number;   // optisch: wie viele Plaetze oben blau eingefaerbt werden
    promotionSlots: number;      // Aufstiegsplaetze (gruen) - nur 2. Liga
    relegationSlots: number;     // Abstiegsplaetze (rot) am Tabellenende
};

export type LeagueSeason = {
    slug: string;            // "2025-26" -> URL-Segment
    label: string;           // "2025/26" -> Untertitel
    divisions: LeagueDivision[];
    hasCup?: boolean;        // League Cup als eigener Reiter neben den Ligen
};

// Optionales Winter-Logo: gilt, solange das Winter-Theme laeuft (15.11. bis 6.1.), danach automatisch wieder das normale.
const teamLogo = (fileName: string, winterFileName?: string) => {
    const file = winterThemeActive && winterFileName ? winterFileName : fileName;
    return new URL(`/src/assets/league/teams/${file}`, import.meta.url).href;
};

// Single source of truth: Saison -> Liga -> Teams.
export const LEAGUE_SEASONS: LeagueSeason[] = [
    {
        slug: '2025-26',
        label: '2025/26',
        divisions: [
            {
                league: 1,
                label: '1. Liga',
                hasFinalFour: true,
                finalFourSeeds: 4,
                highlightTopSlots: 4,
                promotionSlots: 0,
                relegationSlots: 3,
                teams: [
                    { teamName: 'Hangover Heroes', playerName: 'David Jones', logo: teamLogo('Hangover-Heroes.webp') },
                    { teamName: 'Hopfenstreife', playerName: 'Jonas Weck', logo: teamLogo('Hopfenstreife.webp') },
                    { teamName: 'Cupfire Squad', playerName: 'Matthias Weck', logo: teamLogo('Cupfire-Squad.webp') },
                    { teamName: 'Lokomotive Wiedenbrück', playerName: 'Simon Weck', logo: teamLogo('Lokomotive-Wiedenbrueck.webp', 'Lokomotive-Wiedenbrueck-Winter.webp') },
                    { teamName: 'Don Promillo', playerName: 'Patrick Pohlmann', logo: teamLogo('Don-Promillo.webp') },
                    { teamName: 'Wonne', playerName: 'Daniel Wonnemann', logo: teamLogo('Wonne.webp') },
                    { teamName: 'El Gunto', playerName: 'Matthias Gunter', logo: teamLogo('El-Gunto.webp') },
                    { teamName: 'BPC Likör', playerName: 'Leon Rose', logo: teamLogo('BPC-Likoer.webp') },
                    { teamName: 'Schlauti Saufmann', playerName: 'Sara Schlautmann', logo: teamLogo('Schlauti-Saufmann.webp') },
                    { teamName: 'FC Pongus Longus', playerName: 'Jerome Campigotto', logo: teamLogo('FC-Pongus-Longus.webp') },
                    { teamName: 'BPC Knick', playerName: 'Nick Brinkrolf', logo: teamLogo('BPC-Knick.webp') },
                    { teamName: 'Ostgold', playerName: 'Giulia Sanio', logo: teamLogo('Ostgold.webp') },
                    { teamName: 'Schaufautomat', playerName: 'Jens Schauf', logo: teamLogo('BPC-Schauf.webp') },
                    { teamName: 'Anime Dude', playerName: 'Fritz Falkenreck', logo: teamLogo('Anime-Dude.webp') },
                    { teamName: 'SallyWin All-in', playerName: 'Sally Hollenbeck', logo: teamLogo('SallyWin-All-in.webp') },
                ],
            },
        ],
    },
    {
        slug: '2026-27',
        label: '2026/27',
        hasCup: true,
        divisions: [
            {
                league: 1,
                label: '1. Liga',
                hasFinalFour: true,
                finalFourSeeds: 4,
                highlightTopSlots: 4,
                promotionSlots: 0,
                relegationSlots: 3,
                teams: [
                    { teamName: '4Fisch', playerName: 'David Jones', logo: teamLogo('4Fisch.webp') },
                    { teamName: 'Hopfenstreife', playerName: 'Jonas Weck', logo: teamLogo('Hopfenstreife.webp') },
                    { teamName: 'Sgt. Insane', playerName: 'Matthias Weck', logo: teamLogo('Sgt-Insane.webp') },
                    { teamName: 'Lokomotive Wiedenbrück', playerName: 'Simon Weck', logo: teamLogo('Lokomotive-Wiedenbrueck.webp', 'Lokomotive-Wiedenbrueck-Winter.webp') },
                    { teamName: 'Don Promillo', playerName: 'Patrick Pohlmann', logo: teamLogo('Don-Promillo.webp') },
                    { teamName: 'Wonne', playerName: 'Daniel Wonnemann', logo: teamLogo('Wonne.webp') },
                    { teamName: 'El Gunto', playerName: 'Matthias Gunter', logo: teamLogo('El-Gunto.webp') },
                    { teamName: 'BPC Likör', playerName: 'Leon Rose', logo: teamLogo('BPC-Likoer.webp') },
                    { teamName: 'Schlauti Saufmann', playerName: 'Sara Schlautmann', logo: teamLogo('Schlauti-Saufmann.webp') },
                    { teamName: 'Schaufautomat', playerName: 'Jens Schauf', logo: teamLogo('BPC-Schauf.webp') },
                    { teamName: 'Anime Dude', playerName: 'Fritz Falkenreck', logo: teamLogo('Anime-Dude.webp'), withdrawn: true },
                    { teamName: 'SallyWin All-in', playerName: 'Sally Hollenbeck', logo: teamLogo('SallyWin-All-in.webp') },
                ],
            },
            {
                league: 2,
                label: '2. Liga',
                hasFinalFour: true,
                finalFourSeeds: 4,
                highlightTopSlots: 0,
                promotionSlots: 3,
                relegationSlots: 0,
                teams: [
                    { teamName: 'Parmigiano Beer-Giano', playerName: 'Jerome Campigotto', logo: teamLogo('Parmigiano-Beer-Giano.webp') },
                    { teamName: 'Ostgold', playerName: 'Giulia Sanio', logo: teamLogo('Ostgold.webp') },
                    { teamName: 'JP Pongande', playerName: 'Janine Pergande', logo: teamLogo('JP-Pongande.webp') },
                    { teamName: 'Bruderluie', playerName: 'Michael Pohlmann', logo: teamLogo('Bruderluie.webp') },
                    { teamName: 'Shot Queen', playerName: 'Nele Wonnemann', logo: teamLogo('Shot-Queen.webp') },
                    { teamName: 'Dunk-King', playerName: 'Fynn Schwedes', logo: teamLogo('Dunk-King.webp') },
                    { teamName: 'LiterLeo', playerName: 'Leo Heinrichsmeier', logo: teamLogo('LiterLeo.webp') },
                    { teamName: 'Pongskedi Helau', playerName: 'Christina Zellmer', logo: teamLogo('Pongskedi-Helau.webp') },
                    { teamName: 'Laufbier-Legende', playerName: 'Dana Pohlmann', logo: teamLogo('Laufbier-Legende.webp') },
                    { teamName: 'Die Bierpong-Pädagogin', playerName: 'Michelle Langer', logo: teamLogo('Die-Bierpong-Pädagogin.webp') },
                    { teamName: 'Trinkerbell', playerName: 'Annabell Kramme', logo: teamLogo('Trinkerbell.webp') },
                    { teamName: 'Walter Frosch Gedächtniskapelle e.V.', shortName: '1. WFGK', playerName: 'Leoni Straub', logo: teamLogo('Walter-Frosch-GK.webp') },
                    { teamName: 'Michael Weck', playerName: 'Michael Weck', logo: teamLogo('BiPo-League-Logo.webp') },
                ],
            },
        ],
    },
];

// Saison, auf die /League weiterleitet und die das Home-Widget zeigt.
// Bei jedem Saisonwechsel hier auf die neue Saison umstellen.
export const CURRENT_SEASON_SLUG = '2026-27';

// Saison/Liga fuer Altdaten, die noch kein season/league Feld in der DB haben.
export const LEGACY_SEASON_SLUG = '2025-26';
export const LEGACY_LEAGUE = 1;

export const getSeason = (slug: string | undefined): LeagueSeason | undefined =>
    LEAGUE_SEASONS.find(season => season.slug === slug);

// Teams, die noch mitspielen (ohne zurueckgezogene).
export const getActiveTeams = (division: LeagueDivision | undefined): LeagueTeam[] =>
    division?.teams.filter(team => !team.withdrawn) ?? [];

export const getWithdrawnTeams = (division: LeagueDivision | undefined): LeagueTeam[] =>
    division?.teams.filter(team => team.withdrawn) ?? [];

// Doppelte Hin- und Rueckrunde: jedes Team spielt gegen jedes andere zweimal.
// Zurueckgezogene Teams zaehlen nicht mit.
export const getRegularSeasonGameCount = (division: LeagueDivision | undefined): number => {
    const teamCount = getActiveTeams(division).length;
    if (teamCount < 2) return 0;
    return teamCount * (teamCount - 1);
};

export const getSeasonTeams = (season: LeagueSeason | undefined): LeagueTeam[] =>
    season ? season.divisions.flatMap(division => division.teams) : [];

export const toLeaguePlayers = (teams: LeagueTeam[]): LeaguePlayer[] =>
    teams.map(({ teamName, shortName, logo }) => ({ name: teamName, shortName, logo }));
