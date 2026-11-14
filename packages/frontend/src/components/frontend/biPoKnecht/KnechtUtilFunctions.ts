import { addLeagueGame } from '../league/LeagueUtilFunctions';
import { addOpenGame } from '../openGames/OpenGamesUtilFunctions';
import { CUP_URL_SEGMENT } from '../league/cup/LeagueCupUtilFunctions';
import { clearPlayerCaches } from '../playerProfile/PlayerProfileUtilFunctions';
import { clearGameDataCache } from '@/util/gameDataCache';
import { addDemoGame, isDemoMode } from '@/util/demoGames';
import { useAddGame } from '@/components/shared/GameEntry/useAddGame';
import { getFinalPlayerPoints, isHitTurnType, type KnechtState } from './knechtEngine';
import { getAccuracy, getTurnStats, type KnechtPlayerStats } from './knechtStats';

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

// Fertiges Spiel fuer die Datenbank: ganzzahlige Punkte aus dem Regelwerk, Verlauf, Schiedsrichter
export const buildKnechtMatch = (match: Match, state: KnechtState, referee?: string): Match => {
    const points = getFinalPlayerPoints(state);
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
    && ((previous.data ?? {}) as Record<string, unknown>).catcherIndex === turn.playerIndex;

// Treffer werden immer als "Treffer · Art" beschrieben, z.B. "Treffer · Bouncer (2 Becher)"
export const getTurnLabel = (turn: Turn, match?: Match, previous?: Turn) => {
    const data = (turn.data ?? {}) as Record<string, unknown>;
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
export { getAccuracy, type KnechtPlayerStats } from './knechtStats';

export const getPlayerStats = (match: Match, state: KnechtState): KnechtPlayerStats[] =>
    getTurnStats(match, state.turns, getFinalPlayerPoints(state));

// ─── Auszeichnungen ───
// Jeder Spieler bekommt einen Titel. Besondere Titel werden nur einmal vergeben, und zwar an den Spieler,
// auf den sie am besten passen (nicht an den, der zufaellig zuerst geprueft wird). Wer keinen besonderen
// Titel bekommt, erhaelt einen allgemeinen Titel passend zu seiner Trefferquote im Vergleich zum Spiel.
export type KnechtAward = { icon: string; title: string; detail: string };

type AwardContext = { averageAccuracy: number; maxPoints: number };
// strength: wie gut der Titel passt (hoeher = besser), null = passt nicht
type AwardRule = { icon: string; title: string; strength: (s: KnechtPlayerStats, ctx: AwardContext) => number | null; detail: (s: KnechtPlayerStats, ctx: AwardContext) => string };

const plural = (count: number, one: string, many: string) => `${formatPoints(count)} ${count === 1 ? one : many}`;
const when = (condition: boolean, strength: number) => condition ? strength : null;

// Nach Seltenheit sortiert: seltene Titel werden zuerst verteilt
const AWARD_RULES: AwardRule[] = [
    { icon: '💀', title: 'Sensenmann', strength: s => when(s.deathcups > 0, s.deathcups), detail: () => 'Deathcup versenkt – Spiel sofort beendet' },
    { icon: '🧨', title: 'Bombenleger', strength: s => when(s.bombs > 0, s.bombs), detail: s => plural(s.bombs, 'Bombe gelegt', 'Bomben gelegt') },
    { icon: '🎪', title: 'Zirkusartist', strength: s => when(s.trickshotHits > 0, s.trickshotHits), detail: s => plural(s.trickshotHits, 'Trickshot verwandelt', 'Trickshots verwandelt') },
    { icon: '🔥', title: 'Feuerteufel', strength: s => when(s.onFires >= 2, s.onFires), detail: s => `${s.onFires} Treffer im On-Fire-Modus` },
    { icon: '🏀', title: 'Bouncer-König', strength: s => when(s.bouncers >= 2, s.bouncers), detail: s => `${s.bouncers} Bouncer über den Tisch` },
    { icon: '🎯', title: 'Scharfschütze', strength: s => when(s.bestStreak >= 4, s.bestStreak), detail: s => `${s.bestStreak} Treffer in Folge` },
    { icon: '🦅', title: 'Adlerauge', strength: s => when(s.throws >= 6 && getAccuracy(s) >= 60, getAccuracy(s)), detail: s => `${getAccuracy(s)} % Trefferquote (${s.hits}/${s.throws})` },
    { icon: '🪃', title: 'Bumerang', strength: s => when(s.ballsBacks >= 2, s.ballsBacks), detail: s => `${s.ballsBacks}× Balls Back – die Bälle kommen immer zurück` },
    { icon: '🧊', title: 'Eiskalt', strength: s => when(s.lastCups > 0, s.lastCups), detail: () => 'Den letzten Becher versenkt' },
    { icon: '🤸', title: 'Fangkünstler', strength: s => when(s.trickshotCatches >= 2, s.trickshotCatches), detail: s => `${s.trickshotCatches} Bälle für einen Trickshot gefangen` },
    { icon: '🏆', title: 'Becherräumer', strength: (s, ctx) => when(s.points > 0 && s.points === ctx.maxPoints, s.points), detail: s => plural(s.points, 'Becher abgeräumt', 'Becher abgeräumt') },
    { icon: '🔁', title: 'Serientäter', strength: s => when(s.bestStreak === 3, s.bestStreak), detail: () => '3 Treffer in Folge' },
    { icon: '🙈', title: 'Eigentor-Spezialist', strength: s => when(s.ownCups > 0, s.ownCups), detail: s => plural(s.ownCups, 'eigener Becher vom Tisch geräumt', 'eigene Becher vom Tisch geräumt') },
    { icon: '✈️', title: 'Luftpost', strength: s => when(s.airballs >= 3, s.airballs), detail: s => `${s.airballs} Airballs – die Wand freut sich` },
    // Nur wer deutlich schlechter als der Rest getroffen hat, nicht wenn alle schwach waren
    { icon: '🎳', title: 'Zielwasser vergessen', strength: (s, ctx) => when(s.throws >= 6 && getAccuracy(s) < 25 && getAccuracy(s) <= ctx.averageAccuracy - 10, 100 - getAccuracy(s)), detail: s => `Nur ${s.hits} Treffer bei ${s.throws} Würfen` },
    { icon: '🍺', title: 'Durstlöscher', strength: s => when(s.points === 0 && s.throws >= 3, s.throws), detail: () => 'Kein Becher, dafür ordentlich getrunken' },
];

// Allgemeine Titel fuer alle ohne besonderen Titel, nach Trefferquote im Vergleich zum Spieldurchschnitt
const FALLBACK_AWARDS: { icon: string; title: string; applies: (s: KnechtPlayerStats, ctx: AwardContext) => boolean; detail: (s: KnechtPlayerStats) => string }[] = [
    { icon: '💪', title: 'Solider Werfer', applies: (s, ctx) => getAccuracy(s) >= Math.max(35, ctx.averageAccuracy), detail: s => `${getAccuracy(s)} % Trefferquote – über dem Schnitt` },
    { icon: '🤝', title: 'Teamplayer', applies: s => s.points > 0, detail: s => `${plural(s.points, 'Becher', 'Becher')} bei ${s.throws} Würfen` },
    { icon: '🍀', title: 'Beim nächsten Mal', applies: () => true, detail: s => `${getAccuracy(s)} % Trefferquote – da geht noch was` },
];

export const getAwards = (stats: KnechtPlayerStats[]): KnechtAward[] => {
    const hits = stats.reduce((sum, entry) => sum + entry.hits, 0);
    const throws = stats.reduce((sum, entry) => sum + entry.throws, 0);
    const ctx: AwardContext = {
        averageAccuracy: getAccuracy({ hits, throws }),
        maxPoints: Math.max(0, ...stats.map(entry => entry.points)),
    };
    const result: (KnechtAward | null)[] = stats.map(() => null);

    // Seltene Titel zuerst, je Titel an den Spieler, auf den er am besten passt
    AWARD_RULES.forEach(rule => {
        let best = -1;
        let bestStrength = -Infinity;
        stats.forEach((entry, index) => {
            if (result[index]) return;
            const strength = rule.strength(entry, ctx);
            if (strength !== null && strength > bestStrength) { best = index; bestStrength = strength; }
        });
        if (best >= 0) result[best] = { icon: rule.icon, title: rule.title, detail: rule.detail(stats[best], ctx) };
    });

    return result.map((award, index) => {
        if (award) return award;
        const fallback = FALLBACK_AWARDS.find(candidate => candidate.applies(stats[index], ctx))!;
        return { icon: fallback.icon, title: fallback.title, detail: fallback.detail(stats[index]) };
    });
};

// Lustiger Text fuer den Speichern-Knopf
const SAVE_LABELS = ['Ab in die Tabelle!', 'Spiel eintragen – Prost!', 'Für die Ewigkeit speichern', 'Ergebnis ins Buch der Legenden'];
export const getSaveLabel = (seed: number) => SAVE_LABELS[Math.abs(seed) % SAVE_LABELS.length];
