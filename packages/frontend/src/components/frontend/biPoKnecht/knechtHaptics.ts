import { ref } from 'vue';

// Vibration als Rueckmeldung beim Eintragen. Staerke ueber die Dauer (die Web-API kennt keine Intensitaet):
// Tisch am deutlichsten, Kante als Doppel-Puls, Treffer kurz, Airball kaum spuerbar.
// iPhones (Safari) unterstuetzen keine Vibration fuer Webseiten, dort passiert einfach nichts.

const STORAGE_KEY = 'bipo_knecht_vibration';

// Unter ca. 30 ms setzen viele Android-Motoren (z.B. Samsung) gar nicht an: alles deutlich darueber
export const HAPTICS = {
    hit: 45,
    edge: [50, 60, 50],
    table: 100,
    airball: 35,
} satisfies Record<string, number | number[]>;

export type HapticKind = keyof typeof HAPTICS;

const readEnabled = () => {
    try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { return true; }
};

export const vibrationEnabled = ref(readEnabled());

export const isVibrationSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const toggleVibration = () => {
    vibrationEnabled.value = !vibrationEnabled.value;
    try { localStorage.setItem(STORAGE_KEY, vibrationEnabled.value ? 'on' : 'off'); } catch { /* egal */ }
};

export const vibrate = (kind: HapticKind) => {
    if (!vibrationEnabled.value || !isVibrationSupported()) return;
    try { navigator.vibrate(HAPTICS[kind]); } catch { /* nicht erlaubt */ }
};
