import { isCupGame } from '@/components/frontend/league/LeagueUtilFunctions';

export type GameType = 'league' | 'cup' | 'open';
export type GameFilter = 'all' | GameType;

export type ResultEntry = { match: Match; type: GameType; time: number };

export const GAME_FILTERS: { label: string; value: GameFilter }[] = [
    { label: 'Alle', value: 'all' },
    { label: 'Liga', value: 'league' },
    { label: 'Cup', value: 'cup' },
    { label: 'Offen', value: 'open' },
];

export const isGameFilter = (value: unknown): value is GameFilter =>
    GAME_FILTERS.some(filter => filter.value === value);

// Offene Spiele und Liga/Cup in einer Liste, neuestes zuerst. Liga-Teams bekommen ihr Logo.
export const combineResults = (openGames: Match[], leagueGames: Match[]): ResultEntry[] => [
    ...openGames.map(match => ({ match, type: 'open' as GameType, time: match.time ?? 0 })),
    ...leagueGames.map(match => ({ match, type: (isCupGame(match) ? 'cup' : 'league') as GameType, time: match.time ?? 0 })),
].sort((a, b) => b.time - a.time);

export const matchesFilter = (entry: ResultEntry, filter: GameFilter) =>
    filter === 'all' || entry.type === filter;

// Suche ohne Gross-/Kleinschreibung und Akzente: "jerome" findet "Jérôme"
const normalize = (text: string) => text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Treffer im Spielernamen oder im Teamnamen (Liga-Teams heissen anders als ihr Spieler)
export const matchesPlayer = (match: Match, query: string) => {
    const needle = normalize(query);
    if (!needle) return true;

    return [match.team1, match.team2].some(team => team && (
        normalize(team.name ?? '').includes(needle)
        || team.players.some(player => normalize(player.name).includes(needle))
    ));
};

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Tagesueberschrift: "Fr, 31.10.", aus frueheren Jahren mit Jahreszahl
export const formatResultDay = (time: number) => {
    const date = new Date(time);
    const day = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
    const year = date.getFullYear() === new Date().getFullYear() ? '' : date.getFullYear();
    return `${WEEKDAYS[date.getDay()]}, ${day}${year}`;
};

