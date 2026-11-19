import { Request, Response } from "express";
import KnechtSession from "../models/KnechtSession";
import KnechtBump from "../models/KnechtBump";

// Lobby fuer Knecht-Spiele mit mehreren Handys. Das Backend ist bewusst duenn: es haelt die Lobby, vergibt Codes,
// ordnet Stoesse zu und verhindert mit version, dass sich zwei Handys gegenseitig ueberschreiben.
// Gespielt wird danach im Live-Spiel (LiveGame), dessen Code in live steht.

const MAX_PLAYERS_PER_TEAM = 3;
const BUMP_WINDOW = 2000;       // ms, so weit duerfen zwei Stoesse beim Server auseinander ankommen
const BUMP_LIFETIME = 7000;     // ms, danach gilt ein Stoss als ins Leere gegangen
const UPDATABLE = ['status', 'players', 'cupColors', 'live'] as const;

type SessionPlayer = { deviceId: string; name: string; team: number; joinedAt: number; phone?: boolean; ready?: boolean };

const toClient = (session: any) => {
    if (!session) return null;
    const { _id, updatedAt, ...rest } = session.toObject ? session.toObject() : session;
    return rest;
};

const cleanName = (name: unknown) => typeof name === 'string' ? name.trim().slice(0, 60) : '';
const cleanId = (id: unknown) => typeof id === 'string' ? id.slice(0, 64) : '';

const randomCode = () => String(Math.floor(1000 + Math.random() * 9000));

const createSession = async (players: { deviceId: string; name: string }[]) => {
    for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomCode();
        // Code nur vergeben, wenn keine laufende Session ihn nutzt
        const existing = await KnechtSession.findOne({ code }).lean();
        if (existing && existing.status === 'lobby') continue;
        if (existing) await KnechtSession.deleteOne({ code });
        try {
            const now = Date.now();
            const session = await KnechtSession.create({
                code,
                hostId: players[0].deviceId,
                players: players.map((player, index) => ({ ...player, team: index % 2, joinedAt: now + index })),
                updatedAt: new Date(),
            });
            return session.toObject();
        } catch {
            // Code gleichzeitig vergeben: naechster Versuch
        }
    }
    throw new Error('Kein freier Code');
};

// Spieler in eine Lobby aufnehmen (oder Namen aktualisieren). Mit version, damit gleichzeitige Beitritte nichts verlieren.
const addPlayer = async (code: string, deviceId: string, name: string): Promise<{ session?: any; error?: string; status?: number }> => {
    for (let attempt = 0; attempt < 5; attempt++) {
        const session = await KnechtSession.findOne({ code }).lean();
        if (!session) return { error: 'Kein Spiel mit diesem Code', status: 404 };

        const players = (session.players ?? []) as SessionPlayer[];
        const known = players.find(player => player.deviceId === deviceId);
        if (known && known.name === name) return { session };
        if (!known && session.status !== 'lobby') return { error: 'Das Spiel läuft schon', status: 409 };

        let nextPlayers: SessionPlayer[];
        if (known) {
            nextPlayers = players.map(player => player.deviceId === deviceId ? { ...player, name } : player);
        } else {
            const counts = [0, 1].map(team => players.filter(player => player.team === team).length);
            if (counts.every(count => count >= MAX_PLAYERS_PER_TEAM)) return { error: 'Das Spiel ist voll', status: 409 };
            const team = counts[1] < counts[0] ? 1 : counts[0] < counts[1] ? 0 : players.length % 2;
            nextPlayers = [...players, { deviceId, name, team, joinedAt: Date.now() }];
        }

        const updated = await KnechtSession.findOneAndUpdate(
            { code, version: session.version },
            { $set: { players: nextPlayers, updatedAt: new Date() }, $inc: { version: 1 } },
            { new: true, lean: true }
        );
        if (updated) return { session: updated };
    }
    return { error: 'Gerade viel los – bitte nochmal', status: 409 };
};

const create = async (req: Request, res: Response) => {
    const deviceId = cleanId(req.body.deviceId);
    const name = cleanName(req.body.name);
    if (!deviceId || !name) return res.status(400).json({ message: 'deviceId und name fehlen' });
    try {
        const session = await createSession([{ deviceId, name }]);
        res.status(201).json({ session: toClient(session) });
    } catch (error) {
        res.status(500).json({ error });
    }
};

