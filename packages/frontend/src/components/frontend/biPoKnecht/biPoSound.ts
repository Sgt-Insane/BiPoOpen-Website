import { ref } from 'vue';

const isMuted = ref(localStorage.getItem('bipo_knecht_muted') === 'true');

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (isMuted.value) return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
};

const vibrate = (pattern: number | number[]) => {
  if (isMuted.value) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore if vibration is blocked
  }
};

// ─── Bausteine (alles synthetisch, keine Audiodateien) ───
let noise: AudioBuffer | null = null;

const getNoise = (ctx: AudioContext) => {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
};

// Rauschen durch einen Bandpass; Frequenz und Lautstaerke folgen den angegebenen Kurven
const noiseBurst = (
  ctx: AudioContext,
  at: number,
  duration: number,
  volume: number,
  frequencies: number[],
  q = 1,
  attack = 0.002,
) => {
  const start = ctx.currentTime + at;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = getNoise(ctx);
  filter.type = 'bandpass';
  filter.Q.value = q;
  frequencies.forEach((frequency, i) =>
    filter.frequency[i === 0 ? 'setValueAtTime' : 'exponentialRampToValueAtTime'](frequency, start + duration * i / Math.max(1, frequencies.length - 1)));

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(start);
  source.stop(start + duration);
};

// Kurzer Ton, dessen Hoehe von `from` nach `to` gleitet
const tone = (ctx: AudioContext, at: number, from: number, to: number, volume: number, duration: number) => {
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
};

// Tischtennisball trifft auf eine harte Flaeche: heller, sehr kurzer Klick
const tock = (ctx: AudioContext, at: number, volume: number, pitch = 3200) => {
  tone(ctx, at, pitch, pitch * 0.85, volume * 0.6, 0.035);
  noiseBurst(ctx, at, 0.03, volume, [pitch * 1.3], 4, 0.001);
};

// Ball springt aus: die Abstaende und die Lautstaerke werden mit jedem Aufprall kleiner
const bounces = (ctx: AudioContext, at: number, volume: number, count: number) => {
  let time = at;
  let gap = 0.24;
  for (let i = 0; i < count; i++) {
    tock(ctx, time, volume * Math.pow(0.62, i), 3200 + i * 120);
    time += gap;
    gap *= 0.68;
  }
};

// Ball faellt ins Bier: aufsteigender "Plopp" (Luftblase) mit etwas Spritzer
const plop = (ctx: AudioContext, at: number, volume: number, pitch = 1) => {
  tone(ctx, at, 320 * pitch, 1100 * pitch, volume, 0.07);
  splash(ctx, at + 0.01, volume * 0.35, 0.12);
};

const splash = (ctx: AudioContext, at: number, volume: number, duration: number) =>
  noiseBurst(ctx, at, duration, volume, [1800, 900], 0.8, 0.005);

// Luftzug: Rauschen, das hoch- und wieder runterzieht
const whoosh = (ctx: AudioContext, at: number, duration: number, volume: number) =>
  noiseBurst(ctx, at, duration, volume, [500, 2600, 600], 1.2, duration * 0.4);

export const useBiPoSound = () => {
  const toggleMute = () => {
    isMuted.value = !isMuted.value;
    localStorage.setItem('bipo_knecht_muted', String(isMuted.value));
  };

  /** Ball plumpst in den Becher: leiser Rand-Klick, dann "Plopp" ins Bier */
  const playHit = () => {
    vibrate(35);
    const ctx = getAudioContext();
    if (!ctx) return;
    tock(ctx, 0, 0.25, 2600);
    plop(ctx, 0.05, 0.5);
  };

  /** Nullwurf: Ball tickt auf den Tisch und springt aus */
  const playMiss = () => {
    vibrate(60);
    const ctx = getAudioContext();
    if (!ctx) return;
    bounces(ctx, 0, 0.6, 5);
  };

  /** Airball: Ball zischt ueber den Tisch und springt weit hinten auf */
  const playAirball = () => {
    vibrate([40, 30, 40]);
    const ctx = getAudioContext();
    if (!ctx) return;
    whoosh(ctx, 0, 0.45, 0.35);
    bounces(ctx, 0.5, 0.18, 3);
  };

  /** Aufsteigende Fanfare bei On-Fire */
  const playFire = () => {
    vibrate([60, 50, 100]);
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.18);
    });
  };

  /** Bombe: zwei Baelle im selben Becher, ordentlicher Spritzer */
  const playBomb = () => {
    vibrate([100, 50, 120]);
    const ctx = getAudioContext();
    if (!ctx) return;
    plop(ctx, 0, 0.5);
    plop(ctx, 0.09, 0.55, 0.8);
    splash(ctx, 0.1, 0.5, 0.45);
  };

  return {
    isMuted,
    toggleMute,
    playHit,
    playMiss,
    playAirball,
    playFire,
    playBomb,
  };
};

