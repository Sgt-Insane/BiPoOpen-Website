import mongoose, { InferSchemaType, Schema } from 'mongoose';

// Angekuendigte Releases: jede Version wird nur einmal per Push verschickt
const ReleaseSchema = new Schema(
    {
        version: { type: String, required: true, unique: true },
        title: { type: String },
        notes: { type: [String], default: [] },
        announcedAt: { type: Number, required: true }
    },
    { versionKey: false }
);

export type IReleaseModel = InferSchemaType<typeof ReleaseSchema>;

export default mongoose.model<IReleaseModel>('Release', ReleaseSchema, 'releases');
