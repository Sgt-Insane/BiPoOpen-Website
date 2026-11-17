import mongoose, { InferSchemaType, Schema } from 'mongoose';

// Mehrspieler-Spiel des BiPo Knecht: jeder Spieler traegt auf seinem eigenen Handy ein.
// Der Spielstand ist die Aktionsliste der Knecht-Engine; jede Aenderung erhoeht version (optimistisches Sperren).

const SessionPlayerSchema = new Schema(
    {
        deviceId: { type: String, required: true },
        name: { type: String, required: true },
        team: { type: Number, required: true },     // 0 | 1
        joinedAt: { type: Number, required: true },
    },
    { _id: false }
);

const KnechtSessionSchema = new Schema(
    {
        code: { type: String, required: true, unique: true },    // 4 Ziffern, zum Beitreten
        hostId: { type: String, required: true },
        status: { type: String, enum: ['lobby', 'playing', 'saving', 'saved', 'aborted'], default: 'lobby' },
        players: { type: [SessionPlayerSchema], default: [] },
        match: { type: Schema.Types.Mixed, default: null },             // Teams und Wettbewerb, sobald gestartet
        startTeamIndex: { type: Number, default: null },
        actions: { type: [Schema.Types.Mixed], default: [] },           // KnechtAction[]
        authors: { type: [String], default: [] },                       // deviceId je Aktion
        paused: { type: Boolean, default: false },
        vote: { type: Schema.Types.Mixed, default: null },              // Speichern/Abbrechen: OK aller Handys
        savingBy: { type: String, default: null },
        result: { type: Schema.Types.Mixed, default: null },            // gespeichertes Spiel + Ziel-URL
        version: { type: Number, default: 1 },
        updatedAt: { type: Date, default: Date.now },
    },
    { versionKey: false, minimize: false }
);

// Alte Sessions raeumt MongoDB selbst ab
KnechtSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 12 });

export type IKnechtSession = InferSchemaType<typeof KnechtSessionSchema>;

export default mongoose.model<IKnechtSession>('KnechtSession', KnechtSessionSchema, 'knechtSessions');
