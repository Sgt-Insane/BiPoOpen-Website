import { addLeagueGame } from '../league/LeagueUtilFunctions';
import { addOpenGame } from '../openGames/OpenGamesUtilFunctions';
import { CUP_URL_SEGMENT } from '../league/cup/LeagueCupUtilFunctions';
import { clearGameDataCache } from '@/util/gameDataCache';
import { addDemoGame, isDemoMode } from '@/util/demoGames';
import { formatEdge, formatHitEdge } from './knechtEdges';
import { useAddGame } from '@/components/shared/GameEntry/useAddGame';
import { getFinalPlayerPoints, isHitTurnType, type KnechtState } from './knechtEngine';
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
    if (turn.type === 'miss' && data.edge) return `Verfehlt · ${formatEdge(data.edge as EdgeHit)}`;
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

// ─── Titel nach dem Spiel (nicht die Auszeichnungen im Spielerprofil) ───
// Jeder Spieler bekommt genau einen: das Auffaelligste aus seinem Spiel, positiv oder negativ.
// Reihenfolge: erst die seltenen Titel (echte Highlights), dann haeufigere, zuletzt fuer jeden, der noch keinen
// hat, sein auffaelligster Wert. Jeder Titel (ausser dem letzten Rueckfall) wird hoechstens einmal je Spiel
// vergeben, und zwar an den Spieler, auf den er am besten passt.
// Schwellen nach 60 Knecht-Spielen mit Wurfverlauf (162 Spieler, Stand 11/2026): Trefferquote Median 20 %,
// oberes Viertel ab 26 %, oberste 10 % ab 35 %, unteres Viertel unter 16 %; beste Serie meist 2, ab 3 selten;
// laengste Serie ohne Treffer Median 10, oberes Viertel ab 14; Wuerfe Median 29, oberes Viertel ab 42.
export type KnechtAward = { icon: string; title: string; detail: string };

type AwardContext = {
    averageAccuracy: number;
    maxStreak: number;
    teamSize: (teamIndex: number) => number;
    teamPoints: (teamIndex: number) => number;
    // Bester/schlechtester Wert im Spiel (nur eindeutig: bei Gleichstand keiner)
    isTop: (s: KnechtPlayerStats, value: (s: KnechtPlayerStats) => number) => boolean;
    isBottom: (s: KnechtPlayerStats, value: (s: KnechtPlayerStats) => number) => boolean;
    won: (teamIndex: number) => boolean;
};
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
    // Oberste 10 % (ab 35 %), bei genug Wuerfen
    { icon: '🦅', title: 'Adlerauge', strength: s => when(s.throws >= 10 && getAccuracy(s) >= 35, getAccuracy(s)), detail: s => `${getAccuracy(s)} % Trefferquote (${s.hits}/${s.throws})` },
    { icon: '😬', title: 'Kantenkönig', strength: s => when(s.edges >= 2, s.edges), detail: s => `${s.edges}× nur die Kante – so knapp` },
    { icon: '✈️', title: 'Luftpost', strength: s => when(s.airballs >= 3, s.airballs), detail: s => `${s.airballs} Airballs – die Wand freut sich` },
    // Nur wer deutlich schlechter als der Rest getroffen hat, nicht wenn alle schwach waren
    { icon: '🎳', title: 'Zielwasser vergessen', strength: (s, ctx) => when(s.throws >= 6 && getAccuracy(s) < 25 && getAccuracy(s) <= ctx.averageAccuracy - 10, 100 - getAccuracy(s)), detail: s => `Nur ${s.hits} Treffer bei ${s.throws} Würfen` },
];

