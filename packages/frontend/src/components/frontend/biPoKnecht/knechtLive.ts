import axios from 'axios';
import { isDemoMode } from '@/util/demoGames';
import { isFeatureOn } from '@/util/featureFlags';
import type { KnechtAction } from './knechtEngine';

// Live-Spiele: laufende Knecht-Spiele fuer den Live-Ticker und fuer das Tracking mit zwei Handys.
// Demo-Modus (lokaler Dev-Server): Zwischenspeicher im Vite-Server (/__live), nie die echte Datenbank.

export type LiveGame = {
    id: string;
    match: Match;
    startTeamIndex: number | null;
    startedAt: number | null;
    actions: KnechtAction[];
    version: number;
    status: 'live' | 'done' | 'aborted';
    devices: number;
    updatedAt: number;
};

// Schreibrecht eines Handys fuer ein Live-Spiel (wird mit dem laufenden Spiel im Browser gespeichert)
export type LiveBinding = {
    id: string;
    code: string;
    token: string;
    role: 'host' | 'guest';     // host = hat das Spiel gestartet und traegt es am Ende ein
    version: number;            // zuletzt bekannter Serverstand
};

export type LiveProgress = { startTeamIndex: number | null; startedAt: number | null; actions: KnechtAction[] };

const url = (path: string) => isDemoMode ? `${window.location.origin}/__live/${path}` : `live/${path}`;

export const createLiveGame = async (match: Match, progress: LiveProgress) => {
    const { data } = await axios.post(url('create'), { match, ...progress });
    return { game: data.game as LiveGame, binding: { id: data.game.id, code: data.code, token: data.token, role: 'host', version: data.game.version } as LiveBinding };
};

export const joinLiveGame = async (code: string) => {
    const { data } = await axios.post(url('join'), { code });
    return { game: data.game as LiveGame, binding: { id: data.game.id, code: data.code, token: data.token, role: 'guest', version: data.game.version } as LiveBinding };
};

export const getLiveGame = async (id: string): Promise<LiveGame | null> => {
    try {
        const { data } = await axios.get(url(id));
        return data.game as LiveGame;
    } catch {
        return null;
    }
};

export const listLiveGames = async (): Promise<LiveGame[]> => {
    try {
        const { data } = await axios.get(url('list'));
        return data.games as LiveGame[];
    } catch {
        return [];
    }
};

// Neuer Stand: ok mit neuem Serverstand, oder conflict mit dem Stand des anderen Handys
export const syncLiveGame = async (binding: LiveBinding, progress: LiveProgress): Promise<{ ok: true; game: LiveGame } | { ok: false; game: LiveGame | null }> => {
    try {
        const { data } = await axios.post(url(`${binding.id}/sync`), { token: binding.token, baseVersion: binding.version, ...progress });
        return { ok: true, game: data.game };
    } catch (error: any) {
        if (error?.response?.status === 409) return { ok: false, game: error.response.data.game };
        throw error;
    }
};

export const finishLiveGame = async (binding: LiveBinding, status: 'done' | 'aborted') => {
    try { await axios.post(url(`${binding.id}/finish`), { token: binding.token, status }); } catch { /* egal: verschwindet nach 2 h von selbst */ }
};

// Link fuer das zweite Handy und fuer Zuschauer
export const getJoinLink = (code: string) => `${window.location.origin}/Knecht?join=${code}`;
export const getWatchLink = (id: string) => `${window.location.origin}/Live/${id}`;

// Live-Uebertragung ein/aus (bleibt fuer die naechsten Spiele erhalten)
const LIVE_KEY = 'bipo_knecht_live';
// Live nur, wenn das Feature freigegeben ist (bzw. im Entwicklermodus an) und nicht auf diesem Handy abgeschaltet
export const isLiveEnabled = () => {
    if (!isFeatureOn('live')) return false;
    try { return localStorage.getItem(LIVE_KEY) !== 'off'; } catch { return true; }
};
export const setLiveEnabled = (enabled: boolean) => { try { localStorage.setItem(LIVE_KEY, enabled ? 'on' : 'off'); } catch { /* egal */ } };
