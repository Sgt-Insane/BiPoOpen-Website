import { ref } from 'vue';
import type { GlossaryKey } from './glossary';

// Eine Erklaerblase fuer die ganze App: Fachbegriffe (key) und Hinweise zu Knoepfen und Werten (text, v-hint)
export type GlossaryAnchor = { key?: GlossaryKey; text?: string; rect: { left: number; top: number; width: number; height: number } };

const active = ref<GlossaryAnchor | null>(null);

const isSameAnchor = (anchor: GlossaryAnchor, rect: DOMRect) =>
    Math.abs(anchor.rect.top - rect.top) < 2 && Math.abs(anchor.rect.left - rect.left) < 2;

export const useGlossary = () => {
    const open = (key: GlossaryKey, element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        // Gleiches Wort nochmal antippen schliesst die Blase
        if (active.value?.key === key && isSameAnchor(active.value, rect)) {
            active.value = null;
            return;
        }
        active.value = { key, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
    };
    // Kurzer Hinweis ohne Begriff (v-hint). toggle: nochmal antippen schliesst
    const openText = (text: string, element: HTMLElement, toggle = false) => {
        const rect = element.getBoundingClientRect();
        if (toggle && active.value?.text === text && isSameAnchor(active.value, rect)) {
            active.value = null;
            return;
        }
        active.value = { text, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
    };
    const close = () => { active.value = null; };
    return { active, open, openText, close };
};
