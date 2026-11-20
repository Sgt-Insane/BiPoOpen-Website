import { onUnmounted, ref } from 'vue';

// "Handys aneinanderstossen": erkennt einen kurzen, harten Stoss ueber den Beschleunigungssensor.
// Web NFC oder Bluetooth koennen im Browser nicht Handy-zu-Handy (und auf dem iPhone gar nicht) -
// der Stoss klappt auf allen Handys. Welche zwei Handys zusammengehoeren, entscheidet der Server ueber die Zeit.

// Ein Stoss ist sehr kurz, der Browser misst nur ca. 60x pro Sekunde: die Spitze wird oft gedaempft gemessen.
// Deshalb zaehlt entweder eine kraeftige Beschleunigung oder ein ploetzlicher Ruck (Aenderung zur letzten Messung).
// Fehlalarme sind harmlos: der Server verbindet nur zwei Stoesse, die innerhalb von 2 s ankommen.
// (Nutzertest S26 Ultra + S24: mit 13 m/s² wurde seitliches Anstossen meist nicht erkannt.)
const THRESHOLD = 8;        // m/s², ohne Schwerkraft
const JERK_THRESHOLD = 11;  // m/s² Unterschied zwischen zwei Messungen
const COOLDOWN = 1500;      // ms bis zum naechsten Stoss

// Bier im Becher: gedaempfte Feder, angetrieben von der seitlichen Beschleunigung.
// Beschleunigt das Handy nach rechts, bleibt das Bier zurueck (links), beim Aufprall schwappt es nach rechts.
const SLOSH_OMEGA = 2 * Math.PI * 1.4;   // Eigenfrequenz
const SLOSH_DAMPING = 0.22;
const SLOSH_GAIN = 9;

type PermissionRequest = () => Promise<'granted' | 'denied'>;

// iPhone: die Erlaubnis gibt es nur beim Antippen. "+ Spiel" → "Anstoßen" fragt deshalb schon dort (das Antippen
// ist die Bestaetigung), die Anstoss-Seite lauscht dann sofort.
// Eine laufende Anfrage wird geteilt (ein zweiter Aufruf ohne Antippen wuerde abgelehnt).
let permissionGranted = false;
let permissionRequest: Promise<boolean> | null = null;
const motionEvent = () => typeof window !== 'undefined' ? (window as any).DeviceMotionEvent : undefined;
export const requestBumpPermission = (): Promise<boolean> => {
    const MotionEvent = motionEvent();
    if (!MotionEvent) return Promise.resolve(false);
    if (typeof MotionEvent.requestPermission !== 'function' || permissionGranted) return Promise.resolve(true);
    permissionRequest ??= (MotionEvent.requestPermission as PermissionRequest)()
        .then(result => (permissionGranted = result === 'granted'))
        .catch(() => false)
        .finally(() => { permissionRequest = null; });
    return permissionRequest;
};

// Laeuft gerade die Anfrage vom Antippen (oder ist schon erlaubt)? null = nein, dann braucht es den eigenen Knopf
export const pendingBumpPermission = (): Promise<boolean> | null => permissionGranted ? Promise.resolve(true) : permissionRequest;

export const useBump = (onBump: () => void) => {
    const MotionEvent = motionEvent();
    const isSupported = !!MotionEvent;
    // Schon erlaubt (beim Antippen von "Anstoßen"): kein eigener Knopf mehr noetig
    const needsPermission = typeof MotionEvent?.requestPermission === 'function' && !permissionGranted;
    const isListening = ref(false);
    const denied = ref(false);
    const hasSensor = ref<boolean | null>(null);      // null = noch keine Messwerte
    const level = ref(0);                              // 0..1, Anzeige der Stossstaerke (1 = zaehlt)
    const detectedAt = ref(0);                         // Zeitpunkt des letzten erkannten Stosses
    const sway = ref(0);                               // -1..1, Bier schwappt nach links/rechts (Bildschirm)
    const direction = ref<1 | -1>(1);                  // Bewegungsrichtung beim letzten Stoss (1 = nach rechts)

    let lastBump = 0;
    let gravity: [number, number, number] | null = null;
    let previous: [number, number, number] | null = null;
    let swayVelocity = 0;
    let velocity = 0;                                  // grobe seitliche Geschwindigkeit, nur fuers Vorzeichen
    let lastTime = 0;

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

        const current: [number, number, number] = [x ?? 0, y ?? 0, z ?? 0];

        const time = performance.now();
        const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 0.016;
        lastTime = time;
        const lateral = Math.abs(current[0]) < 0.3 ? 0 : current[0];
        const velocityBefore = velocity;
        velocity = velocity * 0.9 + lateral * dt;
        swayVelocity += (-(SLOSH_OMEGA ** 2) * sway.value - 2 * SLOSH_DAMPING * SLOSH_OMEGA * swayVelocity - SLOSH_GAIN * lateral) * dt;
        sway.value = Math.max(-1.2, Math.min(1.2, sway.value + swayVelocity * dt));
        const magnitude = Math.hypot(...current);
        const jerk = previous ? Math.hypot(current[0] - previous[0], current[1] - previous[1], current[2] - previous[2]) : 0;
        previous = current;
        const strength = Math.max(magnitude / THRESHOLD, jerk / JERK_THRESHOLD);
        // Anzeige: springt hoch, faellt langsam ab
        level.value = Math.min(1, Math.max(strength, level.value * 0.9));
        const now = Date.now();
        if (strength >= 1 && now - lastBump > COOLDOWN) {
            lastBump = now;
            // Richtung vor dem Aufprall (der Aufprall selbst bremst in die Gegenrichtung)
            if (Math.abs(velocityBefore) > 0.005) direction.value = velocityBefore > 0 ? 1 : -1;
            else if (lateral) direction.value = lateral > 0 ? -1 : 1;
            detectedAt.value = now;
            navigator.vibrate?.(40);
            onBump();
        }
    };

    // Auf dem iPhone nur nach einem Antippen moeglich (requestPermission braucht eine Nutzeraktion)
    const start = async () => {
        if (!isSupported || isListening.value) return isListening.value;
        if (typeof MotionEvent.requestPermission === 'function' && !permissionGranted && !await requestBumpPermission()) {
            denied.value = true;
            return false;
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

    return { isSupported, needsPermission, isListening, denied, hasSensor, level, detectedAt, sway, direction, start, stop };
};
