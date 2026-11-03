import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type IPushSubscriptionModel = InferSchemaType<typeof PushSubscriptionSchema>;

export const NOTIFICATION_CATEGORIES = ['openGames', 'leagueGames', 'registrations', 'tournamentResults'] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];

export const FOLLOW_MODES = ['all', 'followed'] as const;

const PushSubscriptionSchema = new Schema(
    {
        endpoint: { type: String, required: true, unique: true },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true }
        },
        preferences: {
            openGames: { type: Boolean, default: true },
            leagueGames: { type: Boolean, default: true },
            registrations: { type: Boolean, default: false },
            tournamentResults: { type: Boolean, default: true }
        },
        // 'all' = alle Spiele, 'followed' = nur Spiele mit followedPlayers.
        // Eigenes Feld, damit die Liste beim Zurueckschalten auf 'all' erhalten bleibt.
        followMode: { type: String, enum: FOLLOW_MODES, default: 'all' },
        // lowercase gespeichert
        followedPlayers: { type: [String], default: [] }
    },
    { versionKey: false, timestamps: true }
);

export default mongoose.model<IPushSubscriptionModel>('PushSubscription', PushSubscriptionSchema, 'pushSubscriptions');
