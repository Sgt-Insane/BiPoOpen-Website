import { onUnmounted, watchEffect } from 'vue';

// Jede Seite meldet sich einzeln an: beim Seitenwechsel wird die alte Seite
// erst nach dem Mount der neuen abgebaut und darf ihr die Klasse nicht wegnehmen.
const grayPages = new Set<symbol>();

const updateClass = () => {
    document.documentElement.classList.toggle('bp-gray-page', grayPages.size > 0);
}

// Seiten mit Reitern: ganzer Seitengrund grau, inkl. Footer.
// isGray: optional reaktive Bedingung, z.B. nicht im League Cup (der hat keine Reiter).
export function useGrayPage(isGray: () => boolean = () => true) {
    const page = Symbol();

    watchEffect(() => {
        if (isGray())
            grayPages.add(page);
        else
            grayPages.delete(page);
        updateClass();
    });

    onUnmounted(() => {
        grayPages.delete(page);
        updateClass();
    });
}
