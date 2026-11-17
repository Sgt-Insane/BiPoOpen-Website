import axios from 'axios';
import { isDemoMode } from '@/util/demoGames';
import { MpError, type MpBumpResult, type MpPatch, type MpSession } from './multiplayerTypes';
import { createBrowserStore, createLocalServer } from './multiplayerLocalServer';

// Verbindung zum gemeinsamen Spielstand. Zwei Varianten mit derselben Schnittstelle:
// - remote: Backend (/knechtSessions), Echtzeit-Hinweise ueber Supabase Realtime, sonst Abfragen im Takt
// - local: Demo-Modus, Tabs im selben Browser (localStorage + BroadcastChannel)

export type MpUpdateResult = { ok: boolean; session: MpSession };

export type MpApi = {
    kind: 'remote' | 'local';
    create: (deviceId: string, name: string) => Promise<MpSession>;
    join: (code: string, deviceId: string, name: string) => Promise<MpSession>;
    get: (code: string, since?: number) => Promise<MpSession | null>;     // null = unveraendert
    update: (code: string, baseVersion: number, patch: MpPatch) => Promise<MpUpdateResult>;
    leave: (code: string, deviceId: string) => Promise<MpSession | null>;
    bump: (deviceId: string, name: string, code?: string | null) => Promise<MpBumpResult>;
    bumpStatus: (bumpId: string) => Promise<MpBumpResult>;
    // Echtzeit: andere Handys sofort ueber einen neuen Stand informieren. Liefert eine Abmelde-Funktion.
    subscribe: (code: string, onSession: (session: MpSession) => void, onStatus: (live: boolean) => void) => () => void;
    publish: (session: MpSession) => void;
};

// ─── Remote ───
const toError = (error: unknown) => {
    if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        return new MpError(message ?? (error.response ? 'Fehler beim Server' : 'Keine Verbindung'), error.response?.status);
    }
    return error instanceof MpError ? error : new MpError('Unbekannter Fehler');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = async (request: () => Promise<{ data: any }>) => {
    try {
        return (await request()).data;
    } catch (error) {
        throw toError(error);
    }
};

type Channel = { send: (message: unknown) => unknown; unsubscribe: () => unknown };
const channels = new Map<string, Channel>();
// Gesendet, bevor die Verbindung stand (z.B. direkt nach dem Beitreten): beim Verbinden nachholen
const unsent = new Map<string, MpSession>();

const createRemoteApi = (): MpApi => ({
    kind: 'remote',
    create: async (deviceId, name) => (await call(() => axios.post('/knechtSessions/create', { deviceId, name }))).session,
    join: async (code, deviceId, name) => (await call(() => axios.post('/knechtSessions/join', { code, deviceId, name }))).session,
    get: async (code, since) => {
        const data = await call(() => axios.post(`/knechtSessions/${code}/get`, { since }));
        return data.unchanged ? null : data.session;
    },
    update: async (code, baseVersion, patch) => {
        try {
            const response = await axios.post(`/knechtSessions/${code}/update`, { baseVersion, patch });
            return { ok: true, session: response.data.session };
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 409 && error.response.data?.session)
                return { ok: false, session: error.response.data.session };
            throw toError(error);
        }
    },
    leave: async (code, deviceId) => (await call(() => axios.post(`/knechtSessions/${code}/leave`, { deviceId }))).session ?? null,
    bump: (deviceId, name, code) => call(() => axios.post('/knechtSessions/bump', { deviceId, name, code })),
    bumpStatus: (bumpId) => call(() => axios.post(`/knechtSessions/bump/${bumpId}`)),

    subscribe: (code, onSession, onStatus) => {
        let closed = false;
        let channel: Channel | null = null;
        // Ohne Supabase-Konfiguration bleibt es beim Abfragen im Takt
        if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) return () => {};

        import('@/util/supabaseStorage').then(({ getSupabaseClient }) => {
            if (closed) return;
            const realtime = getSupabaseClient()
                .channel(`knecht-session-${code}`, { config: { broadcast: { self: false } } })
                .on('broadcast', { event: 'state' }, ({ payload }) => onSession(payload as MpSession))
                .subscribe(status => {
                    onStatus(status === 'SUBSCRIBED');
                    const pending = unsent.get(code);
                    if (status === 'SUBSCRIBED' && pending && channel) {
                        unsent.delete(code);
                        channel.send(pending);
                    }
                });
            channel = {
                send: (session) => realtime.send({ type: 'broadcast', event: 'state', payload: session }),
                unsubscribe: () => realtime.unsubscribe(),
            };
            channels.set(code, channel);
        }).catch(() => onStatus(false));

        return () => {
            closed = true;
            channel?.unsubscribe();
            if (channels.get(code) === channel) channels.delete(code);
            onStatus(false);
        };
    },
    publish: (session) => {
        const channel = channels.get(session.code);
        if (!channel) {
            unsent.set(session.code, session);
            return;
        }
        try { channel.send(session); } catch { /* andere Handys fragen ohnehin regelmaessig nach */ }
    },
});

// ─── Lokal (Demo) ───
const createLocalApi = (): MpApi => {
    const server = createLocalServer(createBrowserStore());
    const broadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bipo_mp_local') : null;
    // Wie ueber das Netz: asynchron, mit kurzer Verzoegerung. Die Tabs laufen parallel: ein Browser-Lock macht
    // Lesen-Aendern-Schreiben atomar (wie findOneAndUpdate im Backend).
    const locked = <T>(fn: () => T): Promise<T> => typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request('bipo_mp_local', () => fn())
        : Promise.resolve().then(fn);
    const later = <T>(fn: () => T) => new Promise<void>(resolve => setTimeout(resolve, 60)).then(() => locked(fn));

    return {
        kind: 'local',
        create: (deviceId, name) => later(() => server.create(deviceId, name)),
        join: (code, deviceId, name) => later(() => server.join(code, deviceId, name)),
        get: (code, since) => later(() => server.get(code, since)),
        update: (code, baseVersion, patch) => later(() => server.update(code, baseVersion, patch)),
        leave: (code, deviceId) => later(() => server.leave(code, deviceId)),
        bump: (deviceId, name, code) => later(() => server.bump(deviceId, name, code)),
        bumpStatus: (bumpId) => later(() => server.bumpStatus(bumpId)),
        subscribe: (code, onSession, onStatus) => {
            if (!broadcast) return () => {};
            const listener = (event: MessageEvent) => {
                if ((event.data as MpSession)?.code === code) onSession(event.data as MpSession);
            };
            broadcast.addEventListener('message', listener);
            onStatus(true);
            return () => broadcast.removeEventListener('message', listener);
        },
        publish: (session) => broadcast?.postMessage(session),
    };
};

// Demo-Modus spielt lokal, ausser VITE_KNECHT_MULTIPLAYER=remote (z.B. echte Handys gegen ein lokales Backend)
const transport = import.meta.env.VITE_KNECHT_MULTIPLAYER as string | undefined;
export const mpApi: MpApi = transport === 'local' || (isDemoMode && transport !== 'remote') ? createLocalApi() : createRemoteApi();
