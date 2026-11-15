import { Request, Response } from "express";
import crypto from "crypto";
import LiveGame from "../models/LiveGame";

// Live-Spiele: nach dieser Zeit ohne Aenderung gilt ein Spiel als verlassen und erscheint nicht mehr im Ticker
const STALE_MS = 2 * 60 * 60 * 1000;
const MAX_ACTIONS = 600;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O und 1/I

const randomCode = () => Array.from(crypto.randomBytes(5), byte => CODE_CHARS[byte % CODE_CHARS.length]).join('');

// Code eindeutig unter den laufenden Spielen
const uniqueCode = async () => {
    let code = randomCode();
    while (await LiveGame.exists({ code, status: 'live' })) code = randomCode();
    return code;
};

// Oeffentliche Sicht: ohne Code und Schreibrechte. guestId/guestSide: damit das erste Handy seine Seite kennt
// und das zweite merkt, wenn es getrennt wurde.
const toPublic = (game: any) => ({
    id: String(game._id),
    match: game.match,
    startTeamIndex: game.startTeamIndex,
    startedAt: game.startedAt,
    actions: game.actions,
    version: game.version,
    status: game.status,
    devices: game.guestToken ? 2 : 1,
    guestId: game.guestId ?? null,
    guestSide: game.guestSide ?? null,
    updatedAt: game.updatedAt,
});

const isValidPayload = (body: any) =>
    Array.isArray(body?.actions) && body.actions.length <= MAX_ACTIONS
    && (body.startTeamIndex === null || body.startTeamIndex === 0 || body.startTeamIndex === 1 || body.startTeamIndex === undefined);

const isFresh = () => ({ status: 'live', updatedAt: { $gt: Date.now() - STALE_MS } });
// Schreibrecht: erstes Handy (token) oder zweites Handy (guestToken)
const canWrite = (token: unknown) => ({ $or: [{ token }, { guestToken: token }] });

