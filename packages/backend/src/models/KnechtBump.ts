import mongoose, { InferSchemaType, Schema } from 'mongoose';

// "Handys aneinanderstossen": jedes Handy meldet seinen Stoss, zwei Stoesse kurz nacheinander gehoeren zusammen.
// time ist die Serverzeit - die Uhren der Handys spielen keine Rolle.
const KnechtBumpSchema = new Schema(
    {
        deviceId: { type: String, required: true },
        name: { type: String, required: true },
        code: { type: String, default: null },          // Handy ist schon in einer Lobby
        time: { type: Number, required: true },
        matchedCode: { type: String, default: null },   // 'pending' waehrend der Zuordnung, danach der Lobby-Code
        createdAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
);

KnechtBumpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 });
KnechtBumpSchema.index({ time: 1 });

export type IKnechtBump = InferSchemaType<typeof KnechtBumpSchema>;

export default mongoose.model<IKnechtBump>('KnechtBump', KnechtBumpSchema, 'knechtBumps');
