import type { Directive } from 'vue';

// v-hint="'Text'": kurze Erklaerung zu einem Knopf, statt Erklaertext auf der Seite.
// Am PC beim Drueberfahren (title), auf dem Handy beim Gedrueckthalten (Blase ueber dem Knopf).
// Nach dem Gedrueckthalten loest der Knopf nicht aus, man wollte ja nur nachlesen.

const HOLD_MS = 450;
const SHOW_MS = 2200;

type HintElement = HTMLElement & {
    _hint?: { text: string; timer: ReturnType<typeof setTimeout> | null; held: boolean; cleanup: () => void };
};

const STYLE = `
.bp-hint-bubble{
    position: fixed;
    z-index: 3000;
    max-width: min(260px, calc(100vw - 16px));
    padding: 7px 11px;
    border-radius: 10px;
    background: #1F2328;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    box-shadow: 0 6px 18px rgba(0, 0, 0, .25);
    pointer-events: none;
    animation: bp-hint-in .15s ease-out;
}
@keyframes bp-hint-in{ from{ opacity: 0; transform: translateY(4px); } }
`;
const ensureStyle = () => {
    if (document.getElementById('bp-hint-style')) return;
    const style = document.createElement('style');
    style.id = 'bp-hint-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
};

let bubble: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

const hideBubble = () => {
    bubble?.remove();
    bubble = null;
};

const showBubble = (target: HTMLElement, text: string) => {
    ensureStyle();
    hideBubble();
    const el = document.createElement('div');
    el.className = 'bp-hint-bubble';
    el.setAttribute('role', 'tooltip');
    el.textContent = text;
    document.body.appendChild(el);
    const rect = target.getBoundingClientRect();
    const width = el.offsetWidth;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    const above = rect.top - el.offsetHeight - 8;
    el.style.left = `${left}px`;
    el.style.top = `${above > 8 ? above : rect.bottom + 8}px`;
    bubble = el;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBubble, SHOW_MS);
};

const setup = (el: HintElement, text: string) => {
    el.title = text;
    if (!el.getAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', text);

    const state = { text, timer: null as ReturnType<typeof setTimeout> | null, held: false, cleanup: () => {} };
    const start = (event: PointerEvent) => {
        if (event.pointerType === 'mouse') return;
        state.held = false;
        state.timer = setTimeout(() => {
            state.held = true;
            navigator.vibrate?.(15);
            showBubble(el, state.text);
        }, HOLD_MS);
    };
    const cancel = () => {
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
    };
    // Nach dem Gedrueckthalten den Klick verschlucken
    const click = (event: MouseEvent) => {
        if (!state.held) return;
        state.held = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const menu = (event: Event) => { if (state.held || state.timer) event.preventDefault(); };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('click', click, true);
    el.addEventListener('contextmenu', menu);
    state.cleanup = () => {
        cancel();
        el.removeEventListener('pointerdown', start);
        el.removeEventListener('pointerup', cancel);
        el.removeEventListener('pointerleave', cancel);
        el.removeEventListener('pointercancel', cancel);
        el.removeEventListener('click', click, true);
        el.removeEventListener('contextmenu', menu);
    };
    el._hint = state;
};

export const hintDirective: Directive<HintElement, string> = {
    mounted: (el, binding) => setup(el, binding.value),
    updated: (el, binding) => {
        if (!el._hint) return setup(el, binding.value);
        el._hint.text = binding.value;
        el.title = binding.value;
    },
    beforeUnmount: (el) => {
        el._hint?.cleanup();
        hideBubble();
    },
};
