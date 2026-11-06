import { addLeagueGame } from '../league/LeagueUtilFunctions';
import { addOpenGame } from '../openGames/OpenGamesUtilFunctions';
import { CUP_URL_SEGMENT } from '../league/cup/LeagueCupUtilFunctions';
import { clearPlayerCaches } from '../playerProfile/PlayerProfileUtilFunctions';
import { clearGameDataCache } from '@/util/gameDataCache';
import { addDemoGame, isDemoMode } from '@/util/demoGames';
import { useAddGame } from '@/components/shared/GameEntry/useAddGame';
import { getPlayerPoints, isHitTurnType, type KnechtState } from './knechtEngine';

export type KnechtGameKind = 'open' | 'league' | 'cup';

export const TEAM_COLORS = ['#EA5160', '#61C3D9'];

// ─── Spiel ───
export const getGameKind = (match: Match): KnechtGameKind =>
    match.cupId ? 'cup' : match.league !== undefined ? 'league' : 'open';

export const getTeam = (match: Match, teamIndex: number) => teamIndex === 0 ? match.team1 : match.team2;

export const getTeamName = (match: Match, teamIndex: number) => {
    const team = getTeam(match, teamIndex);
    return team.name || team.players.map(player => player.name).join(' & ') || `Team ${teamIndex + 1}`;
};

export const getPlayerName = (match: Match, teamIndex: number, playerIndex: number) =>
    getTeam(match, teamIndex).players[playerIndex]?.name ?? '';

// Frueher wurde ein 1 gegen 1 als zwei gleichnamige Spieler angelegt -> zu einem Spieler zusammenfassen.
export const normalizeTeams = (match: Match): Match => {
    const normalize = (team: Team): Team => {
        const seen = new Set<string>();
        const players = team.players.filter(player => {
            const key = player.name.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        return { ...team, players: players.map(player => ({ ...player, score: 0 })) };
    };
    return { ...match, team1: normalize(match.team1), team2: normalize(match.team2) };
};

// Fertiges Spiel fuer die Datenbank: Punkte aus dem Regelwerk, Verlauf, Schiedsrichter
export const buildKnechtMatch = (match: Match, state: KnechtState, referee?: string): Match => {
    const points = getPlayerPoints(state);
    const withScores = (team: Team, teamIndex: number): Team => ({
        ...team,
        players: team.players.map((player, playerIndex) => ({ ...player, score: points[teamIndex][playerIndex] ?? 0 })),
    });
    const lastTime = state.turns.at(-1)?.time;
    const result: Match = {
        ...match,
        team1: withScores(match.team1, 0),
        team2: withScores(match.team2, 1),
        turns: state.turns,
        endTime: lastTime ?? new Date().getTime(),
    };
    if (referee?.trim()) result.referee = referee.trim();
    return result;
};

// Speichert das fertige Spiel. Im Demo-Modus (lokaler Entwicklungsserver) nur im Browser, nie in der echten Datenbank.
export const saveKnechtGame = async (match: Match): Promise<boolean> => {
    const kind = getGameKind(match) === 'open' ? 'open' : 'league';
    if (isDemoMode) addDemoGame(kind, match);
    const success = isDemoMode || (kind === 'open' ? await addOpenGame(match) : await addLeagueGame(match));
    if (success) {
        clearGameDataCache();
        clearPlayerCaches();
        useAddGame().notifyGameSaved();
    }
    return success;
};

// Wohin es nach dem Eintragen geht
export const getResultPath = (match: Match) => {
    const kind = getGameKind(match);
    if (kind === 'cup') return `/League/${match.season}/${CUP_URL_SEGMENT}`;
    if (kind === 'league') return `/League/${match.season}/${match.league}`;
    return '/Offene-Spiele';
};

// ─── Verlauf ───
const TURN_LABELS: Record<Turn['type'], string> = {
    hit: 'Treffer',
    miss: 'Nullwurf',
    airball: 'Airball',
    bomb: 'Bombe',
    bouncer: 'Bouncer',
    trickshot: 'Trickshot',
    onfire: 'On Fire',
    ballsback: 'Balls Back',
    lastCup: 'Letzter Becher',
    deathcup: 'Deathcup',
    owncup: 'Eigener Becher',
};

// Treffer mit Trickshot: der Faenger des vorherigen Wurfs hat getroffen
const isTrickshotHit = (turn: Turn, previous?: Turn) =>
    previous?.type === 'trickshot' && previous.teamIndex === turn.teamIndex
    && (previous.data as Record<string, unknown>).catcherIndex === turn.playerIndex;

// Treffer werden immer als "Treffer · Art" beschrieben, z.B. "Treffer · Bouncer (2 Becher)"
export const getTurnLabel = (turn: Turn, match?: Match, previous?: Turn) => {
    const data = turn.data as Record<string, unknown>;
    if (turn.type === 'trickshot') {
        const catcher = match && typeof data.catcherIndex === 'number' ? getPlayerName(match, turn.teamIndex, data.catcherIndex) : '';
        return catcher ? `Verfehlt · ${catcher} fängt (Trickshot)` : 'Verfehlt · Trickshot-Fang';
    }
    if (turn.type === 'owncup') return `${(data.cups as number[]).length} eigene${(data.cups as number[]).length === 1 ? 'r' : ''} Becher runter`;
    if (!isHitTurnType(turn.type)) return TURN_LABELS[turn.type];

    const kinds = [
        turn.type !== 'hit' && TURN_LABELS[turn.type],
        turn.type !== 'bouncer' && data.bouncer && TURN_LABELS.bouncer,
        data.double && 'Doppeltreffer',
        isTrickshotHit(turn, previous) && TURN_LABELS.trickshot,
    ].filter(Boolean);
    const cups = Object.keys(data).filter(key => key.startsWith('cupIndex')).length;
    return ['Treffer', ...kinds].join(' · ') + (cups > 1 ? ` (${cups} Becher)` : '');
};

export const formatPoints = (points: number) =>
    Number.isInteger(points) ? String(points) : points.toFixed(2).replace(/0$/, '').replace('.', ',');

export const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime || !endTime) return '';
    const seconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;
};

