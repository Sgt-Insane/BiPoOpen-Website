import { Request, Response } from "express";
import crypto from "crypto";
import LiveGame from "../models/LiveGame";

// Live-Spiele: nach dieser Zeit ohne Aenderung gilt ein Spiel als verlassen und wird abgeraeumt
const STALE_MS = 2 * 60 * 60 * 1000;
// Im Ticker nur, was gerade laeuft: Spiele ohne Aenderung seit 15 Minuten ausblenden (mit dem naechsten Wurf bzw.
// "Weiterspielen" sind sie wieder da). Pausierte Spiele bleiben so lange mit "Pausiert" sichtbar.
const TICKER_MS = 15 * 60 * 1000;
const MAX_ACTIONS = 600;
const MAX_DEVICES = 8;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O und 1/I

type Device = { id: string; token: string; name: string | null; team: number | null; player: number | null; joinedAt: number };
type Binding = { team: number | null; player: number | null };

const randomCode = () => Array.from(crypto.randomBytes(5), byte => CODE_CHARS[byte % CODE_CHARS.length]).join('');
const randomToken = () => crypto.randomBytes(18).toString('hex');
const randomId = () => crypto.randomBytes(6).toString('hex');

// Code eindeutig unter den laufenden Spielen
const uniqueCode = async () => {
    let code = randomCode();
    while (await LiveGame.exists({ code, status: { $in: ['live', 'saving'] } })) code = randomCode();
    return code;
};

// Oeffentliche Sicht: ohne Code und Schreibrechte
const toPublic = (game: any) => ({
    id: String(game._id),
    match: game.match,
    startTeamIndex: game.startTeamIndex,
    startedAt: game.startedAt,
    actions: game.actions,
    version: game.version,
    status: game.status,
    devices: ((game.devices ?? []) as Device[]).map(({ token: _token, ...device }) => device),
    savingBy: game.savingBy ?? null,
    endedBy: game.endedBy ?? null,
    paused: !!game.paused,
    pausedBy: game.paused ? game.pausedBy ?? null : null,
    pauseReady: game.paused ? game.pauseReady ?? [] : [],
    updatedAt: game.updatedAt,
});

const isValidPayload = (body: any) =>
    Array.isArray(body?.actions) && body.actions.length <= MAX_ACTIONS
    && (body.startTeamIndex === null || body.startTeamIndex === 0 || body.startTeamIndex === 1 || body.startTeamIndex === undefined);

const isFresh = () => ({ status: { $in: ['live', 'saving'] }, updatedAt: { $gt: Date.now() - STALE_MS } });
const canWrite = (token: unknown) => ({ 'devices.token': typeof token === 'string' && token ? token : '-' });

const cleanName = (name: unknown) => typeof name === 'string' && name.trim() ? name.trim().slice(0, 60) : null;
const playerCount = (match: any, team: number) => (team === 0 ? match?.team1 : match?.team2)?.players?.length ?? 0;

// Wofuer ein Handy eintraegt (siehe Model). Ganzer Tisch nur, solange es allein ist.
const readBinding = (body: any, match: any): Binding | null => {
    const team = body?.team ?? null;
    const player = body?.player ?? null;
    if (team === null) return player === null ? { team: null, player: null } : null;
    if (team !== 0 && team !== 1) return null;
    if (player !== null && (!Number.isInteger(player) || player < 0 || player >= playerCount(match, team))) return null;
    return { team, player };
};

// Belegt? Ein Spieler, ein Tischende und "fuer alle eintragen" (team null) gehoeren hoechstens einem Handy
const isTaken = (devices: Device[], binding: Binding, exceptId?: string) => devices.some(device =>
    device.id !== exceptId && device.team === binding.team && (binding.team === null || device.player === binding.player));

// Ein weiteres Handy kommt dazu: hatte bisher ein einzelnes Handy den ganzen Tisch, steht es jetzt am anderen Tischende.
// Traegt in einer Runde mit mehreren Handys eines fuer alle ein, bleibt das so.
const withJoined = (devices: Device[], joined: Device) => [
    ...devices.map(device => device.team === null && devices.length === 1 ? { ...device, team: joined.team === null ? null : 1 - joined.team, player: null } : device),
    joined,
];

// Aenderung an der Geraeteliste mit version (gleichzeitige Beitritte verlieren nichts)
const updateDevices = async (
    filter: Record<string, unknown>,
    change: (game: any) => { devices: Device[]; extra?: Record<string, unknown> } | { error: string; status: number },
): Promise<{ game?: any; error?: string; status?: number }> => {
    for (let attempt = 0; attempt < 5; attempt++) {
        const game = await LiveGame.findOne(filter).lean();
        if (!game) return { error: 'not found', status: 404 };
        const result = change(game);
        if ('error' in result) return result;
        const updated = await LiveGame.findOneAndUpdate(
            { _id: game._id, version: game.version },
            { $set: { devices: result.devices, updatedAt: Date.now(), ...result.extra }, $inc: { version: 1 } },
            { new: true },
        ).lean();
        if (updated) return { game: updated };
    }
    return { error: 'busy', status: 409 };
};

