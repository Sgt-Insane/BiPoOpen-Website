import mongoose, { InferSchemaType, Schema } from 'mongoose';

export type ITournamentModel = InferSchemaType<typeof TournamentSchema>;

const TournamentSchema = new Schema(
    {
        name: { type: String, required: true },
        groupPhase: {
            type: {
                groups: {
                    type: [
                        {
                            teams: [
                                {
                                    teamID: { type: Schema.Types.ObjectId, ref: 'Team' },
                                    _id: false
                                }
                            ]
                        }
                    ]
                },
                matches: {
                    type: [
                        [
                            {
                                team1ID: { type: Schema.Types.ObjectId, ref: 'Team' },
                                team2ID: { type: Schema.Types.ObjectId, ref: 'Team' },
                                time: { type: Number, required: false }, // Zeitpunkt des ersten Ergebnis-Eintrags; fehlt bei Altdaten
                                result: {
                                    team1Score: { type: Number, required: false },
                                    team2Score: { type: Number, required: false },
                                    team1Player1Score: { type: Number, required: false },
                                    team1Player2Score: { type: Number, required: false },
                                    team2Player1Score: { type: Number, required: false },
                                    team2Player2Score: { type: Number, required: false }
                                }
                            }
                        ]
                    ]
                }
            },
            required: true
        },
        koPhase: {
            type: {
                matches: [
                    [
                        {
                            team1ID: { type: Schema.Types.ObjectId, ref: 'Team' },
                            team2ID: { type: Schema.Types.ObjectId, ref: 'Team' },
                            time: { type: Number, required: false }, // Zeitpunkt des ersten Ergebnis-Eintrags; fehlt bei Altdaten
                            result: {
                                team1Score: { type: Number, required: false },
                                team2Score: { type: Number, required: false },
                                team1Player1Score: { type: Number, required: false },
                                team1Player2Score: { type: Number, required: false },
                                team2Player1Score: { type: Number, required: false },
                                team2Player2Score: { type: Number, required: false }
                            }
                        }
                    ]
                ]
            },
            required: true
        },
        teams: [
            {
                name: { type: String, required: true },
                players: { type: [String], required: true },
                logo: { type: String, required: false }
            }
        ],
        settings: {
            type: {
                trackPlayerShots: { type: Boolean, required: true },
                trackTeamShots: { type: Boolean, required: true },
                fixedGroupAmmount: { type: Number, required: true, default: 4 },
                advancingTeamsPerGroup: { type: Number, required: true, default: 2 },
            },
            required: true
        }
    }, 
    {
        versionKey: false
    }
);

export default mongoose.model<ITournamentModel>('Tournament', TournamentSchema, "tournaments");