import type { Directive } from 'vue';
import { useGlossary } from '@/components/shared/useGlossary';

// v-hint="'Text'": kurze Erklaerung zu einem Knopf oder Wert, statt Erklaertext auf der Seite.
// Gleiche Blase wie die Fachbegriffe (GlossaryPopover), damit alle Hinweise der App gleich aussehen:
// - PC: beim Drueberfahren
// - Handy, Knoepfe (v-hint): Gedrueckthalten; der Knopf loest danach nicht aus, man wollte ja nur nachlesen
// - Handy, Werte und Symbole ohne eigene Aktion (v-hint.tap): Antippen, nochmal antippen schliesst

const HOLD_MS = 450;
const HOVER_MS = 350;
const SHOW_MS = 2600;

type HintState = { text: string; tap: boolean; cleanup: () => void };
type HintElement = HTMLElement & { _hint?: HintState };

const { openText, close, active } = useGlossary();
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const show = (el: HTMLElement, text: string, autoHide: boolean, toggle = false) => {
    openText(text, el, toggle);
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = autoHide ? setTimeout(() => { if (active.value?.text === text) close(); }, SHOW_MS) : null;
};
const hide = (text: string) => { if (active.value?.text === text) close(); };

const setup = (el: HintElement, text: string, tap: boolean) => {
    el.classList.add('bp-hint');
    el.removeAttribute('title');
    if (!el.getAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', text);

    const state: HintState = { text, tap, cleanup: () => {} };
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    let held = false;

    const cancelHold = () => {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
    };
    const down = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' || state.tap) return;
        held = false;
        holdTimer = setTimeout(() => {
            held = true;
            navigator.vibrate?.(15);
            show(el, state.text, true);
        }, HOLD_MS);
    };
    const enter = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        hoverTimer = setTimeout(() => show(el, state.text, false), HOVER_MS);
    };
    const leave = (event: PointerEvent) => {
        cancelHold();
        if (event.pointerType !== 'mouse') return;
        if (hoverTimer) clearTimeout(hoverTimer);
        hide(state.text);
    };
    const click = (event: MouseEvent) => {
        // Gedrueckt gehalten: Klick verschlucken
        if (held) {
            held = false;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (state.tap) show(el, state.text, false, true);
    };
    const menu = (event: Event) => { if (held || holdTimer) event.preventDefault(); };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', cancelHold);
    el.addEventListener('pointercancel', cancelHold);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('click', click, true);
    el.addEventListener('contextmenu', menu);
    state.cleanup = () => {
        cancelHold();
        if (hoverTimer) clearTimeout(hoverTimer);
        hide(state.text);
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointerup', cancelHold);
        el.removeEventListener('pointercancel', cancelHold);
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
        el.removeEventListener('click', click, true);
        el.removeEventListener('contextmenu', menu);
    };
    el._hint = state;
};

export const hintDirective: Directive<HintElement, string | undefined> = {
    mounted: (el, binding) => { if (binding.value) setup(el, binding.value, !!binding.modifiers.tap); },
    updated: (el, binding) => {
        if (!binding.value) {
            el._hint?.cleanup();
            delete el._hint;
            return;
        }
        if (!el._hint) return setup(el, binding.value, !!binding.modifiers.tap);
        if (active.value?.text === el._hint.text) active.value = { ...active.value, text: binding.value };
        el._hint.text = binding.value;
    },
    beforeUnmount: (el) => el._hint?.cleanup(),
};