const reply = (res: Response, result: { game?: any; error?: string; status?: number }, extra: Record<string, unknown> = {}) => {
    if (result.error) return res.status(result.status ?? 400).json({ message: result.error });
    res.status(200).json({ game: toPublic(result.game), ...extra });
};

const create = async (req: Request, res: Response) => {
    const { match } = req.body ?? {};
    if (!match?.team1?.players || !match?.team2?.players || !isValidPayload(req.body)) return res.status(400).json({ message: 'invalid game' });
    const binding = readBinding(req.body?.device, match) ?? { team: null, player: null };
    try {
        const code = await uniqueCode();
        const now = Date.now();
        const device: Device = { id: randomId(), token: randomToken(), name: cleanName(req.body?.device?.name), ...binding, joinedAt: now };
        const game = await LiveGame.create({
            code,
            match,
            startTeamIndex: req.body.startTeamIndex ?? null,
            startedAt: req.body.startedAt ?? null,
            actions: req.body.actions,
            devices: [device],
            createdAt: now,
            updatedAt: now,
        });
        res.status(201).json({ game: toPublic(game), code, token: device.token, deviceId: device.id });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Beitreten, Schritt 1: Spiel zum Code ansehen (Teams und belegte Plaetze fuer die Auswahl), ohne Schreibrecht
const peek = async (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    try {
        const game = await LiveGame.findOne({ code, ...isFresh() }).lean();
        if (!game) return res.status(404).json({ message: 'not found' });
        res.status(200).json({ game: toPublic(game) });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Beitreten, Schritt 2: als Spieler oder Tischende. Auch waehrend das Spiel laeuft.
const join = async (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    try {
        const token = randomToken();
        const id = randomId();
        const result = await updateDevices({ code, ...isFresh() }, (game) => {
            const binding = readBinding(req.body?.device, game.match);
            if (!binding || binding.team === null) return { error: 'invalid binding', status: 400 };
            const devices = (game.devices ?? []) as Device[];
            if (devices.length >= MAX_DEVICES) return { error: 'full', status: 409 };
            if (isTaken(devices, binding)) return { error: 'taken', status: 409 };
            return { devices: withJoined(devices, { id, token, name: cleanName(req.body?.device?.name), ...binding, joinedAt: Date.now() }) };
        });
        reply(res, result, result.game ? { code: result.game.code, token, deviceId: id } : {});
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Eigenes Handy umstellen (anderer Spieler / anderes Tischende)
const bind = async (req: Request, res: Response) => {
    const token = req.body?.token;
    try {
        const result = await updateDevices({ _id: req.params.id, ...canWrite(token), ...isFresh() }, (game) => {
            const devices = game.devices as Device[];
            const me = devices.find(device => device.token === token)!;
            const binding = readBinding(req.body, game.match);
            if (!binding) return { error: 'invalid binding', status: 400 };
            if (isTaken(devices, binding, me.id)) return { error: 'taken', status: 409 };
            return { devices: devices.map(device => device.id === me.id ? { ...device, ...binding } : device) };
        });
        reply(res, result);
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Handy steigt aus (selbst) oder wird von einem anderen Handy getrennt (z.B. Akku leer). Geht das letzte Handy, wird das
// Spiel pausiert (nicht beendet): der Ticker zeigt es noch 15 Minuten als pausiert, nach 2 h wird es abgeraeumt.
const removeDevice = async (req: Request, res: Response, targetOf: (devices: Device[], token: string) => string | undefined) => {
    const token = req.body?.token;
    try {
        const result = await updateDevices({ _id: req.params.id, ...canWrite(token) }, (game) => {
            const devices = game.devices as Device[];
            const target = targetOf(devices, token);
            if (!target) return { error: 'not found', status: 404 };
            const rest = devices.filter(device => device.id !== target);
            const leaving = devices.find(device => device.id === target);
            return { devices: rest, extra: rest.length ? {} : { paused: true, pausedBy: leaving?.name ?? null, pauseReady: [] } };
        });
        reply(res, result);
    } catch (error) {
        res.status(500).json({ error });
    }
};

const leave = (req: Request, res: Response) => removeDevice(req, res, (devices, token) => devices.find(device => device.token === token)?.id);
const kick = (req: Request, res: Response) => removeDevice(req, res, (devices) => devices.find(device => device.id === req.body?.deviceId)?.id);

const list = (req: Request, res: Response) => {
    // Verlassene Spiele abraeumen (nebenbei, Fehler egal)
    LiveGame.updateMany({ status: { $in: ['live', 'saving'] }, updatedAt: { $lt: Date.now() - STALE_MS } }, { $set: { status: 'aborted' } }).catch(() => {});
    LiveGame.find({ status: 'live', updatedAt: { $gt: Date.now() - TICKER_MS } })
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

// Aktueller Stand fuer ein Handy, das nicht schreiben durfte: 404 = nicht (mehr) dabei, sonst 409 mit dem Stand
const conflict = async (res: Response, id: string, token: unknown) => {
    const current = await LiveGame.findById(id).lean();
    const isMember = !!current && ((current.devices ?? []) as Device[]).some(device => device.token === token);
    if (!current || !isMember) return res.status(404).json({ message: 'not found' });
    res.status(409).json({ game: toPublic(current) });
};

// Neuer Stand eines Handys: nur wenn es auf dem aktuellen Stand aufbaut (baseVersion), sonst 409 mit dem Serverstand.
// match (z.B. getauschte Becherfarben) darf mitkommen.
const sync = async (req: Request, res: Response) => {
    const { token, baseVersion } = req.body ?? {};
    if (typeof baseVersion !== 'number' || !isValidPayload(req.body)) return res.status(400).json({ message: 'invalid payload' });
    try {
        const update: Record<string, unknown> = { actions: req.body.actions, updatedAt: Date.now() };
        if (req.body.startTeamIndex !== undefined) update.startTeamIndex = req.body.startTeamIndex;
        if (typeof req.body.paused === 'boolean') update.paused = req.body.paused;
        if (typeof req.body.pausedBy === 'string' || req.body.pausedBy === null) update.pausedBy = typeof req.body.pausedBy === 'string' ? req.body.pausedBy.slice(0, 40) : null;
        if (Array.isArray(req.body.pauseReady)) update.pauseReady = req.body.pauseReady.filter((id: unknown) => typeof id === 'string').slice(0, MAX_DEVICES).map((id: string) => id.slice(0, 64));
        if (typeof req.body.startedAt === 'number') update.startedAt = req.body.startedAt;
        if (req.body.match?.team1?.players && req.body.match?.team2?.players) update.match = req.body.match;
        const game = await LiveGame.findOneAndUpdate(
            { _id: req.params.id, ...canWrite(token), version: baseVersion, status: 'live' },
            { $set: update, $inc: { version: 1 } },
            { new: true },
        ).lean();
        if (game) return res.status(200).json({ game: toPublic(game) });
        await conflict(res, req.params.id, token);
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Eintragen: genau ein Handy beansprucht das Spiel, die anderen sehen "... traegt ein"
const claim = async (req: Request, res: Response) => {
    const token = req.body?.token;
    try {
        const game = await LiveGame.findOne({ _id: req.params.id, ...canWrite(token), status: 'live' }).lean();
        const me = ((game?.devices ?? []) as Device[]).find(device => device.token === token);
        const claimed = me && await LiveGame.findOneAndUpdate(
            { _id: req.params.id, status: 'live' },
            { $set: { status: 'saving', savingBy: me.id, updatedAt: Date.now() }, $inc: { version: 1 } },
            { new: true },
        ).lean();
        if (claimed) return res.status(200).json({ game: toPublic(claimed) });
        await conflict(res, req.params.id, token);
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Eintragen fehlgeschlagen: Spiel wieder freigeben
const release = async (req: Request, res: Response) => {
    const token = req.body?.token;
    try {
        const game = await LiveGame.findOne({ _id: req.params.id, ...canWrite(token), status: 'saving' }).lean();
        const me = ((game?.devices ?? []) as Device[]).find(device => device.token === token);
        const released = me && await LiveGame.findOneAndUpdate(
            { _id: req.params.id, status: 'saving', savingBy: me.id },
            { $set: { status: 'live', savingBy: null, updatedAt: Date.now() }, $inc: { version: 1 } },
            { new: true },
        ).lean();
        if (released) return res.status(200).json({ game: toPublic(released) });
        await conflict(res, req.params.id, token);
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Spiel eingetragen (done) oder abgebrochen (aborted): verschwindet aus dem Ticker, die anderen Handys erfahren es beim naechsten Abruf
const finish = async (req: Request, res: Response) => {
    const token = req.body?.token;
    const status = req.body?.status === 'done' ? 'done' : 'aborted';
    try {
        const game = await LiveGame.findOne({ _id: req.params.id, ...canWrite(token) }).lean();
        const me = ((game?.devices ?? []) as Device[]).find(device => device.token === token);
        if (!game || !me) return res.status(404).json({ message: 'not found' });
        const updated = await LiveGame.findOneAndUpdate(
            { _id: req.params.id },
            { $set: { status, endedBy: me.name, savingBy: null, updatedAt: Date.now() }, $inc: { version: 1 } },
            { new: true },
        ).lean();
        res.status(200).json({ game: toPublic(updated) });
    } catch (error) {
        res.status(500).json({ error });
    }
};

export default { create, peek, join, bind, kick, leave, list, read, sync, claim, release, finish };
