import { NextFunction, Request, Response } from "express";
import { config } from "../config/config";
import PushSubscription, { FOLLOW_MODES, NOTIFICATION_CATEGORIES } from "../models/PushSubscription";
import { cardTeam, describeResult, normalizePlayerName, notifyAll, playerProfilePath, resultImageUrl, sendToSubscription } from "../util/notify";
import Release from "../models/Release";

// Nach dem Deploy (GitHub Action, siehe .github/workflows/release-push.yml): neue Version einmal ankuendigen.
// Geschuetzt per Bearer-Token RELEASE_PUSH_SECRET; dieselbe Version wird nie zweimal verschickt.
const releasePush = async (req: Request, res: Response) => {
    const token = (req.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!config.releaseSecret || token !== config.releaseSecret) return res.status(401).json({ message: 'unauthorized' });

    const { version, title, notes } = req.body ?? {};
    if (typeof version !== 'string' || !version.trim()) return res.status(400).json({ message: 'version missing' });
    const cleanNotes = Array.isArray(notes) ? notes.filter((note: unknown) => typeof note === 'string').slice(0, 10) : [];

    try {
        if (await Release.exists({ version })) return res.status(200).json({ skipped: true, message: 'already announced' });
        await Release.create({ version, title, notes: cleanNotes, announcedAt: Date.now() });
        const sent = await notifyAll('appUpdates', {
            title: `🎉 Update ${version}${typeof title === 'string' && title ? ` · ${title}` : ''}`,
            body: cleanNotes.slice(0, 3).join(' · ') || 'Neue Version der BiPo-Open-Seite',
            url: '/Neuigkeiten',
            tag: `release-${version}`,
        });
        res.status(201).json({ sent });
    } catch (error) {
        res.status(500).json({ error });
    }
};

// Baut ein $set-Update aus den erlaubten Feldern im Body
const buildUpdate = (preferences: any, followModes: any, followedPlayers: any) => {
    const update: Record<string, unknown> = {};

    if (preferences && typeof preferences === 'object') {
        NOTIFICATION_CATEGORIES.forEach((category) => {
            if (typeof preferences[category] === 'boolean') update[`preferences.${category}`] = preferences[category];
        });
    }

    if (followModes && typeof followModes === 'object') {
        NOTIFICATION_CATEGORIES.forEach((category) => {
            if (FOLLOW_MODES.includes(followModes[category])) update[`followModes.${category}`] = followModes[category];
        });
    }

    if (Array.isArray(followedPlayers)) {
        update.followedPlayers = [...new Set(
            followedPlayers
                .filter((name: unknown) => typeof name === 'string' && name.trim().length > 0)
                .map(normalizePlayerName)
        )].slice(0, 50);
    }

    return update;
};

const toResponse = (subscription: any) => ({
    preferences: subscription.preferences,
    followModes: subscription.followModes,
    followedPlayers: subscription.followedPlayers
});

const getVapidPublicKey = (req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({ publicKey: config.vapid.publicKey });
};

const subscribe = (req: Request, res: Response, next: NextFunction) => {
    const { subscription, preferences, followModes, followedPlayers } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        res.status(400).json({ message: 'Ungültige Subscription' });
        return;
    }

    const update = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        ...buildUpdate(preferences, followModes, followedPlayers)
    };

    PushSubscription.findOneAndUpdate({ endpoint: subscription.endpoint }, { $set: update }, { upsert: true, new: true, setDefaultsOnInsert: true })
        .then((saved) => res.status(201).json(toResponse(saved)))
        .catch((error) => res.status(500).json({ error }));
};

const updatePreferences = (req: Request, res: Response, next: NextFunction) => {
    const { endpoint, preferences, followModes, followedPlayers } = req.body;

    if (!endpoint) {
        res.status(400).json({ message: 'endpoint ist erforderlich' });
        return;
    }

    PushSubscription.findOneAndUpdate({ endpoint }, { $set: buildUpdate(preferences, followModes, followedPlayers) }, { new: true })
        .then((saved) => {
            if (saved) res.status(200).json(toResponse(saved));
            else res.status(404).json({ message: 'Subscription not found' });
        })
        .catch((error) => res.status(500).json({ error }));
};

const getStatus = (req: Request, res: Response, next: NextFunction) => {
    const { endpoint } = req.body;

    PushSubscription.findOne({ endpoint })
        .then((subscription) => {
            if (subscription) res.status(200).json(toResponse(subscription));
            else res.status(404).json({ message: 'Subscription not found' });
        })
        .catch((error) => res.status(500).json({ error }));
};

const unsubscribe = (req: Request, res: Response, next: NextFunction) => {
    const { endpoint } = req.body;

    PushSubscription.deleteOne({ endpoint })
        .then(() => res.status(200).json({ message: 'Unsubscribed' }))
        .catch((error) => res.status(500).json({ error }));
};

const sendTest = async (req: Request, res: Response, next: NextFunction) => {
    const { endpoint } = req.body;

    try {
        const subscription = await PushSubscription.findOne({ endpoint }).lean();
        if (!subscription) {
            res.status(404).json({ message: 'Subscription not found' });
            return;
        }

        // Sieht aus wie ein echtes offenes Spiel (gleicher Aufbau wie in OpenGame.createOpenGame), mit Beispieldaten
        const team1 = { players: [{ name: 'Jonas Weck', score: 6 }, { name: 'Leon Rose', score: 4 }] };
        const team2 = { players: [{ name: 'Simon Weck', score: 5 }, { name: 'Patrick Pohlmann', score: 4 }] };
        const result = describeResult(team1, team2);
        await sendToSubscription(subscription as any, {
            title: `🍺 ${result.title}`,
            body: `gegen ${result.opponents} · Offenes Spiel`,
            url: '/',
            image: resultImageUrl(cardTeam(team1), cardTeam(team2), 'Offenes Spiel'),
            tag: 'test',
            actions: [
                { action: 'game', title: 'Spiel ansehen', url: '/' },
                { action: 'profile', title: `Profil von ${result.winnerName.split(' ')[0]}`, url: playerProfilePath(result.winnerName) }
            ]
        });
        res.status(200).json({ message: 'Sent' });
    } catch (error) {
        res.status(500).json({ error });
    }
};

export default { getVapidPublicKey, subscribe, updatePreferences, getStatus, unsubscribe, sendTest, releasePush };