// ─── Statistik je Spieler ───
export type KnechtPlayerStats = {
    teamIndex: number;
    playerIndex: number;
    name: string;
    points: number;
    throws: number;
    hits: number;
    misses: number;
    airballs: number;
    bouncers: number;
    bombs: number;
    ballsBacks: number;
    onFires: number;
    trickshotCatches: number;
    trickshotHits: number;
    lastCups: number;
    deathcups: number;
    ownCups: number;
    bestStreak: number;
};

export const getPlayerStats = (match: Match, state: KnechtState): KnechtPlayerStats[] => {
    const points = getPlayerPoints(state);
    const stats = [match.team1, match.team2].flatMap((team, teamIndex) => team.players.map((player, playerIndex) => ({
        teamIndex, playerIndex, name: player.name, points: points[teamIndex][playerIndex] ?? 0,
        throws: 0, hits: 0, misses: 0, airballs: 0, bouncers: 0, bombs: 0, ballsBacks: 0, onFires: 0,
        trickshotCatches: 0, trickshotHits: 0, lastCups: 0, deathcups: 0, ownCups: 0, bestStreak: 0,
    })));
    const find = (teamIndex: number, playerIndex: number) => stats.find(entry => entry.teamIndex === teamIndex && entry.playerIndex === playerIndex);
    const streaks = new Map<KnechtPlayerStats, number>();
    let pendingTrickshot: number | null = null;

    state.turns.forEach(turn => {
        const entry = find(turn.teamIndex, turn.playerIndex);
        if (!entry) return;
        const data = turn.data as Record<string, unknown>;

        if (turn.type === 'owncup') { entry.ownCups += (data.cups as number[]).length; return; }
        if (turn.type === 'deathcup') { entry.deathcups++; return; }
        if (turn.type === 'trickshot') {
            entry.throws++;
            entry.misses++;
            streaks.set(entry, 0);
            const catcher = find(turn.teamIndex, data.catcherIndex as number);
            if (catcher) catcher.trickshotCatches++;
            pendingTrickshot = data.catcherIndex as number;
            return;
        }

        entry.throws++;
        if (isHitTurnType(turn.type)) {
            entry.hits++;
            if (pendingTrickshot === turn.playerIndex) entry.trickshotHits++;
            const streak = (streaks.get(entry) ?? 0) + 1;
            streaks.set(entry, streak);
            entry.bestStreak = Math.max(entry.bestStreak, streak);
        } else {
            if (turn.type === 'airball') entry.airballs++;
            else entry.misses++;
            streaks.set(entry, 0);
        }
        pendingTrickshot = null;

        if (turn.type === 'bouncer' || data.bouncer) entry.bouncers++;
        if (turn.type === 'bomb') entry.bombs++;
        if (turn.type === 'ballsback') entry.ballsBacks++;
        if (turn.type === 'onfire') entry.onFires++;
        if (turn.type === 'lastCup') entry.lastCups++;
    });

    return stats;
};