const create = async (req: Request, res: Response) => {
    const { match } = req.body ?? {};
    if (!match?.team1?.players || !match?.team2?.players || !isValidPayload(req.body)) return res.status(400).json({ message: 'invalid game' });
    try {
        const code = await uniqueCode();
        const now = Date.now();
        const game = await LiveGame.create({
            code,
            token: crypto.randomBytes(18).toString('hex'),
            match,
            startTeamIndex: req.body.startTeamIndex ?? null,
            startedAt: req.body.startedAt ?? null,
            actions: req.body.actions,
            createdAt: now,
            updatedAt: now,
        });
        res.status(201).json({ game: toPublic(game), code, token: game.token });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Zweites Handy, Schritt 1: Spiel zum Code ansehen (Teams fuer die Seitenwahl), ohne Schreibrecht
const peek = async (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    try {
        const game = await LiveGame.findOne({ code, ...isFresh() }).lean();
        if (!game) return res.status(404).json({ message: 'not found' });
        res.status(200).json({ game: toPublic(game), busy: !!game.guestToken });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Zweites Handy, Schritt 2: mit gewaehlter Tischseite beitreten. Nur ein zweites Handy je Spiel (sonst 409 busy).
const join = async (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const side = req.body?.side;
    if (side !== 0 && side !== 1) return res.status(400).json({ message: 'invalid side' });
    try {
        const guestToken = crypto.randomBytes(18).toString('hex');
        const guestId = crypto.randomBytes(6).toString('hex');
        const game = await LiveGame.findOneAndUpdate(
            { code, ...isFresh(), guestToken: null },
            { $set: { guestToken, guestId, guestSide: side, devices: 2, updatedAt: Date.now() }, $inc: { version: 1 } },
            { new: true },
        ).lean();
        if (game) return res.status(200).json({ game: toPublic(game), code: game.code, token: guestToken });
        const existing = await LiveGame.exists({ code, ...isFresh() });
        res.status(existing ? 409 : 404).json({ message: existing ? 'busy' : 'not found' });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Erstes Handy trennt das zweite: Schreibrecht widerrufen, neuer Code (kein Wiedereintritt mit dem alten)
const kick = async (req: Request, res: Response) => {
    try {
        const code = await uniqueCode();
        const game = await LiveGame.findOneAndUpdate(
            { _id: req.params.id, token: req.body?.token, status: 'live' },
            { $set: { guestToken: null, guestId: null, guestSide: null, devices: 1, code, updatedAt: Date.now() }, $inc: { version: 1 } },
            { new: true },
        ).lean();
        if (!game) return res.status(404).json({ message: 'not found' });
        res.status(200).json({ game: toPublic(game), code });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Zweites Handy steigt selbst aus: Platz wieder frei
const leave = (req: Request, res: Response) => {
    LiveGame.findOneAndUpdate(
        { _id: req.params.id, guestToken: req.body?.token },
        { $set: { guestToken: null, guestId: null, guestSide: null, devices: 1, updatedAt: Date.now() }, $inc: { version: 1 } },
        { new: true },
    )
        .lean()
        .then(game => game ? res.status(200).json({ game: toPublic(game) }) : res.status(404).json({ message: 'not found' }))
        .catch(error => res.status(500).json({ error }));
};

const list = (req: Request, res: Response) => {
    LiveGame.find(isFresh())
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean()
        .then(games => res.status(200).json({ games: games.map(toPublic) }))
        .catch(error => res.status(500).json({ error }));
};

const read = (req: Request, res: Response) => {
    LiveGame.findById(req.params.id)
        .lean()
        .then(game => game ? res.status(200).json({ game: toPublic(game) }) : res.status(404).json({ message: 'not found' }))
        .catch(() => res.status(404).json({ message: 'not found' }));
};

// Neuer Stand eines Handys: nur wenn es auf dem aktuellen Stand aufbaut (baseVersion), sonst 409 mit dem Serverstand.
// match (z.B. getauschte Becherfarben) darf mitkommen.
const sync = async (req: Request, res: Response) => {
    const { token, baseVersion } = req.body ?? {};
    if (typeof baseVersion !== 'number' || !isValidPayload(req.body)) return res.status(400).json({ message: 'invalid payload' });
    try {
        const update: Record<string, unknown> = { actions: req.body.actions, updatedAt: Date.now() };
        if (req.body.startTeamIndex !== undefined) update.startTeamIndex = req.body.startTeamIndex;
        if (typeof req.body.startedAt === 'number') update.startedAt = req.body.startedAt;
        if (req.body.match?.team1?.players && req.body.match?.team2?.players) update.match = req.body.match;
        const game = await LiveGame.findOneAndUpdate(
            { _id: req.params.id, ...canWrite(token), version: baseVersion, status: 'live' },
            { $set: update, $inc: { version: 1 } },
            { new: true },
        ).lean();
        if (game) return res.status(200).json({ game: toPublic(game) });

        const current = await LiveGame.findById(req.params.id).lean();
        if (!current || (current.token !== token && current.guestToken !== token)) return res.status(404).json({ message: 'not found' });
        res.status(409).json({ game: toPublic(current) });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Spiel eingetragen (done) oder abgebrochen (aborted): verschwindet aus dem Ticker, das andere Handy erfaehrt es beim naechsten Abruf
const finish = (req: Request, res: Response) => {
    const status = req.body?.status === 'done' ? 'done' : 'aborted';
    LiveGame.findOneAndUpdate({ _id: req.params.id, ...canWrite(req.body?.token) }, { status, updatedAt: Date.now() }, { new: true })
        .lean()
        .then(game => game ? res.status(200).json({ game: toPublic(game) }) : res.status(404).json({ message: 'not found' }))
        .catch(error => res.status(500).json({ error }));
};

export default { create, peek, join, kick, leave, list, read, sync, finish };
