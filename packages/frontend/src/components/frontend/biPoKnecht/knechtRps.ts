// Schnick-Schnack-Schnuck mit festem Zufall: alle Handys eines Lobby-Spiels rechnen aus demselben Startwert
// (Kennung des Live-Spiels) dieselben Runden aus. So zeigt jedes Handy dieselben Haende und denselben Gewinner,
// ohne dass das Ergebnis erst verschickt werden muss.

export const RPS_HANDS = ['✊', '✋', '✌️'];
const MAX_ROUNDS = 8;

// Kleiner, schneller Zufallsgenerator (mulberry32) mit Startwert aus dem Text
const createRandom = (seed: string) => {
    let state = 2166136261;
    for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

export type RpsRound = { hands: [number, number]; winner: number | null };

// Runden bis zum ersten Gewinner (Stein > Schere > Papier > Stein). Nach zu vielen Unentschieden entscheidet die letzte Runde.
export const playSeededRps = (seed: string): RpsRound[] => {
    const random = createRandom(seed || 'bipo');
    const rounds: RpsRound[] = [];
    for (let round = 0; round < MAX_ROUNDS; round++) {
        const hands: [number, number] = [Math.floor(random() * 3), Math.floor(random() * 3)];
        if (hands[0] !== hands[1]) {
            rounds.push({ hands, winner: (hands[0] - hands[1] + 3) % 3 === 1 ? 0 : 1 });
            return rounds;
        }
        rounds.push({ hands, winner: null });
    }
    // Sehr unwahrscheinlich: letzte Runde wird zur Entscheidung umgebaut
    const last = rounds[rounds.length - 1];
    last.hands = [0, 2];
    last.winner = 0;
    return rounds;
};
