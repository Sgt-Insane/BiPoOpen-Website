import { Request, Response, NextFunction } from 'express';
import PlayerImage from '../models/PlayerImage';

const IMAGE_DATA_PATTERN = /^data:image\/(png|jpeg|webp|jpg);base64,/;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB in characters (base64)

const upsertPlayerImage = (req: Request, res: Response, next: NextFunction) => {
    const { playerName, imageData } = req.body;

    if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
        res.status(400).json({ message: 'playerName is required' });
        return;
    }

    if (!imageData || typeof imageData !== 'string') {
        res.status(400).json({ message: 'imageData is required' });
        return;
    }

    if (!IMAGE_DATA_PATTERN.test(imageData)) {
        res.status(400).json({ message: 'imageData must be a valid base64 image (png, jpeg, or webp)' });
        return;
    }

    if (imageData.length > MAX_IMAGE_SIZE) {
        res.status(400).json({ message: 'Image too large. Maximum size is ~2MB.' });
        return;
    }

    PlayerImage.findOneAndUpdate(
        { playerName: playerName.trim() },
        { playerName: playerName.trim(), imageData },
        { upsert: true, new: true, runValidators: true }
    )
        .then((playerImage) => res.status(200).json({ playerName: playerImage.playerName }))
        .catch((error) => res.status(500).json({ error }));
};

const getPlayerImage = (req: Request, res: Response, next: NextFunction) => {
    const { playerName } = req.params;

    if (!playerName) {
        res.status(400).json({ message: 'playerName parameter is required' });
        return;
    }

    PlayerImage.findOne({ playerName: decodeURIComponent(playerName) })
        .then((playerImage) => {
            if (!playerImage) {
                res.status(200).json({ playerName: decodeURIComponent(playerName), imageData: null });
                return;
            }
            res.status(200).json({ playerName: playerImage.playerName, imageData: playerImage.imageData });
        })
        .catch((error) => res.status(500).json({ error }));
};

// Alle Spieler mit Bild und Stand des Bildes, ohne die Bilddaten. Das Frontend baut daraus
// versionierte Bild-URLs (?v=), die der Browser dauerhaft cachen darf.
const listPlayerImages = (req: Request, res: Response, next: NextFunction) => {
    PlayerImage.find({}, 'playerName updatedAt')
        .lean()
        .then((playerImages) => {
            res.setHeader('Cache-Control', 'no-cache');
            res.status(200).json(
                playerImages.map((playerImage: any) => ({
                    playerName: playerImage.playerName,
                    // Aeltere Eintraege ohne Zeitstempel: Erstellzeit aus der ObjectId
                    updatedAt: new Date(playerImage.updatedAt ?? playerImage._id.getTimestamp()).getTime()
                }))
            );
        })
        .catch((error) => res.status(500).json({ error }));
};

// Das Bild selbst als Datei. Die URL traegt die Version (?v=updatedAt), ein neues Bild hat also eine neue URL.
const getRawPlayerImage = (req: Request, res: Response, next: NextFunction) => {
    const { playerName } = req.params;

    PlayerImage.findOne({ playerName: decodeURIComponent(playerName) }, 'imageData')
        .lean()
        .then((playerImage) => {
            // imageData ist eine Data-URL: "data:image/png;base64,<daten>"
            const imageData = String(playerImage?.imageData ?? '');
            const prefix = imageData.match(/^data:(image\/[a-z]+);base64,/);
            if (!prefix) {
                res.status(404).json({ message: 'No image found for this player' });
                return;
            }
            res.setHeader('Content-Type', prefix[1]);
            res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
            res.status(200).send(Buffer.from(imageData.slice(prefix[0].length), 'base64'));
        })
        .catch((error) => res.status(500).json({ error }));
};

const deletePlayerImage =(req: Request, res: Response, next: NextFunction) => {
    const { playerName } = req.params;

    if (!playerName) {
        res.status(400).json({ message: 'playerName parameter is required' });
        return;
    }

    PlayerImage.findOneAndDelete({ playerName: decodeURIComponent(playerName) })
        .then((playerImage) => {
            if (!playerImage) {
                res.status(404).json({ message: 'No image found for this player' });
                return;
            }
            res.status(200).json({ message: 'Image deleted', playerName: playerImage.playerName });
        })
        .catch((error) => res.status(500).json({ error }));
};

export default { upsertPlayerImage, getPlayerImage, listPlayerImages, getRawPlayerImage, deletePlayerImage };
