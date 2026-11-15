import { ref } from 'vue';

// Wie viele grosse Animationen der Knecht zeigt (pro Geraet gespeichert):
// 'all' = auch bei jedem normalen Treffer, 'special' = nur besondere Momente (Bombe, On Fire ...), 'off' = keine.

export type AnimationLevel = 'all' | 'special' | 'off';

const STORAGE_KEY = 'bipo_knecht_animations';

const read = (): AnimationLevel => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'special' || stored === 'off' ? stored : 'all';
    } catch {
        return 'all';
    }
};

export const animationLevel = ref<AnimationLevel>(read());

export const setAnimationLevel = (level: AnimationLevel) => {
    animationLevel.value = level;
    try { localStorage.setItem(STORAGE_KEY, level); } catch { /* privater Modus */ }
};

export const ANIMATION_OPTIONS: { label: string; value: AnimationLevel }[] = [
    { label: 'Alle', value: 'all' },
    { label: 'Besondere', value: 'special' },
    { label: 'Aus', value: 'off' },
];
