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

// A single oscillator whose pitch sweeps from `from` to `to` Hz while its
// volume decays from `volume` to silence over `duration` seconds.
const sweep = (
  ctx: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  volume: number,
  duration: number,
  pitchRamp: 'linear' | 'exponential' = 'exponential',
) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const end = ctx.currentTime + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(from, ctx.currentTime);
  if (pitchRamp === 'linear') osc.frequency.linearRampToValueAtTime(to, end);
  else osc.frequency.exponentialRampToValueAtTime(to, end);

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, end);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(end);
};

export const useBiPoSound = () => {
  const toggleMute = () => {
    isMuted.value = !isMuted.value;
    localStorage.setItem('bipo_knecht_muted', String(isMuted.value));
  };

  /** Satte Becher-Resonanz bei Treffer */
  const playHit = () => {
    vibrate(35);
    const ctx = getAudioContext();
    if (ctx) sweep(ctx, 'triangle', 320, 140, 0.4, 0.12);
  };

  /** Dumpfer Ton bei Fehlwurf */
  const playMiss = () => {
    vibrate(60);
    const ctx = getAudioContext();
    if (ctx) sweep(ctx, 'sine', 130, 70, 0.3, 0.15, 'linear');
  };

  /** Zisch- und Sweep-Sound bei Airball */
  const playAirball = () => {
    vibrate([40, 30, 40]);
    const ctx = getAudioContext();
    if (ctx) sweep(ctx, 'sawtooth', 500, 80, 0.18, 0.22);
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

  /** Wuchtiger Bass-Boom bei Bombe */
  const playBomb = () => {
    vibrate([100, 50, 120]);
    const ctx = getAudioContext();
    if (ctx) sweep(ctx, 'square', 110, 30, 0.4, 0.35);
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

