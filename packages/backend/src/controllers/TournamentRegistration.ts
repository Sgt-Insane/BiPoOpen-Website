import { Request, Response, NextFunction } from 'express';
import TournamentRegistration from '../models/TournamentRegistration';

const IMAGE_DATA_PATTERN = /^data:image\/(png|jpeg|webp|jpg);base64,/;
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // base64 overhead ~33%, so 2MB file → ~2.7MB string

const createRegistration = (req: Request, res: Response, next: NextFunction) => {
    const { teamName, player1, player2, teamLogo } = req.body;

    if (!teamName || typeof teamName !== 'string' || teamName.trim().length === 0) {
        res.status(400).json({ message: 'teamName ist erforderlich' });
        return;
    }

    if (!player1 || typeof player1 !== 'string' || player1.trim().length === 0) {
        res.status(400).json({ message: 'player1 ist erforderlich' });
        return;
    }

    if (!player2 || typeof player2 !== 'string' || player2.trim().length === 0) {
        res.status(400).json({ message: 'player2 ist erforderlich' });
        return;
    }

    if (teamLogo) {
        if (typeof teamLogo !== 'string' || !IMAGE_DATA_PATTERN.test(teamLogo)) {
            res.status(400).json({ message: 'Teamlogo muss ein gültiges Base64-Bild sein (PNG, JPEG oder WebP)' });
            return;
        }
        if (teamLogo.length > MAX_IMAGE_SIZE) {
            res.status(400).json({ message: 'Teamlogo ist zu groß. Maximale Größe: ~2MB' });
            return;
        }
    }

    TournamentRegistration.findOne({ teamName: teamName.trim() })
        .then((existing) => {
            if (existing) {
                res.status(409).json({ message: 'Ein Team mit diesem Namen ist bereits angemeldet' });
                return;
            }

            const registration = new TournamentRegistration({
                teamName: teamName.trim(),
                player1: player1.trim(),
                player2: player2.trim(),
                teamLogo: teamLogo || undefined,
            });

            return registration.save().then((saved) => {
                res.status(201).json({ message: 'Anmeldung erfolgreich', teamName: saved.teamName });
            });
        })
        .catch((error) => res.status(500).json({ error }));
};

const getAllRegistrations = (req: Request, res: Response, next: NextFunction) => {
    TournamentRegistration.find()
        .sort({ createdAt: -1 })
        .then((registrations) => res.status(200).json({ registrations }))
        .catch((error) => res.status(500).json({ error }));
};

const updateRegistration = (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { teamName, player1, player2, teamLogo } = req.body;

    if (!teamName || typeof teamName !== 'string' || teamName.trim().length === 0) {
        res.status(400).json({ message: 'teamName ist erforderlich' });
        return;
    }

    if (!player1 || typeof player1 !== 'string' || player1.trim().length === 0) {
        res.status(400).json({ message: 'player1 ist erforderlich' });
        return;
    }

    if (!player2 || typeof player2 !== 'string' || player2.trim().length === 0) {
        res.status(400).json({ message: 'player2 ist erforderlich' });
        return;
    }

    if (teamLogo) {
        if (typeof teamLogo !== 'string' || !IMAGE_DATA_PATTERN.test(teamLogo)) {
            res.status(400).json({ message: 'Teamlogo muss ein gültiges Base64-Bild sein (PNG, JPEG oder WebP)' });
            return;
        }
        if (teamLogo.length > MAX_IMAGE_SIZE) {
            res.status(400).json({ message: 'Teamlogo ist zu groß. Maximale Größe: ~2MB' });
            return;
        }
    }

    TournamentRegistration.findOne({ teamName: teamName.trim(), _id: { $ne: id } })
        .then((existing) => {
            if (existing) {
                res.status(409).json({ message: 'Ein Team mit diesem Namen ist bereits angemeldet' });
                return;
            }

            return TournamentRegistration.findByIdAndUpdate(
                id,
                {
                    teamName: teamName.trim(),
                    player1: player1.trim(),
                    player2: player2.trim(),
                    teamLogo: teamLogo || null,
                },
                { new: true }
            ).then((registration) => {
                if (!registration) {
                    res.status(404).json({ message: 'Anmeldung nicht gefunden' });
                    return;
                }
                res.status(200).json({ message: 'Anmeldung aktualisiert', registration });
            });
        })
        .catch((error) => res.status(500).json({ error }));
};

export default { createRegistration, getAllRegistrations, updateRegistration };
