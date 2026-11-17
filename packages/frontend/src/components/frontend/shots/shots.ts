import axios from 'axios';
import { isDemoMode } from '@/util/demoGames';

// Offene Shots (je 3 Airballs eines Teams trinkt jede Person einen Shot). Im Knecht mit "Später" vertagt,
// auf der Seite "Offene Shots" abgehakt. Im Demo-Modus (lokaler Entwicklungsserver) nur im Browser.

export type Shot = {
    _id: string;
    name: string;
    teamName?: string;
    opponentName?: string;
    reason: 'airball';
    gameTime?: number;
    createdAt: number;
    drunkAt: number | null;
};

export type NewShot = Pick<Shot, 'name' | 'teamName' | 'opponentName' | 'gameTime'>;

const DEMO_KEY = 'bipo_demo_shots';

const loadDemo = (): Shot[] => {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY) ?? '[]') as Shot[]; } catch { return []; }
};
const saveDemo = (shots: Shot[]) => {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(shots)); } catch { /* egal */ }
};

export const getShots = async (): Promise<Shot[]> => {
    if (isDemoMode) return loadDemo();
    const response = await axios.get('/shots/get');
    return response.status === 200 ? response.data.shots as Shot[] : [];
};

export const addShots = async (shots: NewShot[]): Promise<boolean> => {
    if (!shots.length) return true;
    if (isDemoMode) {
        const now = Date.now();
        saveDemo([...loadDemo(), ...shots.map((shot, index) => ({ ...shot, _id: `demo-${now}-${index}`, reason: 'airball' as const, createdAt: now, drunkAt: null }))]);
        return true;
    }
    try {
        const response = await axios.post('/shots/create', { shots });
        return response.status === 201;
    } catch {
        return false;
    }
};

export const setShotDrunk = async (shot: Shot, drunk: boolean): Promise<boolean> => {
    if (isDemoMode) {
        saveDemo(loadDemo().map(entry => entry._id === shot._id ? { ...entry, drunkAt: drunk ? Date.now() : null } : entry));
        return true;
    }
    try {
        const response = await axios.patch(`/shots/drink/${shot._id}`, { drunk });
        return response.status === 200;
    } catch {
        return false;
    }
};
