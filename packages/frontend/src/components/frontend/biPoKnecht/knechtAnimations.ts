import { computed, ref } from 'vue';
import type { KnechtMode } from './useBiPoKnecht';

// Wie viele grosse Animationen der Knecht zeigt, getrennt je Modus und pro Geraet gespeichert:
// 'all' = bei jeder Aktion (auch Fehlwurf), 'special' = nur Bombe, Bouncer, Trickshot, Balls Back und Formationen, 'off' = keine.
// Standard: Spieler-Modus alle, Schiri-Modus nur besondere (der Schiri traegt schnell hintereinander ein).

export type AnimationLevel = 'all' | 'special' | 'off';

const DEFAULTS: Record<KnechtMode, AnimationLevel> = { player: 'all', referee: 'special' };
const storageKey = (mode: KnechtMode) => `bipo_knecht_animations_${mode}`;

const read = (mode: KnechtMode): AnimationLevel => {
    try {
        const stored = localStorage.getItem(storageKey(mode));
        return stored === 'all' || stored === 'special' || stored === 'off' ? stored : DEFAULTS[mode];
    } catch {
        return DEFAULTS[mode];
    }
};

const levels = ref<Record<KnechtMode, AnimationLevel>>({ player: read('player'), referee: read('referee') });

// Aktueller Modus des Knechts (setzt BiPoKnecht.vue)
export const animationMode = ref<KnechtMode>('player');

export const animationLevel = computed(() => levels.value[animationMode.value]);

// Aendert die Einstellung fuer den aktuellen Modus
export const setAnimationLevel = (level: AnimationLevel) => {
    levels.value = { ...levels.value, [animationMode.value]: level };
    try { localStorage.setItem(storageKey(animationMode.value), level); } catch { /* privater Modus */ }
};

export const ANIMATION_OPTIONS: { label: string; value: AnimationLevel }[] = [
    { label: 'Alle', value: 'all' },
    { label: 'Besondere', value: 'special' },
    { label: 'Aus', value: 'off' },
];