const join = async (req: Request, res: Response) => {
    const deviceId = cleanId(req.body.deviceId);
    const name = cleanName(req.body.name);
    const code = String(req.body.code ?? '').trim();
    if (!deviceId || !name || !code) return res.status(400).json({ message: 'code, deviceId und name fehlen' });
    try {
        const result = await addPlayer(code, deviceId, name);
        if (result.error) return res.status(result.status ?? 400).json({ message: result.error });
        res.status(200).json({ session: toClient(result.session) });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// POST statt GET: der Service Worker cached GET-Anfragen ans Backend
const get = async (req: Request, res: Response) => {
    const since = Number(req.body.since ?? 0);
    try {
        const session = await KnechtSession.findOne({ code: req.params.code }).lean();
        if (!session) return res.status(404).json({ message: 'Kein Spiel mit diesem Code' });
        if (since && session.version === since) return res.status(200).json({ unchanged: true });
        res.status(200).json({ session: toClient(session) });
    } catch (error) {
        res.status(500).json({ error });
    }
};

const update = async (req: Request, res: Response) => {
    const baseVersion = Number(req.body.baseVersion);
    const patch = req.body.patch ?? {};
    const $set: Record<string, unknown> = { updatedAt: new Date() };
    UPDATABLE.forEach(key => { if (key in patch) $set[key] = patch[key]; });

    try {
        const updated = await KnechtSession.findOneAndUpdate(
            { code: req.params.code, version: baseVersion },
            { $set, $inc: { version: 1 } },
            { new: true, lean: true }
        );
        if (updated) return res.status(200).json({ session: toClient(updated) });

        // Jemand anderes war schneller: aktuellen Stand mitschicken
        const current = await KnechtSession.findOne({ code: req.params.code }).lean();
        if (!current) return res.status(404).json({ message: 'Kein Spiel mit diesem Code' });
        res.status(409).json({ session: toClient(current) });
    } catch (error) {
        res.status(500).json({ error });
    }
};

const leave = async (req: Request, res: Response) => {
    const deviceId = cleanId(req.body.deviceId);
    try {
        for (let attempt = 0; attempt < 5; attempt++) {
            const session = await KnechtSession.findOne({ code: req.params.code }).lean();
            if (!session) return res.status(200).json({ session: null });
            const players = (session.players as SessionPlayer[]).filter(player => player.deviceId !== deviceId);
            const $set: Record<string, unknown> = { players, updatedAt: new Date() };
            // Ohne Handy in der Lobby gibt es niemanden mehr, der starten koennte
            const phones = players.filter(player => player.phone !== false);
            if (session.hostId === deviceId && phones.length) $set.hostId = phones[0].deviceId;
            if (!phones.length && session.status === 'lobby') $set.status = 'aborted';
            const updated = await KnechtSession.findOneAndUpdate(
                { code: req.params.code, version: session.version },
                { $set, $inc: { version: 1 } },
                { new: true, lean: true }
            );
            if (updated) return res.status(200).json({ session: toClient(updated) });
        }
        res.status(409).json({ message: 'Bitte nochmal versuchen' });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// ─── Anstossen ───
// Der spaetere von zwei Stoessen ordnet zu (Reihenfolge nach Serverzeit, dann _id). Der fruehere wartet nur,
// so entstehen nie zwei Lobbys aus einem Stoss. Jeder Abruf versucht die Zuordnung erneut.
const isEarlier = (a: any, b: any) => a.time < b.time || (a.time === b.time && String(a._id) < String(b._id));

const tryMatch = async (bumpId: string): Promise<{ code?: string; pending?: boolean; expired?: boolean }> => {
    const bump = await KnechtBump.findById(bumpId).lean();
    if (!bump) return { expired: true };
    if (bump.matchedCode && bump.matchedCode !== 'pending') return { code: bump.matchedCode };
    if (bump.matchedCode === 'pending') return { pending: true };

    const candidates = (await KnechtBump.find({
        time: { $gte: bump.time - BUMP_WINDOW, $lte: bump.time + BUMP_WINDOW },
        deviceId: { $ne: bump.deviceId },
        matchedCode: null,
    }).lean())
        .filter(other => isEarlier(other, bump))
        // Nicht zwei Handys aus derselben Lobby
        .filter(other => !(bump.code && other.code === bump.code))
        .sort((a, b) => Math.abs(a.time - bump.time) - Math.abs(b.time - bump.time));

    for (const other of candidates) {
        // Erst den eigenen Stoss sperren, dann den anderen
        const own = await KnechtBump.findOneAndUpdate({ _id: bump._id, matchedCode: null }, { matchedCode: 'pending' }, { new: true }).lean();
        if (!own) return tryMatch(bumpId);
        const claimed = await KnechtBump.findOneAndUpdate({ _id: other._id, matchedCode: null }, { matchedCode: 'pending' }, { new: true }).lean();
        if (!claimed) {
            await KnechtBump.updateOne({ _id: bump._id }, { matchedCode: null });
            continue;
        }

        let code: string | null = null;
        try {
            // Wer schon in einer Lobby ist, holt den anderen dazu. Sonst entsteht eine neue Lobby.
            const lobbyCode = other.code ?? bump.code;
            if (lobbyCode) {
                const joining = other.code ? bump : other;
                const result = await addPlayer(lobbyCode, joining.deviceId, joining.name);
                if (result.session) code = lobbyCode;
            }
            if (!code) code = (await createSession([other, bump].map(entry => ({ deviceId: entry.deviceId, name: entry.name })))).code as string;
        } catch {
            code = null;
        }

        await KnechtBump.updateMany({ _id: { $in: [bump._id, other._id] } }, { matchedCode: code });
        if (code) return { code };
        return { expired: true };
    }

    if (Date.now() - bump.time > BUMP_LIFETIME) return { expired: true };
    return { pending: true };
};

const respondBump = async (res: Response, bumpId: string) => {
    const result = await tryMatch(bumpId);
    if (result.code) {
        const session = await KnechtSession.findOne({ code: result.code }).lean();
        return res.status(200).json({ session: toClient(session) });
    }
    res.status(200).json({ bumpId, pending: !!result.pending, expired: !!result.expired });
};

const bump = async (req: Request, res: Response) => {
    const deviceId = cleanId(req.body.deviceId);
    const name = cleanName(req.body.name);
    if (!deviceId || !name) return res.status(400).json({ message: 'deviceId und name fehlen' });
    try {
        const created = await KnechtBump.create({ deviceId, name, code: req.body.code ? String(req.body.code) : null, time: Date.now() });
        await respondBump(res, String(created._id));
    } catch (error) {
        res.status(500).json({ error });
    }
};

const bumpStatus = async (req: Request, res: Response) => {
    try {
        await respondBump(res, req.params.bumpId);
    } catch (error) {
        res.status(500).json({ error });
    }
};

export default { create, join, get, update, leave, bump, bumpStatus };
