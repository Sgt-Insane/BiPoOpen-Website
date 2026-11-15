import type { Plugin } from 'vite';
import crypto from 'crypto';

// Nur fuer den lokalen Entwicklungsserver (Demo-Modus): Live-Spiele im Arbeitsspeicher statt in der echten Datenbank.
// Gleiche Endpunkte wie das Backend (/live/...), erreichbar unter /__live/... - alle Handys im WLAN oder ueber
// den Tunnel teilen sich so dasselbe Live-Spiel. Nach einem Neustart des Dev-Servers ist alles weg.

type LiveGame = {
    id: string; code: string; token: string; match: unknown; startTeamIndex: number | null; startedAt: number | null;
    actions: unknown[]; version: number; status: 'live' | 'done' | 'aborted'; devices: number; createdAt: number; updatedAt: number;
};

const STALE_MS = 2 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const games = new Map<string, LiveGame>();

const randomCode = () => Array.from(crypto.randomBytes(5), byte => CODE_CHARS[byte % CODE_CHARS.length]).join('');
const toPublic = ({ code: _code, token: _token, ...game }: LiveGame) => game;
const isFresh = (game: LiveGame) => game.status === 'live' && game.updatedAt > Date.now() - STALE_MS;

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

            if (req.method === 'GET' && parts[0] === 'list')
                return send(200, { games: [...games.values()].filter(isFresh).sort((a, b) => b.updatedAt - a.updatedAt).map(toPublic) });

            if (req.method === 'POST' && parts[0] === 'create') {
                if (!body?.match || !Array.isArray(body.actions)) return send(400, { message: 'invalid game' });
                let code = randomCode();
                while ([...games.values()].some(game => game.code === code && isFresh(game))) code = randomCode();
                const now = Date.now();
                const game: LiveGame = {
                    id: crypto.randomBytes(12).toString('hex'), code, token: crypto.randomBytes(18).toString('hex'),
                    match: body.match, startTeamIndex: body.startTeamIndex ?? null, startedAt: body.startedAt ?? null,
                    actions: body.actions, version: 0, status: 'live', devices: 1, createdAt: now, updatedAt: now,
                };
                games.set(game.id, game);
                return send(201, { game: toPublic(game), code, token: game.token });
            }

            if (req.method === 'POST' && parts[0] === 'join') {
                const code = String(body?.code ?? '').trim().toUpperCase();
                const game = [...games.values()].find(item => item.code === code && isFresh(item));
                if (!game) return send(404, { message: 'not found' });
                game.devices++;
                return send(200, { game: toPublic(game), code: game.code, token: game.token });
            }

            const game = games.get(parts[0] ?? '');
            if (!game) return send(404, { message: 'not found' });

            if (req.method === 'GET' && parts.length === 1) return send(200, { game: toPublic(game) });

            if (req.method === 'POST' && parts[1] === 'sync') {
                if (body?.token !== game.token) return send(404, { message: 'not found' });
                if (body.baseVersion !== game.version || game.status !== 'live') return send(409, { game: toPublic(game) });
                if (!Array.isArray(body.actions)) return send(400, { message: 'invalid payload' });
                game.actions = body.actions;
                if (body.startTeamIndex !== undefined) game.startTeamIndex = body.startTeamIndex;
                if (typeof body.startedAt === 'number') game.startedAt = body.startedAt;
                game.version++;
                game.updatedAt = Date.now();
                return send(200, { game: toPublic(game) });
            }

            if (req.method === 'POST' && parts[1] === 'finish') {
                if (body?.token !== game.token) return send(404, { message: 'not found' });
                game.status = body.status === 'done' ? 'done' : 'aborted';
                game.updatedAt = Date.now();
                return send(200, { game: toPublic(game) });
            }

            send(404, { message: 'not found' });
        });
    },
});
