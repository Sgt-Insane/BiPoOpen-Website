import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type ILeagueGameModel = InferSchemaType<typeof MatchSchema>;

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
    season: { type: String }, // z.B. "2026-27"; fehlt bei Altdaten -> gilt als "2025-26"
    league: { type: Number }, // 1 | 2; fehlt bei Altdaten -> gilt als 1
    cupId: { type: String }, // gesetzt bei Pokalspielen -> _id des LeagueCup
    cupRound: { type: Number }, // Index der Pokalrunde
    referee: { type: String }, // Schiedsrichter, falls das Spiel im BiPo Knecht von einer dritten Person eingetragen wurde
    turns: { type: [TurnSchema], default: [] }
  },
  { versionKey: false }
);

export default mongoose.model<ILeagueGameModel>('LeagueGame', MatchSchema, 'leagueGames');