import { MAX_PLAYERS_PER_TEAM, MpError, hasPhone, type MpBumpResult, type MpPatch, type MpPlayer, type MpSession } from './multiplayerTypes';

// Nachbau des Backends (KnechtSession-Controller) im Browser: fuer den Demo-Modus (mehrere Tabs im selben
// Browser spielen gegeneinander) und fuer Tests. Gleiche Regeln wie im Backend, Daten im Storage.

export type LocalStore = {
    load: () => LocalData;
    save: (data: LocalData) => void;
    now: () => number;
};

type LocalBump = { id: string; deviceId: string; name: string; code: string | null; time: number; matchedCode: string | null };
export type LocalData = { sessions: Record<string, MpSession>; bumps: LocalBump[] };

const BUMP_WINDOW = 2000;
const BUMP_LIFETIME = 7000;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const createLocalServer = (store: LocalStore) => {
    let counter = 0;

    const mutate = <T>(fn: (data: LocalData) => T): T => {
        const data = store.load();
        const result = fn(data);
        store.save(data);
        return clone(result);
    };

    const newSession = (data: LocalData, players: { deviceId: string; name: string }[]): MpSession => {
        let code = '';
        do code = String(Math.floor(1000 + Math.random() * 9000));
        while (data.sessions[code] && data.sessions[code].status === 'lobby');
        const now = store.now();
        const session: MpSession = {
            code,
            hostId: players[0].deviceId,
            status: 'lobby',
            players: players.map((player, index) => ({ deviceId: player.deviceId, name: player.name, team: index % 2, joinedAt: now + index })),
            cupColors: null,
            live: null,
            gameKind: 'open',
            version: 1,
        };
        data.sessions[code] = session;
        return session;
    };

    const addPlayer = (data: LocalData, code: string, deviceId: string, name: string): MpSession => {
        const session = data.sessions[code];
        if (!session) throw new MpError('Kein Spiel mit diesem Code', 404);
        const known = session.players.find(player => player.deviceId === deviceId);
        if (known) {
            if (known.name !== name) {
                known.name = name;
                session.version++;
            }
            return session;
        }
        if (session.status !== 'lobby') throw new MpError('Das Spiel läuft schon', 409);
        const counts = [0, 1].map(team => session.players.filter(player => player.team === team).length);
        if (counts.every(count => count >= MAX_PLAYERS_PER_TEAM)) throw new MpError('Das Spiel ist voll', 409);
        const team = counts[1] < counts[0] ? 1 : counts[0] < counts[1] ? 0 : session.players.length % 2;
        session.players.push({ deviceId, name, team, joinedAt: store.now() } as MpPlayer);
        session.version++;
        return session;
    };

    const tryMatch = (data: LocalData, bump: LocalBump): MpBumpResult => {
        const pending = (expired = false): MpBumpResult => ({ bumpId: bump.id, pending: !expired, expired });
        if (bump.matchedCode) return { session: data.sessions[bump.matchedCode] };

        const isEarlier = (a: LocalBump, b: LocalBump) => a.time < b.time || (a.time === b.time && a.id < b.id);
        const other = data.bumps
            .filter(entry => !entry.matchedCode && entry.deviceId !== bump.deviceId && Math.abs(entry.time - bump.time) <= BUMP_WINDOW)
            .filter(entry => isEarlier(entry, bump))
            .filter(entry => !(bump.code && entry.code === bump.code))
            .sort((a, b) => Math.abs(a.time - bump.time) - Math.abs(b.time - bump.time))[0];

        if (!other) return pending(store.now() - bump.time > BUMP_LIFETIME);

        let code: string | null = null;
        const lobbyCode = other.code ?? bump.code;
        if (lobbyCode && data.sessions[lobbyCode]) {
            const joining = other.code ? bump : other;
            try {
                addPlayer(data, lobbyCode, joining.deviceId, joining.name);
                code = lobbyCode;
            } catch { /* voll oder laeuft schon: neue Lobby */ }
        }
        if (!code) code = newSession(data, [other, bump]).code;
        other.matchedCode = code;
        bump.matchedCode = code;
        return { session: data.sessions[code] };
    };

    return {
        create: (deviceId: string, name: string) => mutate(data => newSession(data, [{ deviceId, name }])),

        join: (code: string, deviceId: string, name: string) => mutate(data => addPlayer(data, code, deviceId, name)),

        get: (code: string, since?: number): MpSession | null => {
            const session = store.load().sessions[code];
            if (!session) throw new MpError('Kein Spiel mit diesem Code', 404);
            return since && session.version === since ? null : clone(session);
        },

        update: (code: string, baseVersion: number, patch: MpPatch) => mutate(data => {
            const session = data.sessions[code];
            if (!session) throw new MpError('Kein Spiel mit diesem Code', 404);
            if (session.version !== baseVersion) return { ok: false as const, session };
            Object.assign(session, clone(patch));
            session.version++;
            return { ok: true as const, session };
        }),

        leave: (code: string, deviceId: string) => mutate(data => {
            const session = data.sessions[code];
            if (!session) return null;
            session.players = session.players.filter(player => player.deviceId !== deviceId);
            // Ohne Handy in der Lobby gibt es niemanden mehr, der starten koennte
            const phones = session.players.filter(hasPhone);
            if (session.hostId === deviceId && phones.length) session.hostId = phones[0].deviceId;
            if (!phones.length && session.status === 'lobby') session.status = 'aborted';
            session.version++;
            return session;
        }),

        bump: (deviceId: string, name: string, code?: string | null) => mutate(data => {
            const now = store.now();
            data.bumps = data.bumps.filter(entry => now - entry.time < 60_000);
            const bump: LocalBump = { id: `${now}-${++counter}-${Math.random().toString(36).slice(2, 6)}`, deviceId, name, code: code ?? null, time: now, matchedCode: null };
            data.bumps.push(bump);
            return tryMatch(data, bump);
        }),

        bumpStatus: (bumpId: string) => mutate(data => {
            const bump = data.bumps.find(entry => entry.id === bumpId);
            if (!bump) return { bumpId, pending: false, expired: true } as MpBumpResult;
            return tryMatch(data, bump);
        }),
    };
};

export type LocalServer = ReturnType<typeof createLocalServer>;

// Speicher im localStorage: alle Tabs des Browsers teilen sich die Sessions
export const createBrowserStore = (key = 'bipo_mp_local'): LocalStore => ({
    load: () => {
        try {
            const data = JSON.parse(localStorage.getItem(key) ?? '') as LocalData;
            return { sessions: data.sessions ?? {}, bumps: data.bumps ?? [] };
        } catch {
            return { sessions: {}, bumps: [] };
        }
    },
    save: (data) => localStorage.setItem(key, JSON.stringify(data)),
    now: () => Date.now(),
});

export const createMemoryStore = (now: () => number = () => Date.now()): LocalStore => {
    let data: LocalData = { sessions: {}, bumps: [] };
    return { load: () => clone(data), save: (next) => { data = clone(next); }, now };
};
