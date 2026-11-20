import { NextFunction, Request, Response } from "express";
import LeagueCup from "../models/LeagueCup";
import LeagueGame from "../models/LeagueGame";

type CupPairing = { team1: string; team2: string };
type CupGameTeam = { name?: string | null; players: { name: string; score?: number | null }[] };
type CupGame = { team1: CupGameTeam; team2: CupGameTeam; time?: number | null; cupRound?: number | null };

/////////////
// HELPERS //
/////////////
const getTeamNames = (team: CupGameTeam) =>
    [team.name, ...team.players.map(player => player.name)]
        .filter((name): name is string => !!name)
        .map(name => name.toLocaleLowerCase());

const getTeamScore = (team: CupGameTeam) => team.players.reduce((acc, player) => acc + (player.score ?? 0), 0);

// Sieger einer Paarung: bei Best-of-1 das erste entschiedene Spiel, bei Best-of-3 wer zuerst 2 Siege hat.
const getPairingWinner = (pairing: CupPairing, roundGames: CupGame[], bestOf: number) => {
    const team1Name = pairing.team1.toLocaleLowerCase();
    const team2Name = pairing.team2.toLocaleLowerCase();
    const winsNeeded = Math.floor(bestOf / 2) + 1;
    let team1Wins = 0;
    let team2Wins = 0;

    const games = roundGames
        .filter(game => {
            const names = [...getTeamNames(game.team1), ...getTeamNames(game.team2)];
            return names.includes(team1Name) && names.includes(team2Name);
        })
        .sort((game1, game2) => (game1.time ?? 0) - (game2.time ?? 0));

    for (const game of games) {
        const gameTeam1Score = getTeamScore(game.team1);
        const gameTeam2Score = getTeamScore(game.team2);
        if (gameTeam1Score === gameTeam2Score)
            continue;

        const gameTeam1IsPairingTeam1 = getTeamNames(game.team1).includes(team1Name);
        if (gameTeam1IsPairingTeam1 === (gameTeam1Score > gameTeam2Score))
            team1Wins++;
        else
            team2Wins++;

        if (team1Wins >= winsNeeded) return pairing.team1;
        if (team2Wins >= winsNeeded) return pairing.team2;
    }

    return undefined;
};

// Bei n Teams, die keine 2er-Potenz sind: so viele Freilose, dass danach genau eine 2er-Potenz uebrig bleibt.
// 25 Teams -> 9 Spiele + 7 Freilose -> 16 Teams in der 2. Runde.
const getByeCount = (teamCount: number) => {
    const powerOfTwo = 2 ** Math.floor(Math.log2(teamCount));
    if (powerOfTwo === teamCount) return 0;
    return 2 * powerOfTwo - teamCount;
};

// 25 Teams -> 1. Runde, 2. Runde, Viertelfinale, Halbfinale, Finale
const getRoundName = (teamCount: number, roundIndex: number) => {
    if (teamCount === 2) return 'Finale';
    if (teamCount === 4) return 'Halbfinale';
    if (teamCount === 8) return 'Viertelfinale';
    return `${roundIndex + 1}. Runde`;
};

/////////////
// ROUTES  //
/////////////
const createLeagueCup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { season, name, participants } = req.body;

        if (!season || !Array.isArray(participants) || participants.length < 2)
            return res.status(400).json({ message: "season and at least 2 participants are required" });

        const teamNames = participants.map((participant: { teamName: string }) => participant.teamName);
        if (new Set(teamNames).size !== teamNames.length)
            return res.status(400).json({ message: "participants must be unique" });

        if (await LeagueCup.exists({ season }))
            return res.status(409).json({ message: "League Cup for this season already exists" });

        const leagueCup = await new LeagueCup({ season, name, participants, rounds: [] }).save();
        return res.status(201).json({ leagueCup });
    } catch (error) {
        return res.status(500).json({ error });
    }
};

const readLeagueCup = (req: Request, res: Response, next: NextFunction) => {
    LeagueCup.findOne({ season: req.params.season })
        .lean()
        .then((leagueCup) => {
            if (leagueCup) return res.status(200).json({ leagueCup });

            return res.status(404).json({ message: "League Cup not found" });
        })
        .catch((error) => res.status(500).json({ error }));
};

