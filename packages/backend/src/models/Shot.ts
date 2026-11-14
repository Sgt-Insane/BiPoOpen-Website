import mongoose, { InferSchemaType, Schema } from 'mongoose';

// Offener Shot aus dem BiPo Knecht: je 3 Airballs eines Teams trinkt jede Person einen Shot.
// Wird er nicht sofort getrunken ("Später"), landet er hier und kann auf der Webseite abgehakt werden.
const ShotSchema = new Schema(
    {
        name: { type: String, required: true },         // wer trinken muss
        teamName: { type: String },                     // Team im Spiel (zur Anzeige)
        opponentName: { type: String },                 // Gegner im Spiel (zur Anzeige)
        reason: { type: String, enum: ['airball'], default: 'airball' },
        gameTime: { type: Number },                     // Spielbeginn
        createdAt: { type: Number, required: true },
        drunkAt: { type: Number, default: null }        // abgehakt
    },
    { versionKey: false }
);

export type IShotModel = InferSchemaType<typeof ShotSchema>;

export default mongoose.model<IShotModel>('Shot', ShotSchema, 'shots');
