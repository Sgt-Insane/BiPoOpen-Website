/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

export {}; // wichtig, damit TypeScript es als Modul erkennt

declare module 'primeicons/primeicons.css';

declare global {
    type Tournament = {
        _id: string;
        name: string;
        groupPhase: GroupPhase;
        koPhase: KoPhase;
        teams: Team[];
        settings: TournamentSettings;
    };

    type TournamentSettings = {
        trackPlayerShots: boolean;
        fixedGroupAmmount: number;
        advancingTeamsPerGroup: number;
        trackTeamShots: boolean;
    };

    type GroupPhase = {
        groups: Group[];
        matches: Match[][];
    };

    type Group = {
        teams: Team[];
    };

    type KoPhase = {
        matches: Match[][];
    };

    type Match = {
        _id: string;
        team1: Team;
        team2: Team;
        time?: number;
        endTime?: number;
        turns?: Turn[];
        // Nur bei Liga-Spielen gesetzt. Altdaten ohne diese Felder gelten als Saison 2025/26, 1. Liga.
        season?: string;
        league?: number;
        // Nur bei Pokalspielen gesetzt: zu welchem LeagueCup und welcher Runde das Spiel gehoert.
        cupId?: string;
        cupRound?: number;
        // Schiedsrichter, falls das Spiel im BiPo Knecht von einer dritten Person eingetragen wurde
        referee?: string;
    };

    type LeagueCupParticipant = {
        teamName: string;
        league: number;
    };

    type LeagueCupPairing = {
        team1: string;
        team2: string;
    };

    type LeagueCupRound = {
        name: string;
        bestOf: number;
        createdTime: number;
        pairings: LeagueCupPairing[];
        byes: string[];
    };

    type LeagueCup = {
        _id: string;
        season: string;
        name: string;
        participants: LeagueCupParticipant[];
        rounds: LeagueCupRound[];
    };

    type Team = {
        _id: string;
        name?: string;
        players: Player[];
        logo?: string;
        logoId?: string;
    };

    type Player = {
        _id: string;
        logo?: string;
        name: string;
        score: number;
    };

    type Turn = {
        playerIndex: number;
        teamIndex: number;
        type: 'hit' | 'miss' | 'airball' | 'bomb' | 'bouncer' | 'trickshot' | 'onfire' | 'ballsback' | 'lastCup' | 'deathcup' | 'owncup';
        data: HitTurn | MissTurn | AirballTurn | BombTurn | BouncerTurn | TrickshotTurn | OnFireTurn | BallsBackTurn | LastCupTurn | DeathcupTurn | OwnCupTurn;
        time: number; 
    };

    // Zusatzbecher (Bouncer, Bombe) fehlen, wenn sonst der letzte Becher gefallen waere.
    // bouncer: Treffer war zusaetzlich ein Bouncer (z.B. Balls Back per Bouncer).
    type HitTurn = { cupIndex: number };
    type MissTurn = { };
    type AirballTurn = { };
    type BombTurn = { cupIndex1: number, cupIndex2?: number, cupIndex3?: number };
    type BouncerTurn = { cupIndex1: number, cupIndex2?: number };
    type TrickshotTurn = { catcherIndex?: number };     // wer den Ball gefangen hat und den Trickshot wirft
    type OnFireTurn = { cupIndex: number, cupIndex2?: number, bouncer?: boolean };
    type BallsBackTurn = { cupIndex1: number, cupIndex2?: number, bouncer?: boolean };
    type LastCupTurn = { cupIndex: number, double?: boolean };   // double: weiterer Ball in den letzten Becher (Sofortsieg)
    type DeathcupTurn = { cups: number[] };             // alle uebrigen Becher des Gegners
    type OwnCupTurn = { cups: number[] };               // eigene Becher runtergeworfen, zaehlen fuer den Gegner

    // Stats
    type GroupWithStats = {  
        teams: TeamWithStats[];
    };

    type TeamWithStats = {  
        placement?: number;
        name: string;
        logo?: string;
        players: Player[];
        wins: number;
        hitDifference: string;
        hitDifferenceNumber: number;
        ammountOfMatches: number;
        hits: number;
    };

    type PlayerWithStats = {
        placement?: number;
        name: string;
        wins: number;
        looses: number;
        averageWins: number;
        hits: number;
        hitDifference: string;
        hitDifferenceNumber: number;
        averageHits: number;
        ammountOfMatches: number;
        ammountOfMatchesWithTrackedShots: number;
        ammountOfDrunkenCups: number;
    };

    type LeaguePlayer = {
        name: string;
        logo: string;
    }

    // Player Profile Types
    type TrendPeriod = 'all' | '1m' | '3m' | '6m' | '1y';

    type CategoryStats = {
        name: string;
        matches: number;
        wins: number;
        hits: number;
        averageHits: number;
        trackedMatches: number;
    };

    type PartnerData = {
        name: string;
        matches: number;
        wins: number;
        losses: number;
    };

    type TimeOfDayBlock = {
        label: string;
        wins: number;
        losses: number;
        total: number;
        winrate: number;
    };

    type ExtraStats = {
        fastestWinMinutes: number | null;
        bestTimeOfDay: string | null;
        bestTimeWinrate: number | null;
        longestLosingStreak: number;
        timeOfDayStats: TimeOfDayBlock[];
        mostActiveTimeOfDay: string | null;
        mostActiveGames: number | null;
    };

    type MatchHistoryEntry = {
        match: Match;
        source: string;
        time: number;
        won: boolean;
        hits: number;
        // 2020-2022: Treffer pro Spieler nicht erfasst, zaehlt nicht in die Trefferquote
        hitsTracked: boolean;
        ownScore: number;
        opponentScore: number;
    };

    type RivalData = {
        name: string;
        wins: number;
        losses: number;
        matches: number;
    };

    type LeagueStanding = {
        teamName: string;
        seasonSlug: string;
        league: number;
        divisionLabel: string;   // "1. Liga"
        seasonLabel: string;     // "2026/27"
        placement: number | null; // 1-basiert, nach dem Final Four, null = noch kein Spiel
        champion: boolean;        // Final Four gewonnen
    };

    type PlayerProfileData = {
        name: string;
        leagueTeam: string | null;
        leagueStandings: LeagueStanding[]; // alle Saisons, neueste zuerst, fuer die Liga-Chips
        firstGameTime: number | null;
        allTimeMatches: number; // unabhaengig vom gewaehlten Zeitraum
        elo: PlayerEloSummary | null;
        totalMatches: number;
        totalWins: number;
        totalLosses: number;
        winrate: number;
        totalHits: number;
        averageHits: number;
        currentWinStreak: number;
        bestWinStreak: number;
        categories: CategoryStats[];
        recentForm: ('W' | 'L')[];
        matchHistory: MatchHistoryEntry[];
        allMatchHistory: MatchHistoryEntry[]; // unabhaengig von Zeitraum und Spielart, fuer die Aktivitaet
        rivals: RivalData[];
        partners: PartnerData[];
        extraStats: ExtraStats;
        badges: PlayerBadge[];
    };

    type PlayerEloSummary = {
        rank: number | null;       // null = nicht in der Liste
        inactive: boolean;         // genug Spiele, aber laenger nicht gespielt
        rating: number;
        ratingChange: number;      // seit ELO_HISTORY_DAYS Tagen, passend zur Sparkline
        peak: number;
        games: number;
        historyRatings: number[];  // Verlauf seit ELO_HISTORY_DAYS Tagen
    };

    type PlayerBadgeGroup = 'title' | 'record' | 'performance' | 'milestone';

    type PlayerBadge = {
        id: string;
        group: PlayerBadgeGroup;
        // Stufen einer Reihe (z.B. 'matches'): angezeigt werden die hoechste erreichte und die naechste offene Stufe
        tier?: string;
        icon: string;
        label: string;
        caption: string;       // kurze Zeile unter dem Namen
        description: string;   // Detail-Dialog
        date: string | null;
        time: number;          // Sortierung, 0 = unbekannt
        locked?: boolean;
        // Rekorde: frueher gehalten, inzwischen von jemand anderem uebertroffen
        former?: boolean;
        progress?: { current: number; target: number };
        // Hinweis nach dem Eintragen eines Spiels (nur freigeschaltete Badges), highlight wird im Text fett
        award?: { title: string; text: string; highlight?: string };
    };
}
