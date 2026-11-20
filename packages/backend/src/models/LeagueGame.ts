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

// Ereignisse aus dem BiPo Knecht ohne eigenen Wurf (Re-Rack, Beginn Nachwurf, Verlaengerung)
const EventSchema = new Schema(
  {
    kind: { type: String, enum: ['reRack', 'nachwurf', 'overtime', 'turnStart'], required: true },
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
        'owncup',
        'penalty'
      ],
      required: true
    },
    // flexibel für alle Turn-Datenstrukturen. Nicht required: Mongoose entfernt leere Objekte ({} bei miss/airball)
    // beim Speichern, sonst liesse sich ein Spiel mit Wuerfen danach nie wieder speichern (z.B. Teamname aendern).
    data: { type: Schema.Types.Mixed },
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
    events: { type: [EventSchema], default: undefined },
    cupColors: { type: [String], default: undefined }, // BiPo Knecht: Becherfarbe je Team, falls getauscht
    turns: { type: [TurnSchema], default: [] }
  },
  { versionKey: false }
);

export default mongoose.model<ILeagueGameModel>('LeagueGame', MatchSchema, 'leagueGames');