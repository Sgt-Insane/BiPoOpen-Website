import type { Directive } from 'vue';

// v-fit-text: einzeiliger Text wird so weit verkleinert, bis er in die Breite passt (statt … oder Umbruch).
// Ausgangsgroesse ist die font-size aus dem CSS, kleiner als MIN_FONT_PX wird es nicht (dann greift das … im CSS).
// Das Element braucht eine begrenzte Breite (z.B. flex: 1; min-width: 0), white-space: nowrap und overflow: hidden.
//
// v-fit-text="group": alle Elemente einer Gruppe bekommen dieselbe Groesse, die des laengsten Textes
// (z.B. beide Teamnamen eines Spiels). Ohne Gruppe passt sich jedes Element fuer sich an.
const MIN_FONT_PX = 10;
const STEP_PX = 0.5;

export type FitTextGroup = { elements: Set<HTMLElement>; scheduled: boolean };

export const createFitTextGroup = (): FitTextGroup => ({ elements: new Set(), scheduled: false });

// Groesse, bei der der Text passt, null = passt in der CSS-Groesse. Laesst das Element in dieser Groesse zurueck.
const getFittingSize = (el: HTMLElement): number | null => {
    el.style.fontSize = '';
    const available = el.clientWidth;
    if (!available || el.scrollWidth <= available) return null;

    // Textbreite waechst etwa proportional zur Schrift: erst hochrechnen, dann in kleinen Schritten nachkorrigieren
    const baseSize = parseFloat(getComputedStyle(el).fontSize);
    let size = Math.max(MIN_FONT_PX, Math.floor(baseSize * available / el.scrollWidth / STEP_PX) * STEP_PX);
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > MIN_FONT_PX) {
        size = Math.max(MIN_FONT_PX, size - STEP_PX);
        el.style.fontSize = `${size}px`;
    }
    return size;
};

const fitGroup = (group: FitTextGroup) => {
    const elements = [...group.elements];
    const sizes = elements.map(getFittingSize).filter((size): size is number => size !== null);
    const fontSize = sizes.length ? `${Math.min(...sizes)}px` : '';
    elements.forEach(el => el.style.fontSize = fontSize);
};

// Mehrere Ausloeser (Resize beider Namen, Update) in einem Durchgang, noch vor dem Zeichnen
const scheduleFit = (group: FitTextGroup) => {
    if (group.scheduled) return;
    group.scheduled = true;
    queueMicrotask(() => {
        group.scheduled = false;
        fitGroup(group);
    });
};

const bindings = new WeakMap<HTMLElement, { group: FitTextGroup; observer: ResizeObserver }>();

export const vFitText: Directive<HTMLElement, FitTextGroup | undefined> = {
    mounted(el, { value }) {
        const group = value ?? createFitTextGroup();
        group.elements.add(el);
        const observer = new ResizeObserver(() => scheduleFit(group));
        observer.observe(el);
        bindings.set(el, { group, observer });
        scheduleFit(group);
        // Nach dem Laden der Webfont aendert sich die Textbreite
        document.fonts?.ready.then(() => scheduleFit(group));
    },
    updated(el) {
        const binding = bindings.get(el);
        if (binding) scheduleFit(binding.group);
    },
    beforeUnmount(el) {
        const binding = bindings.get(el);
        if (!binding) return;
        binding.observer.disconnect();
        binding.group.elements.delete(el);
        bindings.delete(el);
        scheduleFit(binding.group);
    },
};
