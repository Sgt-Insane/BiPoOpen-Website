import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import Tournament from "../models/Tournament";
import { tournamentAggregation } from "./TournamentAggregate";
import { notify, resultImageUrl } from "../util/notify";

const createTournament = (req: Request, res: Response, next: NextFunction) => {

    const tournament = new Tournament({
        _id: new mongoose.Types.ObjectId(),
        name: req.body.name,
        groupPhase: req.body.groupPhase,
        koPhase: req.body.koPhase,
        teams: req.body.teams,
        settings: req.body.settings
    });

    tournament
        .save()
        .then((tournament) => res.status(201).json({ message: "Tournament created successfully", tournament }))
        .catch((error) => res.status(500).json({ error }));
};

const readTournament = (req: Request, res: Response, next: NextFunction) => {
    let tournamentName = req.params.tournamentName;
    tournamentName = tournamentName.replaceAll("-", " ");

    // Erst nach Namen filtern, damit nicht alle Turniere aufbereitet werden
    Tournament.aggregate([{ $match: { name: tournamentName } }, ...tournamentAggregation()]).then((tournaments) => {
        const tournament = tournaments[0];
        if (tournament) {
            res.status(200).json({ tournament });
        } else {
            res.status(404).json({ message: "Tournament not found" });
        }
    }).catch((error) => {
        console.log(error);
        res.status(500).json({ message: error });
    });
};

const readAll = (req: Request, res: Response, next: NextFunction) => {
    Tournament.find()
        .lean()
        .then((tournaments) => {
            res.status(200).json({ tournaments });
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ message: error });
        });
};

const updateTournament = (req: Request, res: Response, next: NextFunction) => {
    const tournamentId = req.params.tournamentId;

    Tournament.findById(tournamentId)
        .then((tournament) => {
            if (tournament) {
                tournament.set(req.body);

                tournament
                    .save()
                    .then((tournament) => res.status(201).json({ message: "Tournament updated successfully", tournament }))
                    .catch((error) => res.status(500).json({ error }));
            } else {
                res.status(404).json({ message: 'not found' });
            }
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ message: error });
        });
};

const deleteTournament = (req: Request, res: Response, next: NextFunction) => {
    const tournamentId = req.params.tournamentId;

    Tournament.findByIdAndDelete(tournamentId)
        .then((tournament) => {
            if (tournament) {
                res.status(200).json({ message: "Tournament deleted" });
            } else {
                res.status(404).json({ message: "Tournament not found" });
            }
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ message: error });
        });
};

const addTeam = (req: Request, res: Response, next: NextFunction) => {
    const tournamentId = req.params.tournamentId;
    const team = req.body.team; 

    Tournament.findById(tournamentId)
        .then((tournament) => {
            if (tournament) {
                tournament.teams.push(team);
                tournament
                    .save()
                    .then((updatedTournament) => res.status(201).json({ message: "Team added successfully", tournament: updatedTournament }))
                    .catch((error) => {
                        console.log(error);
                        res.status(500).json({ message: error });
                    });
            } else {
                res.status(404).json({ message: "Tournament not found" });
            }
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ message: error });
        });
};

const editTeam = (req: Request, res: Response, next: NextFunction) => {
    let tournamentID = req.params.tournamentId;
    let team = req.body.team;

    Tournament.findById(tournamentID)
        .then((tournament) => {
            if (tournament) {
                // Find team index
                const teamIndex = tournament.teams.findIndex((t) => t._id.toString() === team._id.toString());

                // Abort if missing
                if (teamIndex === -1) return res.status(404).json({ message: "Team not found" });

                // Update team
                tournament.teams[teamIndex] = { ...tournament.teams[teamIndex], ...team };

                tournament
                    .save()
                    .then((updatedTournament) => res.status(201).json({ message: "Team updated successfully", tournament: updatedTournament }))
                    .catch((error) => {
                        console.log(error);
                        res.status(500).json({ message: error });
                    });
            } else {
                res.status(404).json({ message: "Tournament not found" });
            }
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ message: error });
        });
}


const removeTeam = (req: Request, res: Response, next: NextFunction) => {
    let tournamentID = req.params.tournamentId;
    let teamID = req.body.teamID;

    Tournament.findById(tournamentID)
        .then((tournament) => {
            if (tournament) {
                // Find team index
                const teamIndex = tournament.teams.findIndex((t) => t._id.toString() === teamID.toString());

                // Abort if missing
                if (teamIndex === -1) return res.status(404).json({ message: "Team not found" });

                // Remove team
                tournament.teams.splice(teamIndex, 1);

                tournament
                    .save()
                    .then((updatedTournament) => res.status(201).json({ message: "Team removed successfully", tournament: updatedTournament }))
                    .catch((error) => {
                        console.log(error);
                        res.status(500).json({ message: error });
                    });
            } else {
                res.status(404).json({ message: "Tournament not found" });
            }
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ message: error });
        });
}

