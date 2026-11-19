import mongoose, { InferSchemaType, Schema } from 'mongoose';

// Laufendes BiPo-Knecht-Spiel fuer Live-Ticker und Tracking mit mehreren Handys.
// Der Spielstand ist die Liste der Aktionen (wie im Knecht), version waechst mit jeder Aenderung:
// ein Handy schreibt nur, wenn es den aktuellen Stand kennt (sonst 409 und es holt sich den neuen Stand).

// Ein Handy im Spiel. team/player sagen, wofuer es eintraegt:
// - team null: ganzer Tisch (nur wenn es das einzige Handy ist, auch Schiri-Modus)
// - team gesetzt, player null: Tischende dieses Teams (alle Spieler des Teams)
// - team und player gesetzt: genau dieser Spieler (Spieler ohne eigenes Handy traegt sein Team mit ein)
const LiveDeviceSchema = new Schema(
    {
        id: { type: String, required: true },          // oeffentliche Kennung
        token: { type: String, required: true },       // Schreibrecht (nur dieses Handy kennt es)
        name: { type: String, default: null },
        team: { type: Number, default: null },
        player: { type: Number, default: null },
        joinedAt: { type: Number, required: true },
    },
    { _id: false }
);

const LiveGameSchema = new Schema(
    {
        code: { type: String, required: true, index: true },    // Beitrittscode fuer weitere Handys
        match: { type: Schema.Types.Mixed, required: true },     // Teams, Spielart, Becherfarben
        startTeamIndex: { type: Number, default: null },
        startedAt: { type: Number, default: null },
        actions: { type: [Schema.Types.Mixed], default: [] },
        version: { type: Number, default: 0 },
        // saving: ein Handy traegt gerade ein (savingBy), die anderen warten
        status: { type: String, enum: ['live', 'saving', 'done', 'aborted'], default: 'live' },
        devices: { type: [LiveDeviceSchema], default: [] },
        savingBy: { type: String, default: null },
        endedBy: { type: String, default: null },                 // Name des Handys, das eingetragen/abgebrochen hat
        paused: { type: Boolean, default: false },                // im Knecht pausiert: nicht im Ticker
        pausedBy: { type: String, default: null },                // wer pausiert hat (Name)
        createdAt: { type: Number, required: true },
        updatedAt: { type: Number, required: true, index: true },
    },
    { versionKey: false }
);

export type ILiveGameModel = InferSchemaType<typeof LiveGameSchema>;

export default mongoose.model<ILiveGameModel>('LiveGame', LiveGameSchema, 'livegames');
