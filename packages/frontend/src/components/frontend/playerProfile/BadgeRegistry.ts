import { checkIfTeam1WonVsTeam2, checkIfMatchFinished } from "@/util/tournamentMatchFunctions";
import { getDivisionResult } from "@/components/frontend/league/LeagueUtilFunctions";
import { LEAGUE_SEASONS } from "@/components/frontend/league/LeagueSeasonsData";
import type { GameData } from "@/util/gameDataCache";

// Rekorde haelt immer genau ein Spieler: wer den Wert zuerst erreicht hat, bis ihn jemand uebertrifft.
export type RecordKey = 'most-games' | 'most-wins' | 'most-hits' | 'streak-record' | 'loss-streak-record';

export type RecordStanding = {
    own: number;            // eigener Wert (Summe bzw. laengste Serie)
    record: number;         // aktueller Rekord
    holder: string;         // aktueller Rekordhalter
    status: 'current' | 'former' | 'never';
    until: number | null;   // bei 'former': seit wann jemand anderes den Rekord haelt
};

export interface BadgeContext {
    data: GameData;
    playerName: string;
    allMatchHistory: MatchHistoryEntry[];
    totalMatches: number;
    totalWins: number;
    totalHits: number;
    winrate: number;
    records: Record<RecordKey, RecordStanding>;
}

// Wie BadgeContext, die Spiele zusaetzlich aufsteigend nach Zeit (ohne Spiele ohne Zeitstempel)
type CheckerContext = BadgeContext & { chronological: MatchHistoryEntry[] };

export type BadgeChecker = (ctx: CheckerContext) => PlayerBadge[];

const registry: BadgeChecker[] = [];

export const registerBadge = (checker: BadgeChecker) => registry.push(checker);

