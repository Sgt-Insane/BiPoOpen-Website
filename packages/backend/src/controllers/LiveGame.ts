import { Request, Response } from "express";
import crypto from "crypto";
import LiveGame from "../models/LiveGame";

// Live-Spiele: nach dieser Zeit ohne Aenderung gilt ein Spiel als verlassen und erscheint nicht mehr im Ticker
const STALE_MS = 2 * 60 * 60 * 1000;
const MAX_ACTIONS = 600;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O und 1/I

const randomCode = () => Array.from(crypto.randomBytes(5), byte => CODE_CHARS[byte % CODE_CHARS.length]).join('');

// Oeffentliche Sicht: ohne Code und Token
const toPublic = (game: any) => ({
    id: String(game._id),
    match: game.match,
    startTeamIndex: game.startTeamIndex,
    startedAt: game.startedAt,
    actions: game.actions,
    version: game.version,
    status: game.status,
    devices: game.devices,
    updatedAt: game.updatedAt,
});

const isValidPayload = (body: any) =>
    Array.isArray(body?.actions) && body.actions.length <= MAX_ACTIONS
    && (body.startTeamIndex === null || body.startTeamIndex === 0 || body.startTeamIndex === 1 || body.startTeamIndex === undefined);

const create = async (req: Request, res: Response) => {
    const { match } = req.body ?? {};
    if (!match?.team1?.players || !match?.team2?.players || !isValidPayload(req.body)) return res.status(400).json({ message: 'invalid game' });
    try {
        // Code eindeutig unter den laufenden Spielen
        let code = randomCode();
        while (await LiveGame.exists({ code, status: 'live' })) code = randomCode();
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

// Zweites Handy: mit dem Code beitreten und das Schreibrecht bekommen
const join = async (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    try {
        const game = await LiveGame.findOneAndUpdate(
            { code, status: 'live', updatedAt: { $gt: Date.now() - STALE_MS } },
            { $inc: { devices: 1 } },
            { new: true },
        ).lean();
        if (!game) return res.status(404).json({ message: 'not found' });
        res.status(200).json({ game: toPublic(game), code: game.code, token: game.token });
    } catch (error) {
        res.status(500).json({ error });
    }
};

const list = (req: Request, res: Response) => {
    LiveGame.find({ status: 'live', updatedAt: { $gt: Date.now() - STALE_MS } })
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

// Neuer Stand eines Handys: nur wenn es auf dem aktuellen Stand aufbaut (baseVersion), sonst 409 mit dem Serverstand
const sync = async (req: Request, res: Response) => {
    const { token, baseVersion } = req.body ?? {};
    if (typeof baseVersion !== 'number' || !isValidPayload(req.body)) return res.status(400).json({ message: 'invalid payload' });
    try {
        const update: Record<string, unknown> = { actions: req.body.actions, updatedAt: Date.now() };
        if (req.body.startTeamIndex !== undefined) update.startTeamIndex = req.body.startTeamIndex;
        if (typeof req.body.startedAt === 'number') update.startedAt = req.body.startedAt;
        const game = await LiveGame.findOneAndUpdate(
            { _id: req.params.id, token, version: baseVersion, status: 'live' },
            { $set: update, $inc: { version: 1 } },
            { new: true },
        ).lean();
        if (game) return res.status(200).json({ game: toPublic(game) });

        const current = await LiveGame.findById(req.params.id).lean();
        if (!current || current.token !== token) return res.status(404).json({ message: 'not found' });
        res.status(409).json({ game: toPublic(current) });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Spiel eingetragen (done) oder abgebrochen (aborted): verschwindet aus dem Ticker, das andere Handy erfaehrt es beim naechsten Abruf
const finish = (req: Request, res: Response) => {
    const status = req.body?.status === 'done' ? 'done' : 'aborted';
    LiveGame.findOneAndUpdate({ _id: req.params.id, token: req.body?.token }, { status, updatedAt: Date.now() }, { new: true })
        .lean()
        .then(game => game ? res.status(200).json({ game: toPublic(game) }) : res.status(404).json({ message: 'not found' }))
        .catch(error => res.status(500).json({ error }));
};

export default { create, join, list, read, sync, finish };
