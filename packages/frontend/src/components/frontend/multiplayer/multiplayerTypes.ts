import type { KnechtAction } from '../biPoKnecht/knechtEngine';

// Mehrspieler-Knecht: jedes Handy ist ein Spieler. Der gemeinsame Stand liegt im Backend (KnechtSession),
// jede Aenderung erhoeht version. So merkt ein Handy, wenn ein anderes schneller war.

export type MpPlayer = {
    deviceId: string;
    name: string;
    team: number;       // 0 | 1
    joinedAt: number;
};

export type MpStatus = 'lobby' | 'playing' | 'saving' | 'saved' | 'aborted';

// Ergebnis eines gespeicherten Spiels, damit alle Handys es anzeigen koennen
export type MpResult = {
    id: number;
    match: Match;
    path: string;
    rematch: boolean;
    savedBy: string;
};

// Speichern und Abbrechen brauchen das OK aller Handys
export type MpVote = {
    id: number;
    kind: 'save' | 'abort';
    by: string;                 // deviceId, wer gefragt hat
    rematch: boolean;           // speichern und Revanche
    approvals: string[];        // deviceIds mit OK
    declinedBy: string | null;
    createdAt: number;
};

export type MpSession = {
    code: string;
    hostId: string;
    status: MpStatus;
    players: MpPlayer[];
    match: Match | null;
    startTeamIndex: number | null;
    actions: KnechtAction[];
    authors: string[];
    paused?: boolean;
    vote?: MpVote | null;
    savingBy: string | null;
    result: MpResult | null;
    version: number;
};

export type MpPatch = Partial<Pick<MpSession, 'status' | 'players' | 'match' | 'startTeamIndex' | 'actions' | 'authors' | 'paused' | 'vote' | 'savingBy' | 'result'>>;

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
