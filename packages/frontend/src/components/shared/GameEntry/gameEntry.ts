import { computed, ref } from 'vue';

// Datenmodell des GameEntryDrawer: zwei Seiten mit Spielern und deren Treffern.
// Bewusst unabhaengig von Match, damit offene Spiele, Liga, Pokal und Turnier denselben Drawer nutzen.

export type GameEntryPlayer = {
    name: string;
    score: number | null;   // null = noch keine Treffer gewaehlt
};

export type GameEntrySide = {
    name?: string;          // Teamname (Turnier), sonst ergibt sich der Name aus den Spielern
    logo?: string;
    players: GameEntryPlayer[];
};

export const createEmptySides = (playersPerSide = 1): GameEntrySide[] =>
    [0, 1].map(() => ({ players: Array.from({ length: playersPerSide }, () => ({ name: '', score: null })) }));

export const getSideName = (side: GameEntrySide) =>
    side.name || side.players.map(player => player.name.trim()).filter(name => name).join(' & ');

// Summe der Treffer, null solange ein Spieler noch keine Treffer hat.
export const getSideScore = (side: GameEntrySide) =>
    side.players.every(player => player.score !== null)
        ? side.players.reduce((sum, player) => sum + (player.score ?? 0), 0)
        : null;

// ─── Wahrscheinliche Treffer ───
// Damit der ScorePicker naheliegende Werte groesser zeigt. Gespielt wird bis 10, die Verteilung
// der Verlierer-Summen stammt aus ~1000 offenen und Liga-Spielen (Stand 11/2026).
const WIN_SCORE = 10;
const LOSER_TOTALS: Record<number, number> = { 9: 30, 8: 25, 7: 13, 6: 9, 5: 6, 4: 4, 3: 3, 2: 1, 1: 0.5, 0: 0.5 };
const LOSER_TOTALS_SUM = Object.values(LOSER_TOTALS).reduce((sum, count) => sum + count, 0);

// Seitensumme je nach Gegnersumme (null = noch offen): Sieger 10, Verlierer laut Verteilung,
// Verlaengerung knapp um den Gegner herum.
const getTotalChances = (opponentTotal: number | null) => {
    const chances = new Map<number, number>();
    const add = (total: number, chance: number) => chances.set(total, (chances.get(total) ?? 0) + chance);
    const addLoser = (share: number) => Object.entries(LOSER_TOTALS).forEach(([total, count]) => add(Number(total), share * count / LOSER_TOTALS_SUM));

    if (opponentTotal === null) {
        add(WIN_SCORE, 0.5);
        addLoser(0.5);
    } else if (opponentTotal < WIN_SCORE) {
        add(WIN_SCORE, 1);
    } else if (opponentTotal === WIN_SCORE) {
        addLoser(1);
    } else {
        for (let distance = 1; distance <= 3; distance++) {
            add(opponentTotal - distance, 1);
            add(opponentTotal + distance, 1);
        }
    }
    return chances;
}

const binomial = (k: number, n: number, p: number) => {
    if (k < 0 || k > n) return 0;
    let coefficient = 1;
    for (let i = 0; i < k; i++) coefficient = coefficient * (n - i) / (i + 1);
    return coefficient * p ** k * (1 - p) ** (n - k);
}

// Wahrscheinlichkeit je Trefferwert (Index = Treffer). Bekannte Mitspieler werden von der Seitensumme abgezogen,
// den Rest teilen sich der Spieler und seine noch offenen Mitspieler gleichmaessig (1v1: genau der Rest).
export const getScoreChances = (sides: GameEntrySide[], sideIndex: number, playerIndex: number, maxScore: number): number[] => {
    const teammates = sides[sideIndex].players.filter((_, index) => index !== playerIndex);
    const knownSum = teammates.reduce((sum, player) => sum + (player.score ?? 0), 0);
    const openCount = 1 + teammates.filter(player => player.score === null).length;
    const totalChances = getTotalChances(getSideScore(sides[1 - sideIndex]));

    return Array.from({ length: maxScore + 1 }, (_, score) => {
        let chance = 0;
        totalChances.forEach((totalChance, total) => chance += totalChance * binomial(score, Math.round(total - knownSum), 1 / openCount));
        return chance;
    });
}

// Turnierspiele speichern das Ergebnis (noch) als result-Objekt statt an den Spielern.
const getLegacyPlayerScore = (match: Match, teamIndex: number, playerIndex: number): number | undefined => {
    const score = (match as any).result?.[`team${teamIndex + 1}Player${playerIndex + 1}Score`];
    return typeof score === 'number' ? score : undefined;
}

export const matchToSides = (match: Match): GameEntrySide[] =>
    [match.team1, match.team2].map((team, teamIndex) => ({
        name: team.name,
        logo: team.logo,
        players: team.players.map((player, playerIndex) => ({
            name: player.name ?? '',
            score: getLegacyPlayerScore(match, teamIndex, playerIndex) ?? player.score ?? null,
        })),
    }));

const toTeam = (side: GameEntrySide, baseTeam?: Team): Team => {
    const team: Team = {
        ...(baseTeam ?? { _id: 'placeholder' }),
        players: side.players.map((player, index) => ({
            ...(baseTeam?.players[index] ?? { _id: 'placeholder' }),
            name: player.name.trim(),
            score: player.score ?? 0,
        })),
    };
    // Optionaler Teamname (offene Spiele): leer = kein Name, dann zeigt die Seite die Spieler
    const name = side.name?.trim();
    if (name) team.name = name;
    else if (side.name !== undefined) delete team.name;
    return team;
};

// Bestehendes Spiel mit den Werten aus dem Drawer (Kopie, das Original bleibt unveraendert).
export const applySidesToMatch = (match: Match, sides: GameEntrySide[]): Match => ({
    ...JSON.parse(JSON.stringify(match)),
    team1: toTeam(sides[0], match.team1),
    team2: toTeam(sides[1], match.team2),
});

// Neues Spiel, extra z.B. { season, league } oder { cupId, cupRound }.
export const sidesToNewMatch = (sides: GameEntrySide[], extra: Partial<Match> = {}): Match => ({
    _id: 'placeholder',
    time: new Date().getTime(),
    ...extra,
    team1: toTeam(sides[0]),
    team2: toTeam(sides[1]),
});

// Backend: ein Drawer pro Seite, MatchElement meldet per @edit, welches Spiel bearbeitet wird.
export function useMatchEdit() {
    const editingMatch = ref<Match>();
    const editVisible = ref(false);
    const editSides = computed(() => editingMatch.value ? matchToSides(editingMatch.value) : undefined);

    const openEdit = (match: Match) => {
        editingMatch.value = match;
        editVisible.value = true;
    }

    return { editingMatch, editVisible, editSides, openEdit };
}
