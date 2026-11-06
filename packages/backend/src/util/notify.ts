import webpush from 'web-push';
import { config } from '../config/config';
import PushSubscription, { NotificationCategory } from '../models/PushSubscription';

let vapidConfigured = false;

const ensureVapid = () => {
    if (vapidConfigured) return true;
    // subject muss "mailto:..." oder eine https-URL sein, sonst wirft setVapidDetails
    if (!config.vapid.publicKey || !config.vapid.privateKey || !config.vapid.subject) {
        console.warn('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT missing - push notifications disabled');
        return false;
    }
    webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
    vapidConfigured = true;
    return true;
};

export const normalizePlayerName = (name: string) => name.trim().toLowerCase();

interface GameTeam {
    name?: string | null;
    players: { name: string, score?: number }[];
}

const teamLabel = (team: GameTeam) => team.players.map((player) => player.name).join(" & ");
const teamScore = (team: GameTeam) => team.players.reduce((acc, player) => acc + (player.score ?? 0), 0);

// Gleiche Pfade wie getPlayerProfilePath im Frontend
export const playerProfilePath = (name: string) => `/Spieler/${encodeURIComponent(name).replaceAll('%20', '-')}`;

/**
 * Titel = Ergebnis, Gewinner zuerst: "Max & Tim gewinnen 10 : 7" bzw. mit Teamnamen "Don Promillo 10 : 3 BPC Likör".
 * Bei Unentschieden bleibt die eingetragene Reihenfolge.
 */
export const describeResult = (team1: GameTeam, team2: GameTeam, useTeamNames = false) => {
    const isDraw = teamScore(team1) === teamScore(team2);
    const [winner, loser] = teamScore(team1) >= teamScore(team2) ? [team1, team2] : [team2, team1];
    const label = (team: GameTeam) => (useTeamNames && team.name) || teamLabel(team);
    const score = `${teamScore(winner)} : ${teamScore(loser)}`;

    let title = `${label(winner)} ${score} ${label(loser)}`;
    if (!useTeamNames && !isDraw)
        title = `${label(winner)} ${winner.players.length > 1 ? 'gewinnen' : 'gewinnt'} ${score}`;

    return { title, isDraw, opponents: label(loser), winnerName: winner.players[0]?.name ?? '' };
};

const SITE_URL = 'https://bipoopen.de';

/**
 * Ergebniskarte als grosses Bild im Push (nur Android/Desktop), erzeugt von packages/frontend/api/push-image.ts.
 * players: Namen fuer die Avatare, name: Teamname statt Vornamen (Turnier, Liga).
 * leagueLogos: players sind Liga-Teams, die Karte zeigt deren Logos.
 */
export const resultImageUrl = (team1: CardTeam, team2: CardTeam, label: string, leagueLogos = false) => {
    const params = new URLSearchParams();
    ([[team1, '1'], [team2, '2']] as const).forEach(([team, key]) => {
        team.players.forEach((name) => params.append(`t${key}`, name));
        params.set(`s${key}`, String(team.score));
        if (team.name) params.set(`n${key}`, team.name);
    });
    params.set('label', label);
    if (leagueLogos) params.set('logos', '1');
    return `${SITE_URL}/api/push-image?${params}`;
};

export interface CardTeam {
    players: string[];
    score: number;
    name?: string | null;
}

// useTeamName (Liga): Teamname bzw. voller Name statt Vornamen, "players" sind dort die Teams selbst
export const cardTeam = (team: GameTeam, useTeamName = false): CardTeam => ({
    players: team.players.map((player) => player.name),
    score: teamScore(team),
    name: useTeamName ? (team.name || teamLabel(team)) : undefined
});

export const gamePlayerNames = (team1: GameTeam, team2: GameTeam) =>
    [...team1.players, ...team2.players].map((player) => player.name);

// Buttons unter der Benachrichtigung (Android/Desktop), max. 2. url wird in push-sw.js geoeffnet.
export interface NotificationAction {
    action: string;
    title: string;
    url: string;
}

export interface NotificationPayload {
    title: string;
    body: string;
    url: string;
    // Grosses Bild (Android ausgeklappt, Desktop). Icon ist immer das App-Icon (push-sw.js)
    image?: string;
    tag?: string;
    actions?: NotificationAction[];
}

interface StoredSubscription {
    endpoint: string;
    keys: { p256dh: string, auth: string };
}

export const sendToSubscription = async (subscription: StoredSubscription, payload: NotificationPayload) => {
    if (!ensureVapid()) return;

    try {
        await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: subscription.keys },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24 }
        );
    } catch (error: any) {
        // Subscription abgelaufen oder vom Nutzer entzogen
        if (error?.statusCode === 404 || error?.statusCode === 410) {
            await PushSubscription.deleteOne({ endpoint: subscription.endpoint });
        } else {
            console.log('Push error:', error?.statusCode, error?.body);
        }
    }
};

/**
 * Schickt eine Benachrichtigung an alle Subscriptions, die die Kategorie aktiviert haben
 * und (bei followModes[category] 'followed') mindestens einem der beteiligten Spieler folgen.
 * Wirft nie - Fehler werden nur geloggt.
 */
export const notify = async (category: NotificationCategory, payload: NotificationPayload, playerNames: string[] = []) => {
    try {
        if (!ensureVapid()) return;

        const normalizedPlayers = playerNames.filter(Boolean).map(normalizePlayerName);

        const subscriptions = await PushSubscription.find({
            [`preferences.${category}`]: true,
            $or: [
                { [`followModes.${category}`]: { $ne: 'followed' } },
                { followedPlayers: { $in: normalizedPlayers } }
            ]
        }).lean();

        await Promise.allSettled(subscriptions.map((subscription) => sendToSubscription(subscription as StoredSubscription, payload)));
    } catch (error) {
        console.log('Notify error:', error);
    }
};
