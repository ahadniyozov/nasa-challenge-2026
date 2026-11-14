// Geometry of the 3D flight. The satellite stays near the origin and the world moves past it:
// the ground track is an arc of a circle (radius R, centre below the satellite), "ahead" is −z.
// An object `ahead` seconds away sits ahead × V units along that arc - the same seconds as in sim.ts.
import * as THREE from 'three';
import type { FlightParams } from '../../game2d/config';
import { orbitPhase } from '../../game2d/sim';

/** radius of the globe in low orbit (scene units) */
export const EARTH_R = 40;
/** distance between lanes */
export const GAP = 1.7;
/** height of the satellite, debris and the lane lines above the ground */
export const SAT_ALT = 1.5;
/** height of targets and stations */
export const GROUND_ALT = 0.15;
/** x of the red "your orbit never flies north of this line" (north is to the left, as in 2D) */
export const REACH_X = -GAP * 1.6;

export interface Track {
  /** geostationary: Earth far below and nearly still, the track almost straight */
  geo: boolean;
  /** radius of the ground-track arc */
  R: number;
  /** units per second of flight along the track */
  V: number;
  /** globe spin, radians per second */
  spin: number;
}

export function makeTrack(p: FlightParams): Track {
  const geo = p.alwaysInContact;
  const orbitSpin = (2 * Math.PI) / p.orbitSec;
  // in low orbit the globe turns exactly once per game orbit, so ground objects stay glued to the map
  return { geo, R: geo ? 600 : EARTH_R, V: orbitSpin * EARTH_R, spin: geo ? orbitSpin * 0.06 : orbitSpin };
}

export const laneX = (lane: number) => (lane < 0 ? -GAP * 2.3 : (lane - 1) * GAP);

/** Scene position of a point `ahead` seconds along the track, `x` across it, `alt` above the ground. */
export function trackPos(tr: Track, ahead: number, x: number, alt: number, out: THREE.Vector3): THREE.Vector3 {
  const phi = (ahead * tr.V) / tr.R;
  const r = tr.R + alt;
  return out.set(x, -tr.R + r * Math.cos(phi), -r * Math.sin(phi));
}

/** Rotation about x that lays an object along the track at that point (its z axis follows the arc). */
export const trackTilt = (tr: Track, ahead: number) => -(ahead * tr.V) / tr.R;

/**
 * Where the Sun is, as a 0..1 turn around the satellite. The ground under the satellite is dark for
 * 0.25 < ψ < 0.75, and the orbit phases of the sim's shadow are stretched onto that half, so the night
 * on the globe starts and ends exactly when SimState.shadow does.
 */
export function sunTurn(p: FlightParams, t: number): number {
  const f = Math.min(0.95, Math.max(0.01, p.shadowFraction));
  const a = 0.5 - f / 2, b = 0.5 + f / 2;
  const ph = orbitPhase(p, t);
  if (ph > a && ph < b) return 0.27 + ((ph - a) / f) * 0.46;
  const q = (ph - b + 1) % 1; // time since leaving the shadow
  return (0.73 + (q / (1 - f)) * 0.54) % 1;
}

/** Direction towards the Sun. At ψ = 0.25 the Sun is right behind the camera and night comes from the horizon ahead. */
export function sunDir(p: FlightParams, t: number, out: THREE.Vector3): THREE.Vector3 {
  const a = sunTurn(p, t) * Math.PI * 2;
  return out.set(0.18, Math.cos(a), Math.sin(a)).normalize();
}
