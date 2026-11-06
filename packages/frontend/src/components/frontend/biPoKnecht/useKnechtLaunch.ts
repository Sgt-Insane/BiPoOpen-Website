import router from '@/router.js';

// Uebergabe eines vorbereiteten Spiels (z.B. aus dem "Spiel eintragen"-Drawer) an den BiPo Knecht.
// Ueber sessionStorage statt Modul-Zustand: robust gegen doppelt geladene Module (HMR) und Neuladen.
const LAUNCH_KEY = 'bipo_knecht_launch';
const LAUNCH_EVENT = 'bipo-knecht-launch';

export const useKnechtLaunch = () => {
    const launchKnecht = (match: Match) => {
        sessionStorage.setItem(LAUNCH_KEY, JSON.stringify(match));
        if (router.currentRoute.value.name === 'BiPo-Knecht') window.dispatchEvent(new Event(LAUNCH_EVENT));
        else router.push('/Knecht');
    };

    const consumeLaunch = (): Match | null => {
        const raw = sessionStorage.getItem(LAUNCH_KEY);
        sessionStorage.removeItem(LAUNCH_KEY);
        try {
            return raw ? JSON.parse(raw) as Match : null;
        } catch {
            return null;
        }
    };

    const hasLaunch = () => sessionStorage.getItem(LAUNCH_KEY) !== null;

    // Knecht-Seite ist schon offen: neues Spiel direkt uebernehmen
    const onLaunch = (callback: () => void) => {
        window.addEventListener(LAUNCH_EVENT, callback);
        return () => window.removeEventListener(LAUNCH_EVENT, callback);
    };

    return { launchKnecht, consumeLaunch, hasLaunch, onLaunch };
};
