'use client';

/**
 * Bruitages du duel, synthétisés avec WebAudio (aucun fichier son à héberger ni à licencier).
 * Un seul AudioContext, créé au premier son (après un geste de l'utilisateur, exigé par les
 * navigateurs).
 */
export type Sfx =
  | 'draw'
  | 'summon'
  | 'special'
  | 'set'
  | 'activate'
  | 'negate'
  | 'attack'
  | 'damage'
  | 'recover'
  | 'phase'
  | 'turn'
  | 'coin'
  | 'move'
  | 'win'
  | 'lose'
  | 'select';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    // Compresseur : les sons superposés ne saturent pas
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { ctx, out: master! };
}

export function setVolume(volume: number): void {
  const a = audio();
  if (a) a.out.gain.value = volume;
}

/** Note : oscillateur avec enveloppe (attaque courte, déclin exponentiel), glissando optionnel. */
function tone(
  freq: number,
  {
    at = 0,
    dur = 0.2,
    type = 'sine' as OscillatorType,
    gain = 0.3,
    to,
    attack = 0.005,
  }: {
    at?: number;
    dur?: number;
    type?: OscillatorType;
    gain?: number;
    to?: number;
    attack?: number;
  } = {},
): void {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  const env = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(a.out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Souffle filtré (whoosh, impact) : bruit blanc dans un passe-bande qui glisse. */
function noise({
  at = 0,
  dur = 0.3,
  from = 400,
  to = 3000,
  gain = 0.25,
  q = 1.2,
}: {
  at?: number;
  dur?: number;
  from?: number;
  to?: number;
  gain?: number;
  q?: number;
} = {}): void {
  const a = audio();
  if (!a) return;
  if (!noiseBuffer) {
    noiseBuffer = a.ctx.createBuffer(1, a.ctx.sampleRate, a.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = a.ctx.currentTime + at;
  const src = a.ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(env).connect(a.out);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const NOTE = (semitones: number) => 440 * 2 ** (semitones / 12);

/** Joue un bruitage. */
export function play(sfx: Sfx): void {
  switch (sfx) {
    case 'draw':
      noise({ dur: 0.12, from: 2500, to: 6000, gain: 0.12, q: 3 });
      tone(1400, { dur: 0.05, type: 'triangle', gain: 0.08 });
      break;
    case 'select':
      tone(880, { dur: 0.06, type: 'triangle', gain: 0.08 });
      break;
    case 'phase':
      tone(660, { dur: 0.08, type: 'triangle', gain: 0.07 });
      tone(990, { at: 0.05, dur: 0.1, type: 'triangle', gain: 0.05 });
      break;
    case 'set':
      noise({ dur: 0.15, from: 300, to: 120, gain: 0.25, q: 0.8 });
      tone(110, { dur: 0.15, gain: 0.25, to: 70 });
      break;
    case 'summon':
      noise({ dur: 0.35, from: 300, to: 4000, gain: 0.18 });
      tone(NOTE(3), { at: 0.2, dur: 0.35, type: 'triangle', gain: 0.18 });
      tone(NOTE(10), { at: 0.28, dur: 0.5, type: 'triangle', gain: 0.14 });
      break;
    case 'special':
      noise({ dur: 0.5, from: 200, to: 6000, gain: 0.22 });
      [0, 4, 7, 12].forEach((n, i) =>
        tone(NOTE(n + 3), { at: 0.25 + i * 0.07, dur: 0.6, type: 'triangle', gain: 0.13 }),
      );
      tone(NOTE(-21), { at: 0.25, dur: 0.8, type: 'sawtooth', gain: 0.05 });
      break;
    case 'activate':
      [0, 7, 12, 19].forEach((n, i) =>
        tone(NOTE(n + 12), { at: i * 0.045, dur: 0.25, type: 'sine', gain: 0.1 }),
      );
      noise({ dur: 0.3, from: 4000, to: 9000, gain: 0.06, q: 4 });
      break;
    case 'negate':
      tone(420, { dur: 0.45, type: 'sawtooth', gain: 0.12, to: 90 });
      noise({ dur: 0.3, from: 1200, to: 200, gain: 0.2 });
      break;
    case 'attack':
      noise({ dur: 0.28, from: 600, to: 5000, gain: 0.25 });
      noise({ at: 0.22, dur: 0.18, from: 800, to: 150, gain: 0.35, q: 0.7 });
      tone(90, { at: 0.22, dur: 0.25, gain: 0.35, to: 45 });
      break;
    case 'damage':
      tone(70, { dur: 0.45, gain: 0.45, to: 35 });
      noise({ dur: 0.25, from: 500, to: 100, gain: 0.3, q: 0.6 });
      tone(NOTE(-2), { at: 0.05, dur: 0.4, type: 'square', gain: 0.05, to: NOTE(-14) });
      break;
    case 'recover':
      [0, 5, 9, 12].forEach((n, i) =>
        tone(NOTE(n), { at: i * 0.06, dur: 0.3, type: 'sine', gain: 0.12 }),
      );
      break;
    case 'move':
      noise({ dur: 0.22, from: 3000, to: 400, gain: 0.12 });
      break;
    case 'coin':
      tone(2100, { dur: 0.5, type: 'triangle', gain: 0.1 });
      tone(3150, { at: 0.03, dur: 0.4, type: 'sine', gain: 0.06 });
      break;
    case 'turn':
      [196, 392, 588].forEach((f, i) =>
        tone(f, { dur: 1.6 - i * 0.3, type: 'sine', gain: 0.18 / (i + 1), attack: 0.01 }),
      );
      noise({ dur: 0.4, from: 200, to: 2000, gain: 0.08 });
      break;
    case 'win':
      [0, 4, 7, 12, 16, 19, 24].forEach((n, i) =>
        tone(NOTE(n + 3), {
          at: i * 0.09,
          dur: i === 6 ? 1.4 : 0.35,
          type: 'triangle',
          gain: 0.14,
        }),
      );
      tone(NOTE(-9), { at: 0.54, dur: 1.4, type: 'sawtooth', gain: 0.05 });
      break;
    case 'lose':
      [0, -3, -7, -12].forEach((n, i) =>
        tone(NOTE(n - 5), { at: i * 0.22, dur: 0.6, type: 'triangle', gain: 0.12 }),
      );
      break;
  }
}