// Die Begegnungen werden vom Admin manuell festgelegt, hier wird nur geprueft,
// dass jedes verbleibende Team genau einmal spielt oder ein Freilos hat.
const addNextRound = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leagueCupId = req.params.leagueCupId;
        const leagueCup = await LeagueCup.findById(leagueCupId);
        if (!leagueCup)
            return res.status(404).json({ message: "League Cup not found" });

        const roundIndex = leagueCup.rounds.length;
        let remainingTeams: string[];

        if (roundIndex === 0) {
            remainingTeams = leagueCup.participants.map(participant => participant.teamName);
        } else {
            const lastRound = leagueCup.rounds[roundIndex - 1];
            const roundGames = await LeagueGame.find({ cupId: leagueCupId, cupRound: roundIndex - 1 }).lean() as unknown as CupGame[];
            const winners = lastRound.pairings.map(pairing => getPairingWinner(pairing, roundGames, lastRound.bestOf));

            if (winners.some(winner => !winner))
                return res.status(400).json({ message: "Not all pairings of the last round have a winner" });

            remainingTeams = [...(winners as string[]), ...lastRound.byes];
        }

        if (remainingTeams.length < 2)
            return res.status(400).json({ message: "League Cup is already finished" });

        const byeCount = getByeCount(remainingTeams.length);
        const byes: string[] = Array.isArray(req.body.byes) ? req.body.byes : [];

        if (byes.length !== byeCount || new Set(byes).size !== byes.length || byes.some(bye => !remainingTeams.includes(bye)))
            return res.status(400).json({ message: `Exactly ${byeCount} byes from the remaining teams are required` });

        const playingTeams = remainingTeams.filter(team => !byes.includes(team));
        const pairings: CupPairing[] = (Array.isArray(req.body.pairings) ? req.body.pairings : [])
            .map((pairing: CupPairing) => ({ team1: pairing?.team1, team2: pairing?.team2 }));
        const pairedTeams = pairings.flatMap(pairing => [pairing.team1, pairing.team2]);

        if (pairings.length !== playingTeams.length / 2 || new Set(pairedTeams).size !== pairedTeams.length || pairedTeams.some(team => !playingTeams.includes(team)))
            return res.status(400).json({ message: "Every remaining team without bye must be paired exactly once" });

        const round = {
            name: getRoundName(remainingTeams.length, roundIndex),
            bestOf: remainingTeams.length === 2 ? 3 : 1,
            createdTime: new Date().getTime(),
            pairings,
            byes
        };

        // $size-Guard: wurde die Runde parallel schon angelegt, schlaegt das Update fehl statt sie doppelt anzulegen.
        const updatedLeagueCup = await LeagueCup.findOneAndUpdate(
            { _id: leagueCupId, rounds: { $size: roundIndex } },
            { $push: { rounds: round } },
            { new: true }
        );

        if (!updatedLeagueCup)
            return res.status(409).json({ message: "Round was already created" });

        return res.status(201).json({ leagueCup: updatedLeagueCup });
    } catch (error) {
        return res.status(500).json({ error });
    }
};

const undoLastRound = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const leagueCupId = req.params.leagueCupId;
        const leagueCup = await LeagueCup.findById(leagueCupId);
        if (!leagueCup)
            return res.status(404).json({ message: "League Cup not found" });

        const roundCount = leagueCup.rounds.length;
        if (roundCount === 0)
            return res.status(400).json({ message: "No round created yet" });

        if (await LeagueGame.exists({ cupId: leagueCupId, cupRound: roundCount - 1 }))
            return res.status(409).json({ message: "Round already has games" });

        const updatedLeagueCup = await LeagueCup.findOneAndUpdate(
            { _id: leagueCupId, rounds: { $size: roundCount } },
            { $pop: { rounds: 1 } },
            { new: true }
        );

        if (!updatedLeagueCup)
            return res.status(409).json({ message: "League Cup was changed in the meantime" });

        return res.status(200).json({ leagueCup: updatedLeagueCup });
    } catch (error) {
        return res.status(500).json({ error });
    }
};

// Cup aendern (z.B. Teamname in Teilnehmern, Paarungen, Freilosen), wie /leagueGames/update.
const updateLeagueCup = (req: Request, res: Response, next: NextFunction) => {
    LeagueCup.findById(req.params.leagueCupId)
        .then((leagueCup) => {
            if (!leagueCup)
                return res.status(404).json({ message: "League Cup not found" });

            leagueCup.set(req.body);
            return leagueCup
                .save()
                .then((leagueCup) => res.status(201).json({ leagueCup }))
                .catch((error) => res.status(500).json({ error }));
        })
        .catch((error) => res.status(500).json({ error }));
};

const deleteLeagueCup = (req: Request, res: Response, next: NextFunction) => {
    LeagueCup.findOneAndDelete({ _id: req.params.leagueCupId, rounds: { $size: 0 } })
        .then((leagueCup) => {
            if (leagueCup) return res.status(200).json({ message: "League Cup deleted" });

            return res.status(409).json({ message: "League Cup not found or already started" });
        })
        .catch((error) => res.status(500).json({ error }));
};

export default { createLeagueCup, readLeagueCup, addNextRound, undoLastRound, updateLeagueCup, deleteLeagueCup };
