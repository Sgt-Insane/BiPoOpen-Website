import { addLeagueGame } from '../league/LeagueUtilFunctions';
import { addOpenGame } from '../openGames/OpenGamesUtilFunctions';
import { CUP_URL_SEGMENT } from '../league/cup/LeagueCupUtilFunctions';
import { clearGameDataCache } from '@/util/gameDataCache';
import { addDemoGame, isDemoMode } from '@/util/demoGames';
import { formatEdge, formatHitEdge } from './knechtEdges';
import { useAddGame } from '@/components/shared/GameEntry/useAddGame';
import { getFinalPlayerPoints, isHitTurnType, isTrickshotAirball, isTrickshotThrow, type KnechtState } from './knechtEngine';
import { getAccuracy, getTurnStats, type KnechtPlayerStats } from './knechtStats';

export type KnechtGameKind = 'open' | 'league' | 'cup';

export const TEAM_COLORS = ['#EA5160', '#61C3D9'];

// Becherfarbe je Team: rot/blau, vor Spielbeginn tauschbar (match.cupColors, wird mit dem Spiel gespeichert)
export const getTeamColor = (match: Match, teamIndex: number) => match.cupColors?.[teamIndex] ?? TEAM_COLORS[teamIndex];
export const swapCupColors = (match: Match) => {
    match.cupColors = [getTeamColor(match, 1), getTeamColor(match, 0)];
};

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

// Kurzname fuer schmale Stellen: Vorname, bei gleichem Vornamen im Spiel mit Initiale ("Matthias W.").
// Liga- und Cup-Teams sind als einziger "Spieler" gespeichert: Teamnamen nie kuerzen ("JP Burgundy", nicht "JP").
export const getShortPlayerName = (match: Match, teamIndex: number, playerIndex: number) => {
    const full = getPlayerName(match, teamIndex, playerIndex).trim();
    const isLeagueOrCup = !!match.cupId || !!match.season || match.league !== undefined;
    if (isLeagueOrCup || getTeam(match, teamIndex).logo) return full;
    const parts = full.split(/\s+/);
    if (parts.length < 2) return full;
    const others = [match.team1, match.team2].flatMap(team => team?.players ?? []).map(player => player.name.trim()).filter(name => name !== full);
    const clash = others.some(name => name.split(/\s+/)[0] === parts[0]);
    return clash ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

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
    // Re-Racks, Nachwurf und Verlaengerung fuer den Spielverlauf auf der Webseite
    if (state.markers.length) result.events = state.markers.map(({ kind, teamIndex, afterTurnIndex, time }) => ({ kind, teamIndex, afterTurnIndex, time }));
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
        useAddGame().notifyGameSaved();
    }
    return success;
};

// Revanche: gleiche Teams und gleicher Wettbewerb, neues Spiel
export const toRematch = (match: Match): Match => ({
    _id: 'placeholder',
    team1: { ...match.team1, players: match.team1.players.map(player => ({ ...player, score: 0 })) },
    team2: { ...match.team2, players: match.team2.players.map(player => ({ ...player, score: 0 })) },
    ...(match.season !== undefined && { season: match.season }),
    ...(match.league !== undefined && { league: match.league }),
    ...(match.cupId !== undefined && { cupId: match.cupId, cupRound: match.cupRound }),
    ...(match.cupColors && { cupColors: match.cupColors }),
});

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
    penalty: 'Ellenbogen',
};

// Treffer mit Trickshot: der Faenger des vorherigen Wurfs hat getroffen
const isTrickshotHit = isTrickshotThrow;

// Treffer werden immer als "Treffer · Art" beschrieben, z.B. "Treffer · Bouncer (2 Becher)"
export const getTurnLabel = (turn: Turn, match?: Match, previous?: Turn) => {
    const data = (turn.data ?? {}) as Record<string, unknown>;
    if (turn.type === 'trickshot') {
        const catcher = match && typeof data.catcherIndex === 'number' ? getPlayerName(match, turn.teamIndex, data.catcherIndex) : '';
        return catcher ? `Verfehlt · ${catcher} fängt (Trickshot)` : 'Verfehlt · Trickshot-Fang';
    }
    if (turn.type === 'miss' && data.edge) return `Verfehlt · ${formatEdge(data.edge as EdgeHit)}`;
    if (isTrickshotAirball(turn, previous)) return 'Airball beim Trickshot (zählt nicht)';
    if (turn.type === 'penalty') return data.card === 'red' ? 'Ellenbogen · Rote Karte, Strafbecher' : 'Ellenbogen · Gelbe Karte';
    if (turn.type === 'owncup') return `${(data.cups as number[]).length} eigene${(data.cups as number[]).length === 1 ? 'r' : ''} Becher runter`;
    if (!isHitTurnType(turn.type)) return TURN_LABELS[turn.type];

    const kinds = [
        turn.type !== 'hit' && TURN_LABELS[turn.type],
        turn.type !== 'bouncer' && data.bouncer && TURN_LABELS.bouncer,
        data.double && 'Doppeltreffer',
        isTrickshotHit(turn, previous) && TURN_LABELS.trickshot,
        !!data.edge && formatHitEdge(data.edge as EdgeHit),
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
// Nur fuer wirklich Besonderes: nicht jeder Spieler und nicht jedes Spiel bekommt eine. Jeder Titel wird hoechstens
// einmal vergeben, und zwar an den Spieler, auf den er am besten passt (nicht an den, der zufaellig zuerst geprueft
// wird). Jeder Spieler bekommt hoechstens einen Titel, seltene Titel zuerst.
export type KnechtAward = { icon: string; title: string; detail: string };

type AwardContext = { averageAccuracy: number; maxStreak: number; teamSize: (teamIndex: number) => number; teamPoints: (teamIndex: number) => number };
// strength: wie gut der Titel passt (hoeher = besser), null = passt nicht
type AwardRule = { icon: string; title: string; strength: (s: KnechtPlayerStats, ctx: AwardContext) => number | null; detail: (s: KnechtPlayerStats, ctx: AwardContext) => string };

const plural = (count: number, one: string, many: string) => `${formatPoints(count)} ${count === 1 ? one : many}`;
const when = (condition: boolean, strength: number) => condition ? strength : null;

// Nach Seltenheit sortiert: seltene Titel werden zuerst verteilt
const AWARD_RULES: AwardRule[] = [
    // Alle 10 Becher allein abgeraeumt (im 1 gegen 1 normal, daher nur mit Mitspielern)
    // Nur mit echten Treffern: ein Deathcup bringt die restlichen Becher als Punkte, ist aber kein Abraeumen
    { icon: '🔟', title: '10/10', strength: (s, ctx) => when(ctx.teamSize(s.teamIndex) > 1 && s.points >= 10 && s.deathcups === 0, s.points), detail: () => 'Alle 10 Becher allein abgeräumt' },
    { icon: '💯', title: 'Makellos', strength: s => when(s.throws >= 5 && s.hits === s.throws, s.throws), detail: s => `${s.hits}/${s.throws} – jeder Wurf ein Treffer` },
    { icon: '💀', title: 'Sensenmann', strength: s => when(s.deathcups > 0, s.deathcups), detail: () => 'Deathcup versenkt – Spiel sofort beendet' },
    { icon: '🎪', title: 'Zirkusartist', strength: s => when(s.trickshotHits > 0, s.trickshotHits), detail: s => plural(s.trickshotHits, 'Trickshot verwandelt', 'Trickshots verwandelt') },
    { icon: '🧨', title: 'Bombenleger', strength: s => when(s.bombs > 0, s.bombs), detail: s => plural(s.bombs, 'Bombe gelegt', 'Bomben gelegt') },
    { icon: '🤸', title: 'Fangkünstler', strength: s => when(s.trickshotCatches >= 2, s.trickshotCatches), detail: s => `${s.trickshotCatches} Bälle für einen Trickshot gefangen` },
    { icon: '🙈', title: 'Eigentor-Spezialist', strength: s => when(s.ownCups > 0, s.ownCups), detail: s => plural(s.ownCups, 'eigener Becher vom Tisch geräumt', 'eigene Becher vom Tisch geräumt') },
    { icon: '🟨', title: 'Verwarnt', strength: s => when(s.penalties > 0, s.penalties), detail: s => plural(s.penalties, 'Karte kassiert', 'Karten kassiert') },
    { icon: '🔥', title: 'Feuerteufel', strength: s => when(s.onFires > 0, s.onFires), detail: s => plural(s.onFires, 'Treffer im On-Fire-Modus', 'Treffer im On-Fire-Modus') },
    { icon: '🏀', title: 'Bouncer-König', strength: s => when(s.bouncers > 0, s.bouncers), detail: s => `${s.bouncers} Bouncer über den Tisch` },
    // 🪃 gibt es unter Windows 10 nicht
    { icon: '🔄', title: 'Bumerang', strength: s => when(s.ballsBacks >= 2, s.ballsBacks), detail: s => `${s.ballsBacks}× Balls Back – die Bälle kommen immer zurück` },
    // Im Team fast alles allein gemacht (10/10 ist schon oben)
    { icon: '🦸', title: 'Alleinunterhalter', strength: (s, ctx) => when(ctx.teamSize(s.teamIndex) > 1 && s.points >= 7, s.points), detail: (s, ctx) => `${formatPoints(s.points)} von ${formatPoints(ctx.teamPoints(s.teamIndex))} Bechern fürs Team` },
    // Laengste Serie des Spiels, aber erst ab 4 Treffern in Folge
    { icon: '🎯', title: 'Scharfschütze', strength: (s, ctx) => when(s.bestStreak >= 4 && s.bestStreak === ctx.maxStreak, s.bestStreak), detail: s => `Längste Serie im Spiel: ${s.bestStreak} Treffer in Folge` },
    // Der letzte Becher faellt in jedem Spiel: nur auszeichnen, wenn es knapp war (Gegner bei mindestens 8)
    // und das eigene Team gewonnen hat (ein letzter Becher vor der Verlaengerung entscheidet nichts)
    { icon: '🧊', title: 'Eiskalt', strength: (s, ctx) => when(s.lastCups > 0 && ctx.teamPoints(1 - s.teamIndex) >= 8 && ctx.teamPoints(s.teamIndex) > ctx.teamPoints(1 - s.teamIndex), ctx.teamPoints(1 - s.teamIndex)), detail: (s, ctx) => `Letzten Becher zum ${formatPoints(ctx.teamPoints(s.teamIndex))} : ${formatPoints(ctx.teamPoints(1 - s.teamIndex))} versenkt` },
    { icon: '🦅', title: 'Adlerauge', strength: s => when(s.throws >= 6 && getAccuracy(s) >= 60, getAccuracy(s)), detail: s => `${getAccuracy(s)} % Trefferquote (${s.hits}/${s.throws})` },
    { icon: '😬', title: 'Kantenkönig', strength: s => when(s.edges >= 3, s.edges), detail: s => `${s.edges}× nur die Kante – so knapp` },
    { icon: '✈️', title: 'Luftpost', strength: s => when(s.airballs >= 3, s.airballs), detail: s => `${s.airballs} Airballs – die Wand freut sich` },
    // Nur wer deutlich schlechter als der Rest getroffen hat, nicht wenn alle schwach waren
    { icon: '🎳', title: 'Zielwasser vergessen', strength: (s, ctx) => when(s.throws >= 6 && getAccuracy(s) < 25 && getAccuracy(s) <= ctx.averageAccuracy - 10, 100 - getAccuracy(s)), detail: s => `Nur ${s.hits} Treffer bei ${s.throws} Würfen` },
];

// Wer 0 Becher hat, schuldet eine nackte Meile
const NACKT_AWARD: KnechtAward = { icon: '🍑', title: 'Nackt', detail: '0 Becher – die nackte Meile ruft' };

// Je Spieler (gleiche Reihenfolge wie stats) ein Titel oder null
export const getAwards = (stats: KnechtPlayerStats[]): (KnechtAward | null)[] => {
    const hits = stats.reduce((sum, entry) => sum + entry.hits, 0);
    const throws = stats.reduce((sum, entry) => sum + entry.throws, 0);
    const ctx: AwardContext = {
        averageAccuracy: getAccuracy({ hits, throws }),
        maxStreak: Math.max(0, ...stats.map(entry => entry.bestStreak)),
        teamSize: teamIndex => stats.filter(entry => entry.teamIndex === teamIndex).length,
        teamPoints: teamIndex => stats.filter(entry => entry.teamIndex === teamIndex).reduce((sum, entry) => sum + entry.points, 0),
    };
    // Nackt bekommt jeder ohne Becher, auch mehrere Spieler
    const result: (KnechtAward | null)[] = stats.map(entry => entry.points === 0 ? NACKT_AWARD : null);

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

    return result;
};

// Lustiger Text fuer den Speichern-Knopf
const SAVE_LABELS = ['Ab in die Tabelle!', 'Spiel eintragen – Prost!', 'Für die Ewigkeit speichern', 'Ergebnis ins Buch der Legenden'];
export const getSaveLabel = (seed: number) => SAVE_LABELS[Math.abs(seed) % SAVE_LABELS.length];
