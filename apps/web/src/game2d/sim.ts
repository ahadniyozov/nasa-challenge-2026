// Flight rules shared by the 2D and 3D flights: timers, battery, Earth's shadow, solar storms, spawning,
// photos, downlink, collisions and the end of the mission. No DOM, no drawing, no Math.random.
//
// Distances are in SECONDS of flight to the satellite (`ahead`): > 0 in front, < 0 behind. A renderer
// turns them into pixels (2D) or metres along the ground track (3D), so both flights play the same game.
// The simulation runs in fixed steps, so the same seed and the same input give the same flight
// on any screen and at any frame rate.
import { mulberry32 } from '@mission/engine';
import type { FlightParams } from './config';
import type { Mission } from './missions';

export interface FlightStats {
  delivered: number;
  captured: number;
  lostInMemory: number;
  survived: boolean;
  decayed: boolean;
  wornOut: boolean;
  hits: number;
  batteryOuts: number;
  memoryFull: number;
  nightMissed: number;
  blurry: number;
  outOfReach: number;
  stormHits: number;
  stormsSafe: number;
  stormsSurvived: number;
}

export type Lane = 0 | 1 | 2;
export interface SimInput { lane: Lane; safe: boolean }

export type SimObjectKind = 'target' | 'debris' | 'station';
export interface SimObject {
  id: number;
  kind: SimObjectKind;
  /** -1 = a target the orbit never flies over (north of the orbit's limit) */
  lane: -1 | Lane;
  /** seconds of flight until the satellite is over it: > 0 ahead, < 0 behind */
  ahead: number;
  /** a target already photographed / passed, or debris that already hit */
  done: boolean;
}

export type SimEventType =
  | 'photo' | 'hit' | 'memoryFull' | 'dark' | 'blurry' | 'asleep' | 'outOfReach'
  | 'stormWarn' | 'stormHit' | 'stormSafe' | 'stormSurvived'
  | 'batteryOut' | 'decay' | 'wornOut' | 'end';
/** `id` is the object that caused the event (photo, hit, ...), when there is one. */
export interface SimEvent { type: SimEventType; id?: number }

interface Storm { at: number; state: 0 | 1 | 2 | 3 } // 0 waiting, 1 warning, 2 raging, 3 over

/** Bookkeeping a renderer does not need. */
export interface SimInternal {
  rng: () => number;
  acc: number;
  nextId: number;
  nextTarget: number;
  nextDebris: number;
  asleepUntil: number;
  invulnUntil: number;
  stations: Set<string>;
  storms: Storm[];
}

export interface SimState {
  seed: number;
  p: FlightParams;
  m: Mission;
  /** seconds since launch */
  t: number;
  /** lane the player asked for */
  lane: Lane;
  /** where the satellite actually is across the lanes (0..2, eases towards `lane`) */
  laneY: number;
  safe: boolean;
  battery: number; // 0..100 %
  memory: number; // photos on board (fractional while sending)
  delivered: number; // photos on Earth (fractional while sending)
  hearts: number;
  shadow: boolean;
  contact: boolean;
  asleep: boolean;
  /** blinking after a hit: debris passes through */
  invulnerable: boolean;
  storm: 0 | 1 | 2; // 1 = warning, 2 = storm
  ended: boolean;
  objects: SimObject[];
  stats: FlightStats;
  /** what happened since the previous stepSim call */
  events: SimEvent[];
  _: SimInternal;
}

// ---- tuning (in seconds; matches the original 2D flight at a 720 px tall screen)
export const STEP = 1 / 120;
/** objects appear this far ahead (just off the top of the 2D screen) */
export const SPAWN_AHEAD = 1.9;
/** objects are dropped once this far behind */
export const DESPAWN_BEHIND = -1;
/** debris hits when it is this close and in the same lane */
export const HIT_WINDOW = 0.09;
/** the satellite talks to a station while it is this close */
export const CONTACT_WINDOW = 0.214;
/** |laneY - lane| below this counts as being in that lane */
export const LANE_TOLERANCE = 0.45;
export const STORM_WARN = 3;
export const STORM_LEN = 4.5;

export const flightDuration = (p: FlightParams) => p.orbitSec * p.orbits;
/** 0..1 position along the current orbit; the shadow is centred on 0.5 */
export const orbitPhase = (p: FlightParams, t: number) => (t / p.orbitSec) % 1;
export const inShadow = (p: FlightParams, t: number) => {
  const ph = orbitPhase(p, t);
  return ph > 0.5 - p.shadowFraction / 2 && ph < 0.5 + p.shadowFraction / 2;
};

