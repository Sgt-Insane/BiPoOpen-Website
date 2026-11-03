import dotenv from "dotenv";

// loads environment variables from .env file into process.env. File should be in root directory of backend folder
dotenv.config();

const MONGO_USERNAME = process.env.MONGO_USERNAME || '';
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || '';
const MONGO_URL = `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@cluster0.wpwuaak.mongodb.net`;

const Server_PORT = Number(process.env.SERVER_PORT) || 8080;

export const config = {
    mongo: {
        url: MONGO_URL,
    },
    server: {
        port: Server_PORT,
    },
    vapid: {
        publicKey: process.env.VAPID_PUBLIC_KEY || '',
        privateKey: process.env.VAPID_PRIVATE_KEY || '',
        subject: process.env.VAPID_SUBJECT || '',
    },
}