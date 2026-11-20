// Anstoss-Lobby vor einem Knecht-Spiel mit mehreren Handys: Handys aneinanderstossen oder Code eingeben, Teams und
// Farben waehlen, Spieler ohne Handy dazunehmen. Mit dem Start wird daraus ein Live-Spiel (biPoKnecht/knechtLive.ts),
// jedes Handy tritt dort als sein Spieler bei. Jede Aenderung der Lobby erhoeht version (zwei Handys gleichzeitig).

export type MpPlayer = {
    deviceId: string;   // bei Spielern ohne Handy eine erfundene Kennung
    name: string;
    team: number;       // 0 | 1
    joinedAt: number;
    phone?: boolean;    // false: Spieler ohne eigenes Handy (ein Handy seines Teams traegt fuer ihn ein)
    ready?: boolean;    // hat in der Lobby "Bereit" gedrueckt
};

// lobby: Spieler sammeln, started: Spiel laeuft (live zeigt wohin), aborted: alle weg
export type MpStatus = 'lobby' | 'started' | 'aborted';

export type MpSession = {
    code: string;
    hostId: string;
    status: MpStatus;
    players: MpPlayer[];
    cupColors?: string[] | null;            // Becherfarben je Team
    live?: { id: string; code: string } | null;
    gameKind?: MpGameKind | null;           // was gespielt wird (Standard: offen)
    version: number;
};

// Offenes Spiel oder noch offenes Liga-/Cup-Spiel der beiden Teams
export type MpGameKind = 'open' | 'league' | 'cup';

export type MpPatch = Partial<Pick<MpSession, 'status' | 'players' | 'cupColors' | 'live' | 'gameKind'>>;

export type MpBumpResult =
    | { session: MpSession }
    | { bumpId: string; pending: boolean; expired: boolean };

export const MAX_PLAYERS_PER_TEAM = 3;

export class MpError extends Error {
    constructor(message: string, public status?: number) {
        super(message);
    }
}

// Spieler eines Teams in Beitrittsreihenfolge (= Reihenfolge im Knecht)
export const getTeamPlayers = (players: MpPlayer[], team: number) =>
    players.filter(player => player.team === team).sort((a, b) => a.joinedAt - b.joinedAt);

export const hasPhone = (player: MpPlayer) => player.phone !== false;

// Spieler ohne Handy zaehlen als bereit (ihr Team-Handy entscheidet)
export const isReady = (player: MpPlayer) => !hasPhone(player) || !!player.ready;
export const allReady = (players: MpPlayer[]) => players.length > 0 && players.every(isReady);
// Teams geaendert: alle muessen nochmal bestaetigen
export const unready = (players: MpPlayer[]) => players.map(player => ({ ...player, ready: false }));
