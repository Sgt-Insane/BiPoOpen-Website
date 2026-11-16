import mongoose, { InferSchemaType, Schema } from 'mongoose';

// Laufendes BiPo-Knecht-Spiel fuer Live-Ticker und Tracking mit zwei Handys.
// Der Spielstand ist die Liste der Aktionen (wie im Knecht), version waechst mit jeder Aenderung:
// ein Handy schreibt nur, wenn es den aktuellen Stand kennt (sonst 409 und es holt sich den neuen Stand).
const LiveGameSchema = new Schema(
    {
        code: { type: String, required: true, index: true },    // Beitrittscode fuer das zweite Handy
        token: { type: String, required: true },                // Schreibrecht (nur die Handys im Spiel kennen es)
        match: { type: Schema.Types.Mixed, required: true },     // Teams, Spielart, Becherfarben
        startTeamIndex: { type: Number, default: null },
        startedAt: { type: Number, default: null },
        actions: { type: [Schema.Types.Mixed], default: [] },
        version: { type: Number, default: 0 },
        status: { type: String, enum: ['live', 'done', 'aborted'], default: 'live' },
        devices: { type: Number, default: 1 },
        paused: { type: Boolean, default: false },                // im Knecht pausiert: nicht im Ticker
        // Zweites Handy: eigenes Schreibrecht (beim Trennen widerrufbar), oeffentliche Kennung und Tischseite (Teamindex)
        guestToken: { type: String, default: null },
        guestId: { type: String, default: null },
        guestSide: { type: Number, default: null },
        createdAt: { type: Number, required: true },
        updatedAt: { type: Number, required: true, index: true },
    },
    { versionKey: false }
);

export type ILiveGameModel = InferSchemaType<typeof LiveGameSchema>;

export default mongoose.model<ILiveGameModel>('LiveGame', LiveGameSchema, 'livegames');
