import type { Plugin } from 'vite';
import crypto from 'crypto';
import { isBindingTaken, withJoinedDevice } from './src/components/frontend/biPoKnecht/liveDevices';

// Nur fuer den lokalen Entwicklungsserver (Demo-Modus): Live-Spiele im Arbeitsspeicher statt in der echten Datenbank.
// Gleiche Endpunkte wie das Backend (/live/...), erreichbar unter /__live/... - alle Handys im WLAN oder ueber
// den Tunnel teilen sich so dasselbe Live-Spiel. Nach einem Neustart des Dev-Servers ist alles weg.

type Device = { id: string; token: string; name: string | null; team: number | null; player: number | null; joinedAt: number };
type Match = { team1?: { players?: unknown[] }; team2?: { players?: unknown[] } };
type LiveGame = {
    id: string; code: string; match: Match; startTeamIndex: number | null; startedAt: number | null;
    actions: unknown[]; version: number; status: 'live' | 'saving' | 'done' | 'aborted'; createdAt: number; updatedAt: number;
    devices: Device[]; savingBy: string | null; endedBy: string | null; paused?: boolean; pausedBy?: string | null;
};

const STALE_MS = 2 * 60 * 60 * 1000;
// Wie das Backend: im Ticker nur, was gerade laeuft (nicht pausiert, Aenderung in den letzten 15 Minuten)
const TICKER_MS = 15 * 60 * 1000;
const MAX_DEVICES = 8;
const isInTicker = (game: LiveGame) => game.status === 'live' && isFresh(game) && !game.paused && game.updatedAt > Date.now() - TICKER_MS;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const games = new Map<string, LiveGame>();

const randomCode = () => Array.from(crypto.randomBytes(5), byte => CODE_CHARS[byte % CODE_CHARS.length]).join('');
const randomToken = () => crypto.randomBytes(18).toString('hex');
const randomId = () => crypto.randomBytes(6).toString('hex');
const isFresh = (game: LiveGame) => (game.status === 'live' || game.status === 'saving') && game.updatedAt > Date.now() - STALE_MS;
const uniqueCode = () => {
    let code = randomCode();
    while ([...games.values()].some(game => game.code === code && isFresh(game))) code = randomCode();
    return code;
};
// Wie das Backend: ohne Code und Schreibrechte
const toPublic = ({ code: _code, devices, ...game }: LiveGame) => ({ ...game, devices: devices.map(({ token: _token, ...device }) => device) });
const deviceOf = (game: LiveGame, token: unknown) => typeof token === 'string' && token ? game.devices.find(device => device.token === token) : undefined;
const findByCode = (code: string) => [...games.values()].find(item => item.code === code && isFresh(item));
const cleanName = (name: unknown) => typeof name === 'string' && name.trim() ? name.trim().slice(0, 60) : null;

const readBinding = (body: any, match: Match) => {
    const team = body?.team ?? null;
    const player = body?.player ?? null;
    if (team === null) return player === null ? { team: null, player: null } : null;
    if (team !== 0 && team !== 1) return null;
    const count = (team === 0 ? match.team1 : match.team2)?.players?.length ?? 0;
    if (player !== null && (!Number.isInteger(player) || player < 0 || player >= count)) return null;
    return { team: team as number, player: player as number | null };
};

const readBody = (req: import('http').IncomingMessage) => new Promise<any>((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
});

