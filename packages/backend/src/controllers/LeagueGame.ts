import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import LeagueGame from "../models/LeagueGame";
import { describeResult, gamePlayerNames, notify } from "../util/notify";

const createLeagueGame = (req: Request, res: Response, next: NextFunction) => {
    const { team1, team2, time, turns, endTime, season, league, cupId, cupRound } = req.body;

    const leagueGame = new LeagueGame({
        _id: new mongoose.Types.ObjectId(),
        team1,
        team2,
        time,
        endTime,
        season,
        league,
        cupId,
        cupRound,
        turns: turns || [] // Falls noch keine Runden vorhanden sind
    });

    leagueGame
        .save()
        .then(async (leagueGame) => {
            const result = describeResult(leagueGame.team1, leagueGame.team2, true);
            const seasonPath = leagueGame.season ? `/League/${leagueGame.season}` : '/League';
            const url = leagueGame.cupId ? `${seasonPath}/Pokal` : `${seasonPath}/${leagueGame.league ?? 1}`;
            await notify('leagueGames', {
                title: `🏆 ${result.title}`,
                body: leagueGame.cupId ? 'BiPo League Cup' : `${leagueGame.league ?? 1}. Liga · BiPo League`,
                url,
                tag: `leagueGame-${leagueGame._id}`,
                actions: [{ action: 'table', title: leagueGame.cupId ? 'Pokal ansehen' : 'Tabelle', url }]
            }, gamePlayerNames(leagueGame.team1, leagueGame.team2));

            res.status(201).json({ leagueGame });
        })
        .catch((error) => res.status(500).json({ error }));
};

const readAll = (req: Request, res: Response, next: NextFunction) => {
    // lean: reine Objekte statt Mongoose-Dokumente, deutlich schneller bei vielen Spielen
    LeagueGame.find()
        .lean()
        .then((leagueGames) => {
            res.status(200).json({ leagueGames });
        })
        .catch((error) => {
            res.status(500).json({ error });
        });
};

const updateLeagueGame = (req: Request, res: Response, next: NextFunction) => {
    const leagueGameId = req.params.leagueGameId;
    
    LeagueGame.findById(leagueGameId)
        .then((leagueGame) => {
            if (leagueGame) {
                leagueGame.set(req.body);

                leagueGame
                    .save()
                    .then((leagueGame) => res.status(201).json({ leagueGame }))
                    .catch((error) => res.status(500).json({ error }));
            } else {
                res.status(404).json({ message: 'not found' });
            }
        })
        .catch((error) => res.status(500).json({ error }));
};

const deleteLeagueGame = (req: Request, res: Response, next: NextFunction) => {
    const leagueGameId = req.params.leagueGameId;

    LeagueGame.findByIdAndDelete(leagueGameId)
        .then((leagueGame) => {
            if (leagueGame) return res.status(200).json({ message: "League Game deleted" });
            
            return res.status(404).json({ message: "League Game not found" });
        })
        .catch((error) => {
            return res.status(500).json({ error });
        });
};

export default { createLeagueGame, readAll, updateLeagueGame, deleteLeagueGame };