export const calculateBadges = (ctx: BadgeContext): PlayerBadge[] => {
    const chronological = ctx.allMatchHistory.filter(m => m.time > 0).sort((a, b) => a.time - b.time);
    return registry.flatMap(checker => checker({ ...ctx, chronological }));
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dateStr = (ts: number) => ts > 0 ? new Date(ts).toLocaleDateString('de-DE') : null;

// "26.09.26"
const shortDateStr = (ts: number) => ts > 0
    ? new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '';

// "03/26"
const monthStr = (ts: number) => {
    const date = new Date(ts);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(2)}`;
};

// Ganze Zahlen, auch bei halben Treffern in den Daten
const formatNumber = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 0 });

// Erstes Spiel, ab dem der aufsummierte Wert die Schwelle erreicht
const findCumulativeMatch = (chronological: MatchHistoryEntry[], count: number, getValue: (entry: MatchHistoryEntry) => number) => {
    let sum = 0;
    for (const entry of chronological) {
        sum += getValue(entry);
        if (sum >= count) return entry;
    }
    return null;
};

type TierStep = { count: number; label: string };

// Meilenstein-Reihe: alle erreichten Stufen und die naechste offene mit Fortschritt
const getTierBadges = (
    playerName: string,
    tier: string,
    icon: string,
    value: number,
    steps: TierStep[],
    unit: string,
    verb: string,
    findMatch: (count: number) => MatchHistoryEntry | null,
): PlayerBadge[] => {
    const badges: PlayerBadge[] = steps
        .filter(step => value >= step.count)
        .map(step => {
            const match = findMatch(step.count);
            const amount = `${formatNumber(step.count)} ${unit}`;
            return {
                id: `${tier}-${step.count}`,
                group: 'milestone',
                tier,
                icon,
                label: amount,
                caption: match ? shortDateStr(match.time) : '',
                description: `${step.label}: ${amount} ${verb}`,
                date: match ? dateStr(match.time) : null,
                time: match?.time ?? 0,
                award: { title: step.label, text: `${playerName} hat ${amount} ${verb}.`, highlight: amount },
            };
        });

    const next = steps.find(step => value < step.count);
    if (next) {
        badges.push({
            id: `${tier}-${next.count}`,
            group: 'milestone',
            tier,
            icon,
            label: `${formatNumber(next.count)} ${unit}`,
            caption: `${formatNumber(value)} / ${formatNumber(next.count)}`,
            description: `${next.label}: ${formatNumber(next.count)} ${unit} ${verb}`,
            date: null,
            time: 0,
            locked: true,
            progress: { current: value, target: next.count },
        });
    }

    return badges;
};

// ─── Titel (einmal pro Datenstand berechnet) ──────────────────────────────────

type TitleWin = { id: string; playerNames: string[]; label: string; caption: string; description: string; time: number };

const titleWinsCache = new WeakMap<GameData, TitleWin[]>();

// Nicht in der Datenbank: BiPo Open 2021 und das All-Star Turnier
const HARDCODED_TITLE_WINS: TitleWin[] = [
    {
        id: 'tournament-win-2021',
        playerNames: ['Matthias Weck', 'Lennard Kaffitz'],
        label: 'BiPo Open',
        caption: 'Sieger 2021',
        description: 'Gewinner des BiPo Open 2021',
        time: new Date('2021-07-01T14:00:00').getTime(),
    },
    {
        id: 'allstar-win-2025',
        playerNames: ['Jonas Weck', 'Leon Rose'],
        label: 'All-Star Turnier',
        caption: 'Sieger 2025',
        description: 'Gewinner des All-Star Turniers am 17.10.2025',
        time: new Date('2025-10-17T20:00:00').getTime(),
    },
];

const getLeagueWinBadgeId = (seasonSlug: string, league: number) =>
    league === 1 ? `league-win-${seasonSlug}` : `league-win-${seasonSlug}-liga${league}`;

const getTournamentWins = (data: GameData): TitleWin[] => data.tournaments.flatMap(({ year, tournament, time }) => {
    const lastStage = tournament.koPhase.matches[tournament.koPhase.matches.length - 1];
    const finalMatch = lastStage?.[0];
    if (!finalMatch || !checkIfMatchFinished(finalMatch)) return [];

    const winningTeam = checkIfTeam1WonVsTeam2(finalMatch) ? finalMatch.team1 : finalMatch.team2;
    return [{
        id: `tournament-win-${year}`,
        playerNames: winningTeam.players.map(player => player.name),
        label: 'BiPo Open',
        caption: `Sieger ${year}`,
        description: `Gewinner des BiPo Open ${year}`,
        time: finalMatch.time || time,
    }];
});

// Liga-Sieg je Saison und Liga: Sieger des Final Four
const getLeagueWins = (data: GameData): TitleWin[] => LEAGUE_SEASONS.flatMap(season => season.divisions.flatMap((division): TitleWin[] => {
    const { champion, finalGames } = getDivisionResult(data.leagueGames, season.slug, division);
    if (!champion)
        return [];

    // "2025/26" -> "25/26"
    const shortSeasonLabel = season.label.replace(/^\d{2}/, '');
    const divisionSuffix = season.divisions.length > 1 ? ` · ${division.label}` : '';
    return [{
        id: getLeagueWinBadgeId(season.slug, division.league),
        playerNames: [division.teams.find(team => team.teamName === champion)?.playerName ?? champion],
        label: 'BiPo League',
        caption: `Meister ${shortSeasonLabel}${divisionSuffix}`,
        description: `Gewinner der BiPo League Saison ${season.label}${divisionSuffix}`,
        time: finalGames[finalGames.length - 1].time || 0,
    }];
}));

const getTitleWins = (data: GameData) => {
    let wins = titleWinsCache.get(data);
    if (!wins) {
        wins = [...HARDCODED_TITLE_WINS, ...getTournamentWins(data), ...getLeagueWins(data)];
        titleWinsCache.set(data, wins);
    }
    return wins;
};

// ─── Default Badge Registrations ──────────────────────────────────────────────

// Titel: Turniersiege und Liga-Meisterschaften
registerBadge(({ data, playerName }) => getTitleWins(data)
    .filter(win => win.playerNames.includes(playerName))
    .map(win => ({
        id: win.id,
        group: 'title',
        icon: 'emoji_events',
        label: win.label,
        caption: win.caption,
        description: win.description,
        date: win.id === 'tournament-win-2021' ? null : dateStr(win.time),
        time: win.time,
        award: { title: win.label, text: `${playerName} ist ${win.caption}.`, highlight: win.caption },
    })));

// Rekorde
const RECORDS: { key: RecordKey; label: string; unit: string; onlyIfHeld?: boolean }[] = [
    { key: 'most-games', label: 'Meiste Spiele', unit: 'Spiele' },
    { key: 'most-wins', label: 'Meiste Siege', unit: 'Siege' },
    { key: 'most-hits', label: 'Meiste Treffer', unit: 'Treffer' },
    { key: 'streak-record', label: 'Längste Serie', unit: 'Siege in Folge' },
    // Negativ-Rekord: nur zeigen, wenn man ihn hat oder hatte
    { key: 'loss-streak-record', label: 'Längste Pleite', unit: 'Niederlagen in Folge', onlyIfHeld: true },
];

registerBadge(({ playerName, records }) => RECORDS.flatMap(({ key, label, unit, onlyIfHeld }): PlayerBadge[] => {
    const { own, record, holder, status, until } = records[key];
    if (record <= 0 || (onlyIfHeld && status === 'never')) return [];

    // "11 Siege in Folge" -> kurz "11 in Folge"
    const shortUnit = unit.replace(/^(Siege|Niederlagen) /, '');
    const caption = {
        current: `${formatNumber(own)} ${shortUnit}`,
        former: `${formatNumber(own)} · bis ${until ? monthStr(until) : '–'}`,
        never: `${formatNumber(own)} / ${formatNumber(record)} ${shortUnit}`,
    }[status];

    return [{
        id: key,
        group: 'record',
        icon: 'military_tech',
        label,
        caption,
        description: `Rekord: ${holder} mit ${formatNumber(record)} ${unit}`,
        date: null,
        time: 0,
        locked: status !== 'current',
        former: status === 'former',
        progress: status === 'never' ? { current: own, target: record } : undefined,
        award: {
            title: label,
            text: `${playerName} hält jetzt den Rekord mit ${formatNumber(own)} ${unit}.`,
            highlight: `${formatNumber(own)} ${unit}`,
        },
    }];
}));

// Siegquote (mind. 20 Spiele)
registerBadge(({ playerName, totalMatches, winrate }) => {
    const steps = [
        { value: 60, icon: 'trending_up' },
        { value: 75, icon: 'rocket_launch' },
    ];
    const reached = (value: number) => totalMatches >= 20 && winrate >= value;

    const badges: PlayerBadge[] = steps.filter(step => reached(step.value)).map(step => ({
        id: `winrate-${step.value}`,
        group: 'performance',
        tier: 'winrate',
        icon: step.icon,
        label: `Über ${step.value} %`,
        caption: 'Siegquote',
        description: `Siegquote über ${step.value} % (mind. 20 Spiele)`,
        date: null,
        time: 0,
        award: {
            title: `Über ${step.value} %`,
            text: `${playerName} hat jetzt eine Siegquote über ${step.value} %.`,
            highlight: `über ${step.value} %`,
        },
    }));

    const next = steps.find(step => !reached(step.value));
    if (next) {
        badges.push({
            id: `winrate-${next.value}`,
            group: 'performance',
            tier: 'winrate',
            icon: next.icon,
            label: `Über ${next.value} %`,
            caption: `${winrate} / ${next.value} %`,
            description: `Siegquote über ${next.value} % (mind. 20 Spiele)`,
            date: null,
            time: 0,
            locked: true,
            progress: { current: Math.min(winrate, next.value), target: next.value },
        });
    }
    return badges;
});

// Zu Null: ein Spiel gewonnen, ohne dass der Gegner getroffen hat
registerBadge(({ playerName, chronological }) => {
    const shutout = chronological.find(entry => entry.won && entry.opponentScore === 0 && entry.ownScore > 0);
    return [{
        id: 'shutout',
        group: 'performance',
        icon: 'shield',
        label: 'Zu Null',
        caption: shutout ? `${shutout.ownScore} : 0` : 'ein 10 : 0',
        description: 'Ein Spiel gewonnen, ohne dass der Gegner einen Becher getroffen hat',
        date: shutout ? dateStr(shutout.time) : null,
        time: shutout?.time ?? 0,
        locked: !shutout,
        award: shutout
            ? { title: 'Zu Null', text: `${playerName} hat ${shutout.ownScore} : 0 gewonnen.`, highlight: `${shutout.ownScore} : 0` }
            : undefined,
    }];
});

// Spiele-Meilensteine
registerBadge(({ playerName, chronological, totalMatches }) => getTierBadges(playerName, 'matches', 'star', totalMatches, [
    { count: 100, label: 'Stammgast' },
    { count: 200, label: 'Veteran' },
    { count: 300, label: 'Legende' },
    { count: 500, label: 'Unstoppable' },
], 'Spiele', 'absolviert', count => chronological[count - 1] ?? null));

// Sieg-Meilensteine
registerBadge(({ playerName, chronological, totalWins }) => getTierBadges(playerName, 'wins', 'local_fire_department', totalWins, [
    { count: 100, label: 'Dominator' },
    { count: 200, label: 'Unbesiegbar' },
], 'Siege', 'errungen', count => findCumulativeMatch(chronological, count, entry => entry.won ? 1 : 0)));

// Treffer-Meilensteine
registerBadge(({ playerName, chronological, totalHits }) => getTierBadges(playerName, 'hits', 'track_changes', totalHits, [
    { count: 500, label: 'Präzisionsmaschine' },
    { count: 1000, label: 'Tausender' },
    { count: 2000, label: 'Scharfschütze' },
], 'Treffer', 'erzielt', count => findCumulativeMatch(chronological, count, entry => entry.hits)));

// Erstes Spiel
registerBadge(({ playerName, chronological }) => {
    const firstMatch = chronological[0];
    if (!firstMatch) return [];

    return [{
        id: 'first-game',
        group: 'milestone',
        icon: 'flag',
        label: 'Erstes Spiel',
        caption: shortDateStr(firstMatch.time),
        description: 'Erstes Spiel absolviert',
        date: dateStr(firstMatch.time),
        time: firstMatch.time,
        award: { title: 'Erstes Spiel', text: `${playerName} hat das erste Spiel absolviert. Willkommen!`, highlight: 'erste Spiel' },
    }];
});