export function createSim(p: FlightParams, m: Mission, seed: number = Math.floor(Math.random() * 2 ** 32)): SimState {
  const duration = flightDuration(p);
  return {
    seed, p, m, t: 0, lane: 1, laneY: 1, safe: false,
    battery: 100, memory: 0, delivered: 0, hearts: p.hearts,
    shadow: inShadow(p, 0), contact: false, asleep: false, invulnerable: false, storm: 0, ended: false,
    objects: [],
    stats: {
      delivered: 0, captured: 0, lostInMemory: 0, survived: true, decayed: false, wornOut: false, hits: 0, batteryOuts: 0,
      memoryFull: 0, nightMissed: 0, blurry: 0, outOfReach: 0, stormHits: 0, stormsSafe: 0, stormsSurvived: 0,
    },
    events: [],
    _: {
      rng: mulberry32(seed), acc: 0, nextId: 1, nextTarget: 1, nextDebris: 2.5, asleepUntil: 0, invulnUntil: 0,
      stations: new Set(),
      // storms spread over the mission, never in the first seconds
      storms: Array.from({ length: p.storms }, (_, i) => ({ at: duration * ((i + 0.55) / p.storms), state: 0 as const })),
    },
  };
}

/** Advances the flight by `dt` seconds of real time (mutates `s`). `s.events` lists what happened during this call. */
export function stepSim(s: SimState, dt: number, input: SimInput): void {
  s.events = [];
  s.lane = input.lane;
  s.safe = input.safe;
  if (s.ended) return;
  s._.acc += Math.min(Math.max(dt, 0), 0.25);
  while (s._.acc >= STEP && !s.ended) {
    s._.acc -= STEP;
    tick(s, STEP);
  }
}

function spawn(s: SimState, kind: SimObjectKind, lane: SimObject['lane'], ahead = SPAWN_AHEAD) {
  s.objects.push({ id: s._.nextId++, kind, lane, ahead, done: false });
}

function finish(s: SimState) {
  s.ended = true;
  s.contact = false;
  s.stats.delivered = Math.floor(s.delivered);
  s.stats.lostInMemory = Math.round(s.memory);
  s.events.push({ type: 'end' });
}

