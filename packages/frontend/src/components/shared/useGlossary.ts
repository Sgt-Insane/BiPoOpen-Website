import { ref } from 'vue';
import type { GlossaryKey } from './glossary';

// Eine Erklaerblase fuer die ganze Seite: welches Wort ist offen und wo steht es?
export type GlossaryAnchor = { key: GlossaryKey; rect: { left: number; top: number; width: number; height: number } };

const active = ref<GlossaryAnchor | null>(null);

export const useGlossary = () => {
    const open = (key: GlossaryKey, element: HTMLElement) => {
        const { left, top, width, height } = element.getBoundingClientRect();
        // Gleiches Wort nochmal antippen schliesst die Blase
        if (active.value?.key === key && Math.abs(active.value.rect.top - top) < 2 && Math.abs(active.value.rect.left - left) < 2) {
            active.value = null;
            return;
        }
        active.value = { key, rect: { left, top, width, height } };
    };
    const close = () => { active.value = null; };
    return { active, open, close };
};
