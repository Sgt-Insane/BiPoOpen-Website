import type { Plugin } from 'vite';
import { createLocalServer, createMemoryStore } from './src/components/frontend/multiplayer/multiplayerLocalServer';
import { MpError } from './src/components/frontend/multiplayer/multiplayerTypes';

// Nur fuer den lokalen Entwicklungsserver (Demo-Modus): Anstoss-Lobbys im Arbeitsspeicher statt in der echten
// Datenbank. Gleiche Endpunkte wie das Backend (/knechtSessions/...), erreichbar unter /__mp/... - so finden sich
// auch echte Handys im WLAN oder ueber den Tunnel. Gleiche Regeln wie die Tab-Demo (multiplayerLocalServer.ts).
// Nach einem Neustart des Dev-Servers sind alle Lobbys weg.

const readBody = (req: import('http').IncomingMessage) => new Promise<any>((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
});

export const devMpServer = (): Plugin => ({
    name: 'bipo-dev-mp',
    apply: 'serve',
    configureServer(server) {
        const lobby = createLocalServer(createMemoryStore());
        server.middlewares.use('/__mp', async (req, res) => {
            const send = (status: number, body: unknown) => {
                res.statusCode = status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(body));
            };
            if (req.method !== 'POST') return send(404, { message: 'not found' });
            const parts = (req.url ?? '/').split('?')[0].split('/').filter(Boolean);
            const body = await readBody(req);
            try {
                if (parts[0] === 'create') return send(201, { session: lobby.create(String(body.deviceId), String(body.name)) });
                if (parts[0] === 'join') return send(200, { session: lobby.join(String(body.code), String(body.deviceId), String(body.name)) });
                if (parts[0] === 'bump' && parts[1]) return send(200, lobby.bumpStatus(parts[1]));
                if (parts[0] === 'bump') return send(200, lobby.bump(String(body.deviceId), String(body.name), body.code ?? null));
                const [code, action] = parts;
                if (action === 'get') {
                    const session = lobby.get(code, Number(body.since) || undefined);
                    return send(200, session ? { session } : { unchanged: true });
                }
                if (action === 'update') {
                    const result = lobby.update(code, Number(body.baseVersion), body.patch ?? {});
                    return send(result.ok ? 200 : 409, { session: result.session });
                }
                if (action === 'leave') return send(200, { session: lobby.leave(code, String(body.deviceId)) });
                send(404, { message: 'not found' });
            } catch (error) {
                if (error instanceof MpError) return send(error.status ?? 400, { message: error.message });
                send(500, { message: 'Fehler im Demo-Server' });
            }
        });
    },
});
