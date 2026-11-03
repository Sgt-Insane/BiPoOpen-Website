import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import LeagueGame from "../models/LeagueGame";
import { describeGame, gamePlayerNames, notify } from "../util/notify";

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
            await notify('leagueGames', {
                title: leagueGame.cupId ? 'Neues League-Cup-Spiel' : 'Neues League-Spiel',
                body: describeGame(leagueGame.team1, leagueGame.team2),
                url: leagueGame.season ? `/League/${leagueGame.season}` : '/League',
                tag: `leagueGame-${leagueGame._id}`
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