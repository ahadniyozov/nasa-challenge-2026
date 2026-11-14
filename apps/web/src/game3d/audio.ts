// Sound effects synthesised with WebAudio: no audio files to download, works offline.
// Usage: sfx.photo(), sfx.hit() ... Mute / volume live in useSound and are saved in localStorage.
// The AudioContext is created lazily on the first sound (browsers allow audio only after a user gesture).
import { create } from 'zustand';

const KEY = 'sfx-v1';

function readSaved(): { muted: boolean; volume: number } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { muted?: unknown; volume?: unknown };
    return {
      muted: v.muted === true,
      volume: typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1 ? v.volume : 0.7,
    };
  } catch {
    return { muted: false, volume: 0.7 };
  }
}

function save(muted: boolean, volume: number) {
  try { localStorage.setItem(KEY, JSON.stringify({ muted, volume })); } catch { /* private mode: setting lasts this visit only */ }
}

export const useSound = create<{ muted: boolean; volume: number; setMuted(m: boolean): void; setVolume(v: number): void }>((set, get) => ({
  ...readSaved(),
  setMuted: (muted) => { save(muted, get().volume); set({ muted }); applyVolume(muted, get().volume); },
  setVolume: (volume) => { save(get().muted, volume); set({ volume }); applyVolume(get().muted, volume); },
}));

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

function applyVolume(muted: boolean, volume: number) {
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
}

/** The audio graph, or null when muted / unsupported. */
function audio(): { ac: AudioContext; out: GainNode } | null {
  const { muted, volume } = useSound.getState();
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { ac: ctx, out: master! };
  } catch {
    return null;
  }
}

interface ToneOpts { type?: OscillatorType; vol?: number; slideTo?: number; delay?: number; attack?: number }

/** One note with a quick attack and exponential fade. */
function tone(freq: number, dur: number, o: ToneOpts = {}) {
  const a = audio();
  if (!a) return;
  const { ac, out } = a;
  const t0 = ac.currentTime + (o.delay ?? 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  const vol = o.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

interface NoiseOpts { vol?: number; filter?: BiquadFilterType; freq?: number; freqTo?: number; delay?: number; attack?: number }

/** Filtered white noise: explosions, rocket roar, static. */
function noise(dur: number, o: NoiseOpts = {}) {
  const a = audio();
  if (!a) return;
  const { ac, out } = a;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ac.currentTime + (o.delay ?? 0);
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = o.filter ?? 'lowpass';
  f.frequency.setValueAtTime(o.freq ?? 1200, t0);
  if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t0 + dur);
  const g = ac.createGain();
  const vol = o.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// throttle very frequent sounds (e.g. many photos in a row)
const lastAt: Record<string, number> = {};
function every(id: string, ms: number): boolean {
  const now = performance.now();
  if (now - (lastAt[id] ?? -1e9) < ms) return false;
  lastAt[id] = now;
  return true;
}

export const sfx = {
  /** interface button */
  click() { if (every('click', 40)) tone(900, 0.05, { type: 'triangle', vol: 0.12 }); },
  /** a target photographed / measured */
  photo() {
    if (!every('photo', 90)) return;
    noise(0.05, { filter: 'highpass', freq: 3000, vol: 0.18 });
    tone(1400, 0.09, { type: 'square', vol: 0.08, delay: 0.03 });
  },
  /** contact with a ground station begins */
  station() {
    if (!every('station', 400)) return;
    tone(1320, 0.08, { vol: 0.2 });
    tone(1760, 0.12, { vol: 0.2, delay: 0.1 });
  },
  /** solar storm warning: a rising siren */
  storm() {
    if (!every('storm', 1500)) return;
    for (let i = 0; i < 3; i++) tone(520, 0.28, { type: 'sawtooth', vol: 0.09, slideTo: 880, delay: i * 0.32 });
  },
  /** radiation crashed the computer */
  zap() {
    noise(0.5, { filter: 'bandpass', freq: 2500, freqTo: 400, vol: 0.3 });
    tone(220, 0.5, { type: 'square', vol: 0.1, slideTo: 60 });
  },
  /** space junk hit */
  hit() {
    noise(0.35, { freq: 900, freqTo: 120, vol: 0.45 });
    tone(140, 0.3, { type: 'triangle', vol: 0.3, slideTo: 50 });
  },
  /** battery went flat */
  powerDown() { tone(600, 0.6, { type: 'triangle', vol: 0.2, slideTo: 90 }); },
  /** one countdown beep; last = true for the final, higher beep */
  countdown(last = false) { tone(last ? 1320 : 880, last ? 0.35 : 0.15, { type: 'square', vol: 0.12 }); },
  /** rocket engine roar at lift-off (about 4 s) */
  liftoff() {
    noise(4.2, { freq: 300, freqTo: 1400, vol: 0.5, attack: 0.25 });
    noise(4.2, { freq: 90, vol: 0.4, attack: 0.15 });
  },
  /** stage or fairing separation: a short pyrotechnic bang */
  separation() {
    noise(0.25, { filter: 'bandpass', freq: 1800, freqTo: 300, vol: 0.35 });
    tone(110, 0.2, { type: 'triangle', vol: 0.2, slideTo: 60 });
  },
  /** satellite released into orbit: a soft two-note chime */
  released() {
    tone(784, 0.25, { type: 'sine', vol: 0.18 });
    tone(1175, 0.4, { type: 'sine', vol: 0.16, delay: 0.14 });
  },
  /** mission accomplished: rising major arpeggio */
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.22, delay: i * 0.12 })); },
  /** mission failed: falling notes */
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.2, delay: i * 0.18 })); },
};

/** Plays sfx.click() for every button press in the app (touch-control buttons in flight are skipped). */
export function installClickSound() {
  const onDown = (e: PointerEvent) => {
    const el = e.target as Element | null;
    const btn = el?.closest?.('button');
    if (btn && !btn.disabled && !btn.closest('.g2d-touch')) sfx.click();
  };
  window.addEventListener('pointerdown', onDown, { capture: true });
  return () => window.removeEventListener('pointerdown', onDown, { capture: true });
}