export const devLiveServer = (): Plugin => ({
    name: 'bipo-dev-live',
    apply: 'serve',
    configureServer(server) {
        server.middlewares.use('/__live', async (req, res) => {
            const send = (status: number, body: unknown) => {
                res.statusCode = status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(body));
            };
            const url = (req.url ?? '/').split('?')[0];
            const parts = url.split('/').filter(Boolean);
            const body = req.method === 'POST' ? await readBody(req) : {};
            const touch = (game: LiveGame) => { game.version++; game.updatedAt = Date.now(); };

            if (req.method === 'GET' && parts[0] === 'list')
                return send(200, { games: [...games.values()].filter(isInTicker).sort((a, b) => b.updatedAt - a.updatedAt).map(toPublic) });

            if (req.method === 'POST' && parts[0] === 'create') {
                if (!body?.match || !Array.isArray(body.actions)) return send(400, { message: 'invalid game' });
                const now = Date.now();
                const device: Device = { id: randomId(), token: randomToken(), name: cleanName(body.device?.name), ...(readBinding(body.device, body.match) ?? { team: null, player: null }), joinedAt: now };
                const game: LiveGame = {
                    id: crypto.randomBytes(12).toString('hex'), code: uniqueCode(),
                    match: body.match, startTeamIndex: body.startTeamIndex ?? null, startedAt: body.startedAt ?? null,
                    actions: body.actions, version: 0, status: 'live', createdAt: now, updatedAt: now,
                    devices: [device], savingBy: null, endedBy: null,
                };
                games.set(game.id, game);
                return send(201, { game: toPublic(game), code: game.code, token: device.token, deviceId: device.id });
            }

            if (req.method === 'POST' && parts[0] === 'peek') {
                const game = findByCode(String(body?.code ?? '').trim().toUpperCase());
                if (!game) return send(404, { message: 'not found' });
                return send(200, { game: toPublic(game) });
            }

            if (req.method === 'POST' && parts[0] === 'join') {
                const game = findByCode(String(body?.code ?? '').trim().toUpperCase());
                if (!game) return send(404, { message: 'not found' });
                const binding = readBinding(body?.device, game.match);
                if (!binding || binding.team === null) return send(400, { message: 'invalid binding' });
                if (game.devices.length >= MAX_DEVICES) return send(409, { message: 'full' });
                if (isBindingTaken(game.devices, binding)) return send(409, { message: 'taken' });
                const device: Device = { id: randomId(), token: randomToken(), name: cleanName(body.device?.name), ...binding, joinedAt: Date.now() };
                game.devices = withJoinedDevice(game.devices, device);
                touch(game);
                return send(200, { game: toPublic(game), code: game.code, token: device.token, deviceId: device.id });
            }

            const game = games.get(parts[0] ?? '');
            if (!game) return send(404, { message: 'not found' });

            if (req.method === 'GET' && parts.length === 1) return send(200, { game: toPublic(game) });

            const me = deviceOf(game, body?.token);
            if (!me) return send(404, { message: 'not found' });

            if (req.method === 'POST' && parts[1] === 'sync') {
                if (body.baseVersion !== game.version || game.status !== 'live') return send(409, { game: toPublic(game) });
                if (!Array.isArray(body.actions)) return send(400, { message: 'invalid payload' });
                game.actions = body.actions;
                if (body.startTeamIndex !== undefined) game.startTeamIndex = body.startTeamIndex;
                if (typeof body.paused === 'boolean') game.paused = body.paused;
                if (typeof body.pausedBy === 'string' || body.pausedBy === null) game.pausedBy = body.pausedBy;
                if (typeof body.startedAt === 'number') game.startedAt = body.startedAt;
                if (body.match?.team1?.players && body.match?.team2?.players) game.match = body.match;
                touch(game);
                return send(200, { game: toPublic(game) });
            }

            if (req.method === 'POST' && parts[1] === 'bind') {
                const binding = readBinding(body, game.match);
                if (!isFresh(game) || !binding || (binding.team === null && game.devices.length > 1)) return send(400, { message: 'invalid binding' });
                if (isBindingTaken(game.devices, binding, me.id)) return send(409, { message: 'taken' });
                Object.assign(me, binding);
                touch(game);
                return send(200, { game: toPublic(game) });
            }

            if (req.method === 'POST' && (parts[1] === 'leave' || parts[1] === 'kick')) {
                const target = parts[1] === 'leave' ? me.id : game.devices.find(device => device.id === body?.deviceId)?.id;
                if (!target) return send(404, { message: 'not found' });
                game.devices = game.devices.filter(device => device.id !== target);
                if (!game.devices.length) game.status = 'aborted';
                touch(game);
                return send(200, { game: toPublic(game) });
            }

            if (req.method === 'POST' && parts[1] === 'claim') {
                if (game.status !== 'live') return send(409, { game: toPublic(game) });
                Object.assign(game, { status: 'saving', savingBy: me.id });
                touch(game);
                return send(200, { game: toPublic(game) });
            }

            if (req.method === 'POST' && parts[1] === 'release') {
                if (game.status !== 'saving' || game.savingBy !== me.id) return send(409, { game: toPublic(game) });
                Object.assign(game, { status: 'live', savingBy: null });
                touch(game);
                return send(200, { game: toPublic(game) });
            }

            if (req.method === 'POST' && parts[1] === 'finish') {
                Object.assign(game, { status: body.status === 'done' ? 'done' : 'aborted', endedBy: me.name, savingBy: null });
                touch(game);
                return send(200, { game: toPublic(game) });
            }

            send(404, { message: 'not found' });
        });
    },
});
