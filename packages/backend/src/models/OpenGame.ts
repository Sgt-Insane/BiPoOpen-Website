import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type IOpenGameModel = InferSchemaType<typeof MatchSchema>;

const PlayerSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    score: { type: Number, required: true }
  },
  { _id: false }
);

const TeamSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String },
    players: { type: [PlayerSchema], required: true }
  },
  { _id: false }
);

// Ereignisse aus dem BiPo Knecht ohne eigenen Wurf (Re-Rack, Beginn Nachwurf, Verlaengerung)
const EventSchema = new Schema(
  {
    kind: { type: String, enum: ['reRack', 'nachwurf', 'overtime'], required: true },
    teamIndex: { type: Number, required: true },
    afterTurnIndex: { type: Number, required: true },
    time: { type: Number }
  },
  { _id: false }
);

// TurnSchema
const TurnSchema = new Schema(
  {
    playerIndex: { type: Number, required: true },
    teamIndex: { type: Number, required: true },
    type: {
      type: String,
      enum: [
        'hit',
        'miss',
        'airball',
        'bomb',
        'bouncer',
        'trickshot',
        'onfire',
        'ballsback',
        'lastCup',
        'deathcup',
        'owncup'
      ],
      required: true
    },
    data: { type: Schema.Types.Mixed, required: true }, // flexibel für alle Turn-Datenstrukturen
    time: { type: Number, required: true }
  },
  { _id: false }
);

const MatchSchema = new Schema(
  {
    team1: { type: TeamSchema, required: true },
    team2: { type: TeamSchema, required: true },
    time: { type: Number },
    endTime: { type: Number },
    referee: { type: String }, // Schiedsrichter, falls das Spiel im BiPo Knecht von einer dritten Person eingetragen wurde
    events: { type: [EventSchema], default: undefined },
    turns: { type: [TurnSchema], default: [] }
  },
  { versionKey: false }
);

export default mongoose.model<IOpenGameModel>('OpenGame', MatchSchema, 'openGames');