function tick(s: SimState, dt: number) {
  const { p, _: x } = s;
  const ev = (type: SimEventType, id?: number) => s.events.push(id === undefined ? { type } : { type, id });
  const duration = flightDuration(p);
  const endAt = p.orbitSec * p.orbitsBeforeDecay;

  s.t += dt;
  s.shadow = inShadow(p, s.t);
  const safe = s.safe;
  const asleep = s.t < x.asleepUntil || safe;
  s.asleep = asleep;
  s.invulnerable = s.t < x.invulnUntil;

  // ---- mission end: planned end, decay / wear-out, or destroyed
  if (s.t >= endAt && endAt < duration) {
    s.stats.survived = false;
    if (p.endReason === 'decay') { s.stats.decayed = true; ev('decay'); } else { s.stats.wornOut = true; ev('wornOut'); }
    return finish(s);
  }
  if (s.t >= duration) return finish(s);
  if (s.hearts <= 0) { s.stats.survived = false; return finish(s); }

  // ---- solar storms: warning → storm → over
  s.storm = 0;
  for (const st of x.storms) {
    if (st.state === 0 && s.t >= st.at - STORM_WARN) { st.state = 1; ev('stormWarn'); }
    if (st.state === 1 && s.t >= st.at) {
      st.state = 2;
      if (safe) { s.stats.stormsSafe++; ev('stormSafe'); }
      else if (p.radHard) { s.stats.stormsSurvived++; ev('stormSurvived'); }
      else { s.stats.stormHits++; s.hearts--; s.memory = 0; x.asleepUntil = s.t + 3; x.invulnUntil = s.t + 1.5; ev('stormHit'); }
    }
    if (st.state === 2 && s.t >= st.at + STORM_LEN) st.state = 3;
    if (st.state === 1 && s.storm === 0) s.storm = 1;
    if (st.state === 2) s.storm = 2;
  }

  // ---- battery (safe mode uses little power)
  if (s.shadow) s.battery -= p.shadowDrain * dt * (safe ? 0.4 : 1); else s.battery += p.sunCharge * dt;
  if (s.battery <= 0 && !asleep) { s.battery = 0; x.asleepUntil = s.t + 2.5; s.stats.batteryOuts++; ev('batteryOut'); }
  s.battery = Math.max(0, Math.min(100, s.battery));

  // ---- spawning: storms bring dense particle clouds on the space-weather mission
  if (s.t >= x.nextTarget) {
    spawn(s, 'target', p.reachesTargets ? (Math.floor(x.rng() * 3) as Lane) : -1);
    const gap = s.storm === 2 && s.m.targets.kind === 'particle' ? 0.45 : (1.8 + x.rng() * 1.2) / p.targetRate;
    x.nextTarget = s.t + gap;
  }
  if (s.t >= x.nextDebris) {
    spawn(s, 'debris', Math.floor(x.rng() * 3) as Lane);
    x.nextDebris = s.t + (1.6 + x.rng()) / p.debrisRate;
  }
  const orbit = Math.floor(s.t / p.orbitSec);
  const phase = orbitPhase(p, s.t);
  for (let i = 0; i < p.stationsPerOrbit; i++) {
    const at = (0.15 + i * (0.8 / Math.max(1, p.stationsPerOrbit))) % 1;
    const key = `${orbit}-${i}`;
    if (!x.stations.has(key) && phase >= at - SPAWN_AHEAD / p.orbitSec && phase < at) {
      x.stations.add(key);
      spawn(s, 'station', 1, (at - phase) * p.orbitSec);
    }
  }

  // ---- movement across the lanes (heavier satellites turn slower)
  s.laneY += (s.lane - s.laneY) * Math.min(1, dt * 10 * p.laneSpeed);

  // ---- objects
  let contact = p.alwaysInContact;
  for (const o of s.objects) {
    o.ahead -= dt;
    if (o.done) continue;
    const sameLane = Math.abs(o.lane - s.laneY) < LANE_TOLERANCE;
    if (o.kind === 'target' && o.ahead <= 0) {
      o.done = true;
      if (o.lane < 0) { s.stats.outOfReach++; ev('outOfReach', o.id); continue; }
      if (!sameLane) continue;
      if (s.shadow && !p.nightVision) { s.stats.nightMissed++; ev('dark', o.id); }
      else if (asleep) ev('asleep', o.id);
      else if (s.memory >= p.memory) { s.stats.memoryFull++; ev('memoryFull', o.id); }
      else if (!p.sharp) { s.stats.blurry++; ev('blurry', o.id); }
      else { s.memory++; s.stats.captured++; s.battery -= 2; ev('photo', o.id); }
    } else if (o.kind === 'debris' && Math.abs(o.ahead) < HIT_WINDOW && sameLane && s.t > x.invulnUntil) {
      o.done = true; s.hearts--; s.stats.hits++; x.invulnUntil = s.t + 1.2; s.memory = Math.max(0, s.memory - 1);
      ev('hit', o.id);
    } else if (o.kind === 'station' && Math.abs(o.ahead) < CONTACT_WINDOW) contact = true;
  }
  if (s.objects.some((o) => o.ahead < DESPAWN_BEHIND)) s.objects = s.objects.filter((o) => o.ahead >= DESPAWN_BEHIND);

  // ---- downlink
  s.contact = contact && !asleep;
  if (s.contact && s.memory > 0) {
    const sent = Math.min(s.memory, p.photosPerSec * dt);
    s.memory -= sent; s.delivered += sent; s.battery -= 3 * dt;
  }
}

// ---- a bot that plays well (tests, and the same rules as scripts/bot-2d.mjs)
/** Steers to the nearest reachable target ahead, dodging debris; safe mode during storms when `useSafe`. */
export function botInput(s: SimState, useSafe: boolean): SimInput {
  const ahead = s.objects.filter((o) => !o.done && o.ahead > -0.08).sort((a, b) => a.ahead - b.ahead);
  const tgt = ahead.find((o) => o.kind === 'target' && o.lane >= 0 && o.ahead < 1.67);
  const want: Lane = tgt && tgt.lane !== -1 ? tgt.lane : 1;
  const danger = (l: number) => ahead.some((o) => o.kind === 'debris' && o.lane === l && o.ahead < 0.53);
  // a lane is fine only if every lane on the way there is clear too
  const here = Math.round(s.laneY);
  const clearPath = (l: number) => {
    for (let k = Math.min(here, l); k <= Math.max(here, l); k++) if (k !== here && danger(k)) return false;
    return !danger(l);
  };
  const order = ([0, 1, 2] as Lane[]).sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || Math.abs(a - here) - Math.abs(b - here));
  const lane = order.find(clearPath) ?? (here as Lane);
  return { lane, safe: useSafe && s.storm >= 1 };
}

/** Plays a whole flight at a fixed frame rate (for tests and balance checks). */
export function runSim(p: FlightParams, m: Mission, seed: number, control: (s: SimState) => SimInput, fps = 60): SimState {
  const s = createSim(p, m, seed);
  let input: SimInput = { lane: 1, safe: false };
  for (let i = 0; i < 1e6 && !s.ended; i++) {
    input = control(s);
    stepSim(s, 1 / fps, input);
  }
  return s;
}
