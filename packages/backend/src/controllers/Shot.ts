import { Request, Response } from "express";
import Shot from "../models/Shot";

const MAX_SHOTS_PER_REQUEST = 8;

const readAll = (req: Request, res: Response) => {
    Shot.find()
        .lean()
        .then((shots) => res.status(200).json({ shots }))
        .catch((error) => res.status(500).json({ error }));
};

// Mehrere Shots auf einmal (jede Person des Teams einer)
const createShots = (req: Request, res: Response) => {
    const list = Array.isArray(req.body?.shots) ? req.body.shots : [];
    if (!list.length || list.length > MAX_SHOTS_PER_REQUEST) return res.status(400).json({ message: 'invalid shots' });

    const now = Date.now();
    const shots = list
        .filter((shot: { name?: unknown }) => typeof shot?.name === 'string' && shot.name.trim())
        .map((shot: { name: string; teamName?: string; opponentName?: string; gameTime?: number }) => ({
            name: shot.name.trim().slice(0, 60),
            teamName: typeof shot.teamName === 'string' ? shot.teamName.slice(0, 80) : undefined,
            opponentName: typeof shot.opponentName === 'string' ? shot.opponentName.slice(0, 80) : undefined,
            gameTime: typeof shot.gameTime === 'number' ? shot.gameTime : undefined,
            reason: 'airball',
            createdAt: now,
            drunkAt: null,
        }));
    if (!shots.length) return res.status(400).json({ message: 'invalid shots' });

    Shot.insertMany(shots)
        .then((created) => res.status(201).json({ shots: created }))
        .catch((error) => res.status(500).json({ error }));
};

// Abhaken (drunk = true) oder zuruecknehmen (drunk = false)
const setDrunk = (req: Request, res: Response) => {
    const drunk = req.body?.drunk !== false;
    Shot.findByIdAndUpdate(req.params.shotId, { drunkAt: drunk ? Date.now() : null }, { new: true })
        .then((shot) => shot ? res.status(200).json({ shot }) : res.status(404).json({ message: 'not found' }))
        .catch((error) => res.status(500).json({ error }));
};

export default { readAll, createShots, setDrunk };
