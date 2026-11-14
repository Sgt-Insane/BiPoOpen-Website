import { onMounted, onUnmounted, ref, type Ref } from 'vue';

// Seiten tauschen durch Drehen: liegt das Handy flach auf dem Tisch und wird um etwa 180 Grad gedreht,
// tauschen die Seiten. Viele drehen das Handy ohnehin, wenn ihr Team auf der falschen Seite angezeigt wird.
// Genutzt wird nur die Aenderung des Kompasswinkels (alpha), nicht die absolute Richtung.

const FLAT_TILT = 30;           // Grad: so flach muss das Handy liegen
const TURN_ANGLE = 140;         // Grad: ab dieser Drehung gilt es als umgedreht
const HOLD_MS = 450;            // so lange muss es umgedreht liegen (kein Wackeln)

type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

// iPhones fragen einmal nach Erlaubnis, das geht nur direkt nach einem Tipp (z.B. "Spiel starten")
export const requestRotationPermission = () => {
    const request = (window.DeviceOrientationEvent as unknown as OrientationPermission | undefined)?.requestPermission;
    request?.().catch(() => {});
};

const angleDifference = (a: number, b: number) => {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
};

export const useTableRotation = (enabled: Ref<boolean>, onTurn: () => void) => {
    // erst true, wenn das Handy wirklich Lagedaten liefert (sonst bleibt der Knopf "Seiten tauschen")
    const supported = ref(false);
    let reference: number | null = null;
    let turnedSince: number | null = null;

    const onOrientation = (event: DeviceOrientationEvent) => {
        if (event.alpha === null || event.beta === null || event.gamma === null) return;
        supported.value = true;
        const flat = Math.abs(event.beta) < FLAT_TILT && Math.abs(event.gamma) < FLAT_TILT;
        if (!enabled.value || !flat) {
            turnedSince = null;
            if (!enabled.value) reference = null;
            return;
        }
        if (reference === null) { reference = event.alpha; return; }

        if (angleDifference(event.alpha, reference) < TURN_ANGLE) {
            turnedSince = null;
            return;
        }
        const now = Date.now();
        turnedSince ??= now;
        if (now - turnedSince >= HOLD_MS) {
            reference = event.alpha;
            turnedSince = null;
            onTurn();
        }
    };

    onMounted(() => window.addEventListener('deviceorientation', onOrientation));
    onUnmounted(() => window.removeEventListener('deviceorientation', onOrientation));

    return { supported };
};
