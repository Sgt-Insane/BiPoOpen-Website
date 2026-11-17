import { onUnmounted, ref } from 'vue';

// "Handys aneinanderstossen": erkennt einen kurzen, harten Stoss ueber den Beschleunigungssensor.
// Web NFC oder Bluetooth koennen im Browser nicht Handy-zu-Handy (und auf dem iPhone gar nicht) -
// der Stoss klappt auf allen Handys. Welche zwei Handys zusammengehoeren, entscheidet der Server ueber die Zeit.

const THRESHOLD = 13;       // m/s², ohne Schwerkraft. Normales Halten/Gehen liegt deutlich darunter.
const COOLDOWN = 2000;      // ms bis zum naechsten Stoss

type PermissionRequest = () => Promise<'granted' | 'denied'>;

export const useBump = (onBump: () => void) => {
    const MotionEvent = typeof window !== 'undefined' ? (window as any).DeviceMotionEvent : undefined;
    const isSupported = !!MotionEvent;
    const needsPermission = typeof MotionEvent?.requestPermission === 'function';
    const isListening = ref(false);
    const denied = ref(false);
    const hasSensor = ref<boolean | null>(null);      // null = noch keine Messwerte

    let lastBump = 0;
    let gravity: [number, number, number] | null = null;

    const onMotion = (event: DeviceMotionEvent) => {
        let x: number | null | undefined, y: number | null | undefined, z: number | null | undefined;
        const linear = event.acceleration;
        if (linear && linear.x !== null && linear.x !== undefined) {
            ({ x, y, z } = linear);
        } else if (event.accelerationIncludingGravity?.x !== null && event.accelerationIncludingGravity?.x !== undefined) {
            // Schwerkraft per Tiefpass herausrechnen
            const raw = event.accelerationIncludingGravity;
            const values: [number, number, number] = [raw.x ?? 0, raw.y ?? 0, raw.z ?? 0];
            gravity = gravity ? gravity.map((value, index) => value * 0.85 + values[index] * 0.15) as [number, number, number] : values;
            [x, y, z] = values.map((value, index) => value - gravity![index]);
        } else {
            return;
        }
        hasSensor.value = true;

        const magnitude = Math.hypot(x ?? 0, y ?? 0, z ?? 0);
        const now = Date.now();
        if (magnitude >= THRESHOLD && now - lastBump > COOLDOWN) {
            lastBump = now;
            onBump();
        }
    };

    // Auf dem iPhone nur nach einem Antippen moeglich (requestPermission braucht eine Nutzeraktion)
    const start = async () => {
        if (!isSupported || isListening.value) return isListening.value;
        if (needsPermission) {
            try {
                const result = await (MotionEvent.requestPermission as PermissionRequest)();
                if (result !== 'granted') {
                    denied.value = true;
                    return false;
                }
            } catch {
                denied.value = true;
                return false;
            }
        }
        window.addEventListener('devicemotion', onMotion);
        isListening.value = true;
        // Desktop-Browser kennen das Event, liefern aber nie Werte
        setTimeout(() => { if (hasSensor.value === null) hasSensor.value = false; }, 1500);
        return true;
    };

    const stop = () => {
        window.removeEventListener('devicemotion', onMotion);
        isListening.value = false;
    };

    onUnmounted(stop);

    return { isSupported, needsPermission, isListening, denied, hasSensor, start, stop };
};