const setGroups = (req: Request, res: Response, next: NextFunction) => {
    let tournamentID = req.body.tournamentID;
    let groups = req.body.groups;

    Tournament.findById(tournamentID)
        .then((tournament) => {
            if (tournament) {

                // Update group 
                tournament.groupPhase.groups = groups;

                tournament
                    .save()
                    .then((updatedTournament) => res.status(201).json({ message: "Set Groups successfully", tournament: updatedTournament }))
                    .catch((error) => {
                        console.log(error);
                        res.status(500).json({ message: error });
                    });
            } else {
                res.status(404).json({ message: "Tournament not found" });
            }
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ message: error });
        });
}

const hasResult = (match: any) => match?.result?.team1Score != null && match?.result?.team2Score != null;

// Vergleicht alte und neue Matches nach Position und benachrichtigt über neu eingetragene Ergebnisse
const notifyNewResults = async (tournament: any, oldMatches: any[][], newMatches: any[][], isGroupPhase: boolean) => {
    const urlSegment = isGroupPhase ? 'Gruppenphase' : 'K.o.Phase';
    const url = `/${tournament.name}/${urlSegment}`;
    const teamsByID = new Map<string, any>(tournament.teams.map((team: any) => [String(team._id), team]));
    const notifications: Promise<void>[] = [];

    newMatches.forEach((matchesForGroup, i) => {
        matchesForGroup.forEach((match, j) => {
            const oldMatch = oldMatches?.[i]?.[j];
            const sameTeams = oldMatch && String(oldMatch.team1ID) === String(match.team1ID) && String(oldMatch.team2ID) === String(match.team2ID);
            if (!hasResult(match) || (sameTeams && hasResult(oldMatch))) return;

            const team1 = teamsByID.get(String(match.team1ID));
            const team2 = teamsByID.get(String(match.team2ID));
            if (!team1 || !team2) return;

            // Gewinner zuerst: "Weck-Knicken 10 : 6 Not und Elend"
            const team1Won = match.result.team1Score >= match.result.team2Score;
            const [winner, loser] = team1Won ? [team1, team2] : [team2, team1];
            const [winnerScore, loserScore] = team1Won
                ? [match.result.team1Score, match.result.team2Score]
                : [match.result.team2Score, match.result.team1Score];
            const phaseLabel = isGroupPhase ? `Gruppe ${String.fromCharCode(65 + i)}` : 'K.o.-Phase';

            notifications.push(notify('tournamentResults', {
                title: `🔥 ${winner.name} ${winnerScore} : ${loserScore} ${loser.name}`,
                body: `${tournament.name} · ${phaseLabel}`,
                url,
                image: resultImageUrl(
                    { players: team1.players, score: match.result.team1Score, name: team1.name },
                    { players: team2.players, score: match.result.team2Score, name: team2.name },
                    phaseLabel
                ),
                tag: `tournament-${tournament._id}-${urlSegment}-${i}-${j}`,
                actions: [{ action: 'phase', title: isGroupPhase ? 'Gruppe ansehen' : 'K.o.-Phase ansehen', url }]
            }, [...team1.players, ...team2.players]));
        });
    });

    await Promise.all(notifications);
};

const setMatchesGroupPhase = (req: Request, res: Response, next: NextFunction) => {
    let tournamentID = req.body.tournamentID;
    let matches  = req.body.matches;

    Tournament.findById(tournamentID)
        .then((tournament) => {
            if (tournament) {

                matches.forEach((matchesForGroup:any) => {
                    matchesForGroup.forEach((match:any) => {
                        match._id = new mongoose.Types.ObjectId();
                    });
                });

                const oldMatches = JSON.parse(JSON.stringify(tournament.groupPhase.matches ?? []));
                tournament.groupPhase.matches = matches;
                tournament
                    .save()
                    .then(async (updatedTournament) => {
                        await notifyNewResults(updatedTournament, oldMatches, matches, true);
                        res.status(201).json({ message: "Matches Groupphase updated successfully", tournament: updatedTournament });
                    })
                    .catch((error) => {
                        console.log(error);
                        res.status(500).json({ message: error });
                    });
            } else {
                res.status(404).json({ message: "Tournament not found" });
            }
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ message: error });
        });
}

const setMatchesKOPhase = (req: Request, res: Response, next: NextFunction) => {
    let tournamentID = req.body.tournamentID;
    let matches  = req.body.matches;

    Tournament.findById(tournamentID)
        .then((tournament) => {
            if (tournament) {

                matches.forEach((matchesForGroup:any) => {
                    matchesForGroup.forEach((match:any) => {
                        match._id = new mongoose.Types.ObjectId();
                    });
                });

                // Update group matches
                const oldMatches = JSON.parse(JSON.stringify(tournament.koPhase.matches ?? []));
                tournament.koPhase.matches = matches;

                tournament
                    .save()
                    .then(async (updatedTournament) => {
                        await notifyNewResults(updatedTournament, oldMatches, matches, false);
                        res.status(201).json({ message: "Matches KOPhase updated successfully", tournament: updatedTournament });
                    })
                    .catch((error) => {
                        console.log(error);
                        res.status(500).json({ message: error });
                    });
            } else {
                res.status(404).json({ message: "Tournament not found" });
            }
        })
        .catch((error) => {
            console.log(error);
            res.status(500).json({ message: error });
        });
}

export default { createTournament, readTournament, readAll, updateTournament, deleteTournament, addTeam, editTeam, removeTeam, setGroups, setMatchesGroupPhase, setMatchesKOPhase};