import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import OpenGame from "../models/OpenGame";
import { cardTeam, describeResult, gamePlayerNames, notify, playerProfilePath, resultImageUrl } from "../util/notify";

const createOpenGame = (req: Request, res: Response, next: NextFunction) => {
    const { team1, team2, time, turns, endTime, referee } = req.body;

    const openGame = new OpenGame({
        _id: new mongoose.Types.ObjectId(),
        team1,
        team2,
        time,
        endTime,
        referee,
        turns: turns || [] // Falls noch keine Runden vorhanden sind
    });

    openGame
        .save()
        .then(async (openGame) => {
            // await, damit Vercel die Funktion nicht vor dem Versand einfriert
            const result = describeResult(openGame.team1, openGame.team2);
            await notify('openGames', {
                title: `🍺 ${result.title}`,
                body: result.isDraw ? 'Unentschieden · Offenes Spiel' : `gegen ${result.opponents} · Offenes Spiel`,
                url: '/',
                image: resultImageUrl(cardTeam(openGame.team1), cardTeam(openGame.team2), 'Offenes Spiel'),
                tag: `openGame-${openGame._id}`,
                actions: [
                    { action: 'game', title: 'Spiel ansehen', url: '/' },
                    { action: 'profile', title: `Profil von ${result.winnerName.split(' ')[0]}`, url: playerProfilePath(result.winnerName) }
                ]
            }, gamePlayerNames(openGame.team1, openGame.team2));

            res.status(201).json({ openGame });
        })
        .catch((error) => res.status(500).json({ error }));
};

const readOpenGame = (req: Request, res: Response, next: NextFunction) => {
    const openGameID = req.params.openGameID;

    OpenGame.findOne({ _id: openGameID })
        .then((openGame) => {
            if (openGame) {
                res.status(200).json({ openGame });
            } else {
                res.status(404).json({ message: "Open Game not found" });
            }
        })
        .catch((error) => {
            res.status(500).json({ error });
        });
};

const readAll = (req: Request, res: Response, next: NextFunction) => {
    // lean: reine Objekte statt Mongoose-Dokumente, deutlich schneller bei vielen Spielen
    OpenGame.find()
        .lean()
        .then((openGames) => {
            res.status(200).json({ openGames });
        })
        .catch((error) => {
            res.status(500).json({ error });
        });
};

const updateOpenGame = (req: Request, res: Response, next: NextFunction) => {
    const openGameId = req.params.openGameId;
    

    OpenGame.findById(openGameId)
        .then((openGame) => {
            if (openGame) {
                openGame.set(req.body);

                openGame
                    .save({ validateBeforeSave: false})
                    .then((openGame) => res.status(201).json({ openGame }))
                    .catch((error) => { console.log(error); res.status(500).json({ error }) });
            } else {
                res.status(404).json({ message: 'not found' });
            }
        })
        .catch((error) => res.status(500).json({ error }));
};

const deleteOpenGame = (req: Request, res: Response, next: NextFunction) => {
    const openGameId = req.params.openGameId;

    OpenGame.findByIdAndDelete(openGameId)
        .then((openGame) => {
            if (openGame) return res.status(200).json({ message: "Open Game deleted" });
            
            return res.status(404).json({ message: "Open Game not found" });
        })
        .catch((error) => {
            return res.status(500).json({ error });
        });
};

export default { createOpenGame, readOpenGame, readAll, updateOpenGame, deleteOpenGame };