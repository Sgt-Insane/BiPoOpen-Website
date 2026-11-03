import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type IPushSubscriptionModel = InferSchemaType<typeof PushSubscriptionSchema>;

export const NOTIFICATION_CATEGORIES = ['openGames', 'leagueGames', 'registrations', 'tournamentResults'] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];

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
        // leer = alle Spiele; sonst nur Spiele mit diesen Spielern (lowercase gespeichert)
        followedPlayers: { type: [String], default: [] }
    },
    { versionKey: false, timestamps: true }
);

export default mongoose.model<IPushSubscriptionModel>('PushSubscription', PushSubscriptionSchema, 'pushSubscriptions');
