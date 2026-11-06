// Bildschirm-Helfer fuer den BiPo Knecht: Vollbild, Bildschirm wach halten, Querformat (Schiedsrichter).
// Alles wird still ignoriert, wo der Browser es nicht unterstuetzt.

export const enterFullscreen = () => {
    if (import.meta.env.DEV || document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
};

export const exitFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
};

// Querformat sperren klappt nur im Vollbild (Android). Sonst dreht der Knecht das Feld selbst.
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

export const lockLandscape = () => {
    (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape').catch(() => {});
};

export const unlockOrientation = () => {
    try { screen.orientation?.unlock?.(); } catch { /* nicht unterstuetzt */ }
};

// Screen Wake Lock: der Browser gibt die Sperre frei, wenn der Tab im Hintergrund ist,
// deshalb wird sie beim Zurueckkehren erneut angefordert.
let wakeLock: WakeLockSentinel | null = null;
let wantWakeLock = false;

const acquireWakeLock = async () => {
    if (!('wakeLock' in navigator) || wakeLock) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {
        wakeLock = null;
    }
};

const onVisibilityChange = () => {
    if (wantWakeLock && document.visibilityState === 'visible') acquireWakeLock();
};

export const requestWakeLock = () => {
    wantWakeLock = true;
    document.addEventListener('visibilitychange', onVisibilityChange);
    acquireWakeLock();
};

export const releaseWakeLock = () => {
    wantWakeLock = false;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    wakeLock?.release();
    wakeLock = null;
};
