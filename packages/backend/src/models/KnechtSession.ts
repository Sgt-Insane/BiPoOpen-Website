import mongoose, { InferSchemaType, Schema } from 'mongoose';

// Lobby vor einem Knecht-Spiel mit mehreren Handys: Handys aneinanderstossen oder Code eingeben, Teams und Farben
// waehlen, Spieler ohne Handy dazunehmen. Mit dem Start wird daraus ein Live-Spiel (LiveGame), dort laeuft das Spiel.
// Jede Aenderung erhoeht version (optimistisches Sperren).

const SessionPlayerSchema = new Schema(
    {
        deviceId: { type: String, required: true },
        name: { type: String, required: true },
        team: { type: Number, required: true },     // 0 | 1
        joinedAt: { type: Number, required: true },
        phone: { type: Boolean, default: true },    // false: Spieler ohne eigenes Handy (ein anderes Handy traegt fuer ihn ein)
    },
    { _id: false }
);

const KnechtSessionSchema = new Schema(
    {
        code: { type: String, required: true, unique: true },    // 4 Ziffern, zum Beitreten
        hostId: { type: String, required: true },
        status: { type: String, enum: ['lobby', 'started', 'aborted'], default: 'lobby' },
        players: { type: [SessionPlayerSchema], default: [] },
        cupColors: { type: [String], default: null },                   // Becherfarben je Team
        live: { type: Schema.Types.Mixed, default: null },              // nach dem Start: { id, code } des Live-Spiels
        version: { type: Number, default: 1 },
        updatedAt: { type: Date, default: Date.now },
    },
    { versionKey: false, minimize: false }
);

// Alte Sessions raeumt MongoDB selbst ab
KnechtSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 12 });

export type IKnechtSession = InferSchemaType<typeof KnechtSessionSchema>;

export default mongoose.model<IKnechtSession>('KnechtSession', KnechtSessionSchema, 'knechtSessions');
