import axios from 'axios';
import { isDemoMode } from '@/util/demoGames';
import { isFeatureOn } from '@/util/featureFlags';
import type { KnechtAction } from './knechtEngine';
import type { LiveDevice, LiveDeviceBinding } from './liveDevices';

// Live-Spiele: laufende Knecht-Spiele fuer den Live-Ticker und fuer das Tracking mit mehreren Handys.
// Demo-Modus (lokaler Dev-Server): Zwischenspeicher im Vite-Server (/__live), nie die echte Datenbank.

export type LiveGame = {
    id: string;
    match: Match;
    startTeamIndex: number | null;
    startedAt: number | null;
    actions: KnechtAction[];
    version: number;
    status: 'live' | 'saving' | 'done' | 'aborted';
    devices: LiveDevice[];      // alle Handys im Spiel (nach Beitritt sortiert)
    savingBy: string | null;    // Handy, das gerade eintraegt
    endedBy: string | null;     // Name des Handys, das eingetragen bzw. abgebrochen hat
    paused?: boolean;           // im Knecht pausiert: nicht im Live-Ticker
    pausedBy?: string | null;   // wer pausiert hat
    updatedAt: number;
};

// Schreibrecht eines Handys fuer ein Live-Spiel (wird mit dem laufenden Spiel im Browser gespeichert)
export type LiveBinding = LiveDeviceBinding & {
    id: string;
    code: string;
    token: string;
    deviceId: string;
    version: number;            // zuletzt bekannter Serverstand
};

// match: z.B. getauschte Becherfarben, damit die anderen Handys und der Ticker sie auch sehen
// paused: Spiel ist pausiert, der Ticker blendet es solange aus
export type LiveProgress = { startTeamIndex: number | null; startedAt: number | null; actions: KnechtAction[]; match?: Match; paused?: boolean; pausedBy?: string | null };

// Beitreten nicht moeglich: Spiel unbekannt/vorbei, Platz schon belegt oder zu viele Handys
export class LiveJoinError extends Error {
    constructor(public reason: 'not-found' | 'taken' | 'full') { super(reason); }
}

const url = (path: string) => isDemoMode ? `${window.location.origin}/__live/${path}` : `live/${path}`;

const toBinding = (data: any, game: LiveGame): LiveBinding => {
    const device = game.devices.find(entry => entry.id === data.deviceId);
    return { id: game.id, code: data.code, token: data.token, deviceId: data.deviceId, version: game.version, team: device?.team ?? null, player: device?.player ?? null };
};

// name: wer dieses Handy hat (Anzeige bei den anderen), binding: wofuer es eintraegt
export const createLiveGame = async (match: Match, progress: LiveProgress, device: { name: string | null } & Partial<LiveDeviceBinding> = { name: null }) => {
    const { data } = await axios.post(url('create'), { match, ...progress, device });
    const game = data.game as LiveGame;
    return { game, binding: toBinding(data, game) };
};

const toJoinError = (error: any) => {
    const message = error?.response?.data?.message;
    return new LiveJoinError(error?.response?.status === 409 ? (message === 'full' ? 'full' : 'taken') : 'not-found');
};

// Beitreten, Schritt 1: Teams und belegte Plaetze zum Code ansehen
export const peekLiveGame = async (code: string) => {
    try {
        const { data } = await axios.post(url('peek'), { code });
        return data.game as LiveGame;
    } catch (error) {
        throw toJoinError(error);
    }
};

// Schritt 2: als Spieler oder Tischende beitreten
export const joinLiveGame = async (code: string, device: { name: string | null } & LiveDeviceBinding) => {
    try {
        const { data } = await axios.post(url('join'), { code, device });
        const game = data.game as LiveGame;
        return { game, binding: toBinding(data, game) };
    } catch (error) {
        throw toJoinError(error);
    }
};

// Eigenes Handy umstellen (anderer Spieler / anderes Tischende). Wirft LiveJoinError('taken').
export const bindLiveDevice = async (binding: LiveBinding, target: LiveDeviceBinding) => {
    try {
        const { data } = await axios.post(url(`${binding.id}/bind`), { token: binding.token, ...target });
        return data.game as LiveGame;
    } catch (error) {
        throw toJoinError(error);
    }
};

// Ein anderes Handy trennen (z.B. Akku leer): seine Spieler traegt dann wieder jedes Handy mit ein
export const kickLiveDevice = async (binding: LiveBinding, deviceId: string) => {
    const { data } = await axios.post(url(`${binding.id}/kick`), { token: binding.token, deviceId });
    return data.game as LiveGame;
};

// Dieses Handy steigt aus, das Spiel laeuft auf den anderen weiter
export const leaveLiveGame = async (binding: LiveBinding) => {
    try { await axios.post(url(`${binding.id}/leave`), { token: binding.token }); } catch { /* egal: Platz verfaellt mit dem Spiel */ }
};

// Eintragen: nur ein Handy gleichzeitig. ok false = ein anderes Handy traegt schon ein (game = aktueller Stand)
export const claimLiveGame = async (binding: LiveBinding): Promise<{ ok: boolean; game: LiveGame | null }> => {
    try {
        const { data } = await axios.post(url(`${binding.id}/claim`), { token: binding.token });
        return { ok: true, game: data.game };
    } catch (error: any) {
        return { ok: false, game: error?.response?.data?.game ?? null };
    }
};

export const releaseLiveGame = async (binding: LiveBinding): Promise<LiveGame | null> => {
    try {
        const { data } = await axios.post(url(`${binding.id}/release`), { token: binding.token });
        return data.game as LiveGame;
    } catch {
        return null;
    }
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

// Gespeicherte Bindung aus einer frueheren Version (erstes/zweites Handy) passt nicht mehr
export const isCurrentBinding = (binding: unknown): binding is LiveBinding =>
    !!binding && typeof (binding as LiveBinding).deviceId === 'string' && typeof (binding as LiveBinding).token === 'string';

// Link fuer weitere Handys und fuer Zuschauer
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