export const getAccuracy = (stats: KnechtPlayerStats) => stats.throws ? Math.round(stats.hits / stats.throws * 100) : 0;

// ─── Auszeichnungen ───
// Jeder Spieler bekommt einen Titel. Die Liste ist nach Seltenheit sortiert, jeder Titel wird nur einmal vergeben.
export type KnechtAward = { icon: string; title: string; detail: string };

type AwardRule = { icon: string; title: string; applies: (s: KnechtPlayerStats, all: KnechtPlayerStats[]) => boolean; detail: (s: KnechtPlayerStats) => string };

const plural = (count: number, one: string, many: string) => `${formatPoints(count)} ${count === 1 ? one : many}`;

const AWARD_RULES: AwardRule[] = [
    { icon: '💀', title: 'Sensenmann', applies: s => s.deathcups > 0, detail: () => 'Deathcup versenkt – Spiel sofort beendet' },
    { icon: '🧨', title: 'Bombenleger', applies: s => s.bombs > 0, detail: s => plural(s.bombs, 'Bombe gelegt', 'Bomben gelegt') },
    { icon: '🔥', title: 'Feuerteufel', applies: s => s.onFires >= 2, detail: s => `${s.onFires} Treffer im On-Fire-Modus` },
    { icon: '🎪', title: 'Zirkusartist', applies: s => s.trickshotHits > 0, detail: s => plural(s.trickshotHits, 'Trickshot verwandelt', 'Trickshots verwandelt') },
    { icon: '🏀', title: 'Bouncer-König', applies: s => s.bouncers >= 2, detail: s => `${s.bouncers} Bouncer über den Tisch` },
    { icon: '🦅', title: 'Adlerauge', applies: s => s.throws >= 6 && getAccuracy(s) >= 60, detail: s => `${getAccuracy(s)} % Trefferquote (${s.hits}/${s.throws})` },
    { icon: '🎯', title: 'Scharfschütze', applies: s => s.bestStreak >= 4, detail: s => `${s.bestStreak} Treffer in Folge` },
    { icon: '🧊', title: 'Eiskalt', applies: s => s.lastCups > 0, detail: () => 'Den letzten Becher versenkt' },
    { icon: '🤸', title: 'Fangkünstler', applies: s => s.trickshotCatches >= 2, detail: s => `${s.trickshotCatches} Bälle für einen Trickshot gefangen` },
    { icon: '🏆', title: 'Becherräumer', applies: (s, all) => s.points > 0 && s.points === Math.max(...all.map(other => other.points)), detail: s => plural(s.points, 'Becher abgeräumt', 'Becher abgeräumt') },
    { icon: '🙈', title: 'Eigentor-Spezialist', applies: s => s.ownCups > 0, detail: s => plural(s.ownCups, 'eigener Becher vom Tisch geräumt', 'eigene Becher vom Tisch geräumt') },
    { icon: '✈️', title: 'Luftpost', applies: s => s.airballs >= 3, detail: s => `${s.airballs} Airballs – die Wand freut sich` },
    { icon: '🎳', title: 'Zielwasser vergessen', applies: s => s.throws >= 6 && getAccuracy(s) < 25, detail: s => `Nur ${s.hits} Treffer bei ${s.throws} Würfen` },
    { icon: '🍺', title: 'Durstlöscher', applies: s => s.points === 0, detail: () => 'Kein Becher, dafür ordentlich getrunken' },
    { icon: '💪', title: 'Solider Werfer', applies: () => true, detail: s => `${plural(s.points, 'Becher', 'Becher')} bei ${s.throws} Würfen` },
];

export const getAwards = (stats: KnechtPlayerStats[]): KnechtAward[] => {
    const used = new Set<string>();
    return stats.map(entry => {
        const rule = AWARD_RULES.find(candidate => !used.has(candidate.title) && candidate.applies(entry, stats))
            ?? AWARD_RULES[AWARD_RULES.length - 1];
        used.add(rule.title);
        return { icon: rule.icon, title: rule.title, detail: rule.detail(entry) };
    });
};

// Lustiger Text fuer den Speichern-Knopf
const SAVE_LABELS = ['Ab in die Tabelle!', 'Spiel eintragen – Prost!', 'Für die Ewigkeit speichern', 'Ergebnis ins Buch der Legenden'];
export const getSaveLabel = (seed: number) => SAVE_LABELS[Math.abs(seed) % SAVE_LABELS.length];
