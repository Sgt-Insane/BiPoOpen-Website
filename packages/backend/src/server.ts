import express from 'express';
import mongoose from 'mongoose';
import { config } from './config/config';
import tournamentRoutes from './routes/Tournament';
import openGameRoutes from './routes/OpenGame';
import leagueGameRoutes from './routes/LeagueGame';
import leagueCupRoutes from './routes/LeagueCup';
import playerImageRoutes from './routes/PlayerImage';
import registrationRoutes from './routes/TournamentRegistration';
import pushRoutes from './routes/Push';

const router = express();

let mongoPromise: Promise<void> | null = null;

function connectToMongo() {
    if (!mongoPromise) {
        mongoPromise = mongoose.connect(config.mongo.url, { retryWrites: true, w: 'majority', dbName: "bipoopen", maxPoolSize: 10, serverSelectionTimeoutMS: 30000, socketTimeoutMS: 45000 })
            .then(() => {
                console.log('MongoDB connected');
            })
            .catch((err: unknown) => {
                mongoPromise = null;
                console.log('MongoDB connection error:', err);
                throw err;
            });
    }
    return mongoPromise;
}

// Middleware to ensure MongoDB is connected before handling requests
router.use(async (req, res, next) => {
    try {
        await connectToMongo();
        next();
    } catch (err) {
        res.status(500).json({ message: 'Database connection failed' });
    }
});

router.use((req, res, next) => {
    console.log(`Incomming - METHOD: [${req.method}] - URL: [${req.url}] - IP: [${req.socket.remoteAddress}]`);

    res.on('finish', () => {
        console.log(`Result - METHOD: [${req.method}] - URL: [${req.url}] - IP: [${req.socket.remoteAddress}] - STATUS: [${res.statusCode}]`);
    });

    next();
});

router.use(express.urlencoded({ extended: true }));
router.use(express.json({ limit: '5mb' }));

/** Rules of our API */
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Push-Endpoint');

    if (req.method == 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
        res.status(200).json({});
        return;
    }

    next();
});

// Routes
router.use('/tournaments', tournamentRoutes);
router.use('/openGames', openGameRoutes);
router.use('/leagueGames', leagueGameRoutes);
router.use('/leagueCups', leagueCupRoutes);
router.use('/playerImages', playerImageRoutes);
router.use('/registrations', registrationRoutes);
router.use('/push', pushRoutes);

// Error handling
router.use((req, res, next) => {
    const error = new Error('Not found');

    console.error(error);

    res.status(404).json({
        message: error.message
    });
});

// Start local dev server when not on Vercel
if (!process.env.VERCEL) {
    connectToMongo().then(() => {
        router.listen(config.server.port, () => {
            console.info(`Server is running on port ${config.server.port}`);
        });
    });
}

// Export for Vercel serverless
export default router;