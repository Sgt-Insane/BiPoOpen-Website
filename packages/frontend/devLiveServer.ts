import type { Plugin } from 'vite';
import crypto from 'crypto';

// Nur fuer den lokalen Entwicklungsserver (Demo-Modus): Live-Spiele im Arbeitsspeicher statt in der echten Datenbank.
// Gleiche Endpunkte wie das Backend (/live/...), erreichbar unter /__live/... - alle Handys im WLAN oder ueber
// den Tunnel teilen sich so dasselbe Live-Spiel. Nach einem Neustart des Dev-Servers ist alles weg.

type LiveGame = {
    id: string; code: string; token: string; match: unknown; startTeamIndex: number | null; startedAt: number | null;
    actions: unknown[]; version: number; status: 'live' | 'done' | 'aborted'; createdAt: number; updatedAt: number;
    guestToken: string | null; guestId: string | null; guestSide: number | null; paused?: boolean;
};

const STALE_MS = 2 * 60 * 60 * 1000;
// Wie das Backend: im Ticker nur, was gerade laeuft (nicht pausiert, Aenderung in den letzten 15 Minuten)
const TICKER_MS = 15 * 60 * 1000;
const isInTicker = (game: LiveGame) => isFresh(game) && !game.paused && game.updatedAt > Date.now() - TICKER_MS;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const games = new Map<string, LiveGame>();

const randomCode = () => Array.from(crypto.randomBytes(5), byte => CODE_CHARS[byte % CODE_CHARS.length]).join('');
const isFresh = (game: LiveGame) => game.status === 'live' && game.updatedAt > Date.now() - STALE_MS;
const uniqueCode = () => {
    let code = randomCode();
    while ([...games.values()].some(game => game.code === code && isFresh(game))) code = randomCode();
    return code;
};
// Wie das Backend: ohne Code und Schreibrechte, devices aus dem zweiten Handy abgeleitet
const toPublic = ({ code: _code, token: _token, guestToken, ...game }: LiveGame) => ({ ...game, devices: guestToken ? 2 : 1 });
const canWrite = (game: LiveGame, token: unknown) => !!token && (token === game.token || token === game.guestToken);
const findByCode = (code: string) => [...games.values()].find(item => item.code === code && isFresh(item));

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
                const game: LiveGame = {
                    id: crypto.randomBytes(12).toString('hex'), code: uniqueCode(), token: crypto.randomBytes(18).toString('hex'),
                    match: body.match, startTeamIndex: body.startTeamIndex ?? null, startedAt: body.startedAt ?? null,
                    actions: body.actions, version: 0, status: 'live', createdAt: now, updatedAt: now,
                    guestToken: null, guestId: null, guestSide: null,
                };
                games.set(game.id, game);
                return send(201, { game: toPublic(game), code: game.code, token: game.token });
            }

            if (req.method === 'POST' && parts[0] === 'peek') {
                const game = findByCode(String(body?.code ?? '').trim().toUpperCase());
                if (!game) return send(404, { message: 'not found' });
                return send(200, { game: toPublic(game), busy: !!game.guestToken });
            }

            if (req.method === 'POST' && parts[0] === 'join') {
                if (body?.side !== 0 && body?.side !== 1) return send(400, { message: 'invalid side' });
                const game = findByCode(String(body?.code ?? '').trim().toUpperCase());
                if (!game) return send(404, { message: 'not found' });
                if (game.guestToken) return send(409, { message: 'busy' });
                game.guestToken = crypto.randomBytes(18).toString('hex');
                game.guestId = crypto.randomBytes(6).toString('hex');
                game.guestSide = body.side;
                touch(game);
                return send(200, { game: toPublic(game), code: game.code, token: game.guestToken });
            }

            const game = games.get(parts[0] ?? '');
            if (!game) return send(404, { message: 'not found' });

            if (req.method === 'GET' && parts.length === 1) return send(200, { game: toPublic(game) });

            if (req.method === 'POST' && parts[1] === 'sync') {
                if (!canWrite(game, body?.token)) return send(404, { message: 'not found' });
                if (body.baseVersion !== game.version || game.status !== 'live') return send(409, { game: toPublic(game) });
                if (!Array.isArray(body.actions)) return send(400, { message: 'invalid payload' });
                game.actions = body.actions;
                if (body.startTeamIndex !== undefined) game.startTeamIndex = body.startTeamIndex;
                if (typeof body.paused === 'boolean') game.paused = body.paused;
                if (typeof body.startedAt === 'number') game.startedAt = body.startedAt;
                if (body.match?.team1?.players && body.match?.team2?.players) game.match = body.match;
                touch(game);
                return send(200, { game: toPublic(game) });
            }

            if (req.method === 'POST' && parts[1] === 'kick') {
                if (body?.token !== game.token || game.status !== 'live') return send(404, { message: 'not found' });
                Object.assign(game, { guestToken: null, guestId: null, guestSide: null, code: uniqueCode() });
                touch(game);
                return send(200, { game: toPublic(game), code: game.code });
            }

            if (req.method === 'POST' && parts[1] === 'leave') {
                if (!body?.token || body.token !== game.guestToken) return send(404, { message: 'not found' });
                Object.assign(game, { guestToken: null, guestId: null, guestSide: null });
                touch(game);
                return send(200, { game: toPublic(game) });
            }

            if (req.method === 'POST' && parts[1] === 'finish') {
                if (!canWrite(game, body?.token)) return send(404, { message: 'not found' });
                game.status = body.status === 'done' ? 'done' : 'aborted';
                game.updatedAt = Date.now();
                return send(200, { game: toPublic(game) });
            }

            send(404, { message: 'not found' });
        });
    },
});