// Haeufigere Momente: fast jedes Spiel hat welche. Erst nach den seltenen Titeln, gleiche Regeln (je Titel ein Spieler).
const COMMON_RULES: AwardRule[] = [
    { icon: '🔗', title: 'Serientäter', strength: s => when(s.bestStreak >= 3, s.bestStreak), detail: s => `${s.bestStreak} Treffer in Folge` },
    { icon: '🏆', title: 'Topscorer', strength: (s, ctx) => when(s.points >= 6 && ctx.isTop(s, entry => entry.points), s.points), detail: s => `Meiste Becher im Spiel: ${formatPoints(s.points)}` },
    { icon: '🎯', title: 'Treffsicher', strength: (s, ctx) => when(s.throws >= 10 && getAccuracy(s) >= 26 && ctx.isTop(s, getAccuracy), getAccuracy(s)), detail: s => `${getAccuracy(s)} % – beste Quote im Spiel (${s.hits}/${s.throws})` },
    { icon: '🔄', title: 'Rückholer', strength: s => when(s.ballsBacks >= 1, s.ballsBacks), detail: s => s.ballsBacks === 1 ? 'Balls Back geholt' : `${s.ballsBacks}× Balls Back geholt` },
    { icon: '🤲', title: 'Fänger', strength: s => when(s.trickshotCatches >= 1, s.trickshotCatches), detail: s => plural(s.trickshotCatches, 'Ball für einen Trickshot gefangen', 'Bälle für einen Trickshot gefangen') },
    { icon: '🏁', title: 'Schlussmacher', strength: (s, ctx) => when(s.lastCups > 0 && ctx.won(s.teamIndex), s.lastCups), detail: () => 'Den letzten Becher versenkt' },
    { icon: '🛩️', title: 'Bruchpilot', strength: s => when(s.airballs >= 2, s.airballs), detail: s => `${s.airballs} Airballs` },
    // Oberes Viertel (ab 14 Wuerfen ohne Treffer) und die laengste im Spiel
    { icon: '🏜️', title: 'Durststrecke', strength: (s, ctx) => when(s.longestDrought >= 14 && ctx.isTop(s, entry => entry.longestDrought), s.longestDrought), detail: s => `${s.longestDrought} Würfe am Stück ohne Treffer` },
    // Unteres Viertel (unter 16 %) und die schlechteste im Spiel
    { icon: '🥶', title: 'Kalte Hand', strength: (s, ctx) => when(s.throws >= 10 && getAccuracy(s) < 16 && ctx.isBottom(s, getAccuracy), 100 - getAccuracy(s)), detail: s => `${getAccuracy(s)} % Trefferquote (${s.hits}/${s.throws})` },
    { icon: '🏋️', title: 'Dauerwerfer', strength: (s, ctx) => when(s.throws >= 42 && ctx.isTop(s, entry => entry.throws), s.throws), detail: s => `${s.throws} Würfe – meiste im Spiel` },
    { icon: '🧱', title: 'Fels in der Brandung', strength: (s, ctx) => when(ctx.teamSize(s.teamIndex) > 1 && s.points > ctx.teamPoints(s.teamIndex) / 2, s.points), detail: (s, ctx) => `${formatPoints(s.points)} von ${formatPoints(ctx.teamPoints(s.teamIndex))} Bechern fürs Team` },
];

// Rueckfall, damit jeder eine bekommt: der auffaelligere Wert des Spielers, auch mehrfach im selben Spiel
const fallbackAward = (s: KnechtPlayerStats): KnechtAward => s.longestDrought >= 10
    ? { icon: '🐌', title: 'Langer Atem', detail: `${s.longestDrought} Würfe am Stück ohne Treffer – drangeblieben` }
    : { icon: '🍺', title: 'Lieferdienst', detail: `${formatPoints(s.points)} Becher an den Gegner geliefert${s.bestStreak > 1 ? ` · ${s.bestStreak} in Folge` : ''}` };

// Wer 0 Becher hat, schuldet eine nackte Meile
const NACKT_AWARD: KnechtAward = { icon: '🍑', title: 'Nackt', detail: '0 Becher – die nackte Meile ruft' };

// Je Spieler (gleiche Reihenfolge wie stats) ein Titel oder null
export const getAwards = (stats: KnechtPlayerStats[]): (KnechtAward | null)[] => {
    const hits = stats.reduce((sum, entry) => sum + entry.hits, 0);
    const throws = stats.reduce((sum, entry) => sum + entry.throws, 0);
    const teamPoints = (teamIndex: number) => stats.filter(entry => entry.teamIndex === teamIndex).reduce((sum, entry) => sum + entry.points, 0);
    const extreme = (s: KnechtPlayerStats, value: (s: KnechtPlayerStats) => number, sign: 1 | -1) =>
        stats.every(entry => entry === s || sign * value(s) > sign * value(entry));
    const ctx: AwardContext = {
        averageAccuracy: getAccuracy({ hits, throws }),
        maxStreak: Math.max(0, ...stats.map(entry => entry.bestStreak)),
        teamSize: teamIndex => stats.filter(entry => entry.teamIndex === teamIndex).length,
        teamPoints,
        isTop: (s, value) => extreme(s, value, 1),
        isBottom: (s, value) => extreme(s, value, -1),
        won: teamIndex => teamPoints(teamIndex) > teamPoints(1 - teamIndex),
    };
    // Nackt bekommt jeder ohne Becher, auch mehrere Spieler
    const result: (KnechtAward | null)[] = stats.map(entry => entry.points === 0 ? NACKT_AWARD : null);

    // Seltene Titel zuerst, je Titel an den Spieler, auf den er am besten passt, dann die haeufigeren
    [...AWARD_RULES, ...COMMON_RULES].forEach(rule => {
        let best = -1;
        let bestStrength = -Infinity;
        stats.forEach((entry, index) => {
            if (result[index]) return;
            const strength = rule.strength(entry, ctx);
            if (strength !== null && strength > bestStrength) { best = index; bestStrength = strength; }
        });
        if (best >= 0) result[best] = { icon: rule.icon, title: rule.title, detail: rule.detail(stats[best], ctx) };
    });

    // Wer noch nichts hat (z.B. ohne eigenes Handy kaum aufgefallen), bekommt seinen auffaelligsten Wert.
    // Nur wer gar nicht geworfen hat, bleibt ohne.
    return result.map((award, index) => award ?? (stats[index].throws ? fallbackAward(stats[index]) : null));
};

// Lustiger Text fuer den Speichern-Knopf
const SAVE_LABELS = ['Ab in die Tabelle!', 'Spiel eintragen – Prost!', 'Für die Ewigkeit speichern', 'Ergebnis ins Buch der Legenden'];
export const getSaveLabel = (seed: number) => SAVE_LABELS[Math.abs(seed) % SAVE_LABELS.length];
