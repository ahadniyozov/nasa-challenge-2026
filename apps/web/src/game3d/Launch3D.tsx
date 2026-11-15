// 3D launch, shot like a launch broadcast (same { build, mission, onDone } interface as Launch2D).
// Three shots, 9 s in all:
//   pad at dusk (0-4 s): a long-lens tracking camera far from the pad; ignition, the exhaust cloud rolling
//     out of the flame trench, lift-off past the tower and lightning masts, a smoke column left behind;
//   ascent (4-5.6 s): chase camera from below, the sky goes from dusk to black, the trail falls away;
//   orbit (5.6-9 s): over the real Earth (the same Blue Marble, clouds and glint as the flight) -
//     first stage separation, upper stage burn, fairing halves open, the satellite (SatelliteModel)
//     separates and unfolds its panels.
// Realism comes from the lens and the materials, not from effects: telephoto framing, haze, weathered
// skin textures with welds and soot, noisy volumetric-looking smoke, a turbulent white-hot plume.
// The overlay is a broadcast telemetry strip: mission clock, altitude, speed and the event timeline.
// The clock, altitude and speed are a plausible real flight profile squeezed into the 9 seconds.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useT } from '../i18n';
import type { Build } from '../game2d/config';
import { MISSIONS, type Mission } from '../game2d/missions';
import { SatelliteModel } from './SatelliteModel';
import { atmoFragment, atmoVertex, cloudFragment, earthFragment, earthVertex } from './flight/Earth';
import { sfx } from './audio';
import './launch3d.css';

interface RocketSpec { name: string; R: number; H1: number; H2: number; HF: number; fairingR: number; boosters: boolean; cluster: boolean; satScale: number }

const ROCKETS: Record<string, RocketSpec> = {
  rideshare: { name: 'Rideshare', R: 0.25, H1: 2.3, H2: 0.85, HF: 0.95, fairingR: 0.25, boosters: false, cluster: false, satScale: 0.3 },
  medium: { name: 'Medium', R: 0.32, H1: 3.1, H2: 1.05, HF: 1.25, fairingR: 0.37, boosters: false, cluster: true, satScale: 0.38 },
  heavy: { name: 'Heavy', R: 0.36, H1: 3.4, H2: 1.2, HF: 1.45, fairingR: 0.44, boosters: true, cluster: true, satScale: 0.44 },
};

const ORBIT_KM: Record<string, number> = { 'leo-400': 400, 'sso-550': 550, 'sso-800': 800, 'meo-8000': 8000, geo: 35786 };

// ---- timeline (seconds of the cinematic)
const T_IGNITE = 1.9;
const T_LIFTOFF = 2.4;
const T_ASCENT = 4.0; // cut to the chase camera
const T_ORBIT = 5.6; // cut to orbit
const T_STAGE = 6.0;
const T_VAC = 6.3;
const T_FAIRING = 6.9;
const T_SEP = 7.8;
const T_END = 9.0;

// ---- lenses: a long lens on the pad (that is what makes a launch look real and not like a model), wider later
const FOV: Record<Shot, number> = { pad: 15, ascent: 28, orbit: 36 };
const NEAR: Record<Shot, number> = { pad: 1, ascent: 0.3, orbit: 0.05 };
const PAD_CAM = 2.8; // the pad camera stands this much further away than a 40° lens would need

type Shot = 'pad' | 'ascent' | 'orbit';
export type LaunchEvent = 'liftoff' | 'stage' | 'fairing' | 'release';

const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const TEX = (f: string) => `${import.meta.env.BASE_URL}textures/${f}`;

/** The broadcast numbers: cinematic time -> real time after lift-off, altitude, speed. */
function telemetry(t: number, km: number) {
  const vOrbit = Math.sqrt(398600 / (6371 + km)) * 3600; // km/h
  const sepReal = km > 5000 ? 1920 : 560 + km * 0.25;
  // [cinematic s, real s after lift-off, altitude km, speed km/h]
  const keys: [number, number, number, number][] = [
    [T_LIFTOFF, 0, 0, 0],
    [T_ASCENT, 48, 9, 1650],
    [T_ORBIT, 125, 58, 5600],
    [T_STAGE, 156, 78, 7700],
    [T_FAIRING, 205, 112, 9100],
    [T_SEP, sepReal, km, vOrbit],
    [T_END, sepReal + 45, km, vOrbit],
  ];
  if (t < T_LIFTOFF) return { clock: -Math.ceil((T_LIFTOFF - t) / 0.8 - 1e-6), alt: 0, speed: 0 };
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, r0, a0, v0] = keys[i];
  const [t1, r1, a1, v1] = keys[i + 1];
  const u = clamp01((t - t0) / (t1 - t0));
  const ease = i === 0 ? u * u : u; // the climb starts slowly
  return { clock: r0 + (r1 - r0) * u, alt: a0 + (a1 - a0) * ease, speed: v0 + (v1 - v0) * ease };
}

function formatClock(s: number) {
  const sign = s < 0 ? 'T−' : 'T+';
  const a = Math.floor(Math.abs(s));
  const hh = Math.floor(a / 3600), mm = Math.floor((a % 3600) / 60), ss = a % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${sign}${p(hh)}:${p(mm)}:${p(ss)}`;
}

// ---- shaders
// The plume: turbulent rather than a smooth cone. The colours go above 1 so the core clips to white,
// like a camera overexposed by the flame; noise breaks up the edges and runs down the plume.
const plumeShader = {
  vertex: /* glsl */ `
    varying vec2 vUv; varying vec3 vN; varying vec3 vView;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragment: /* glsl */ `
    uniform float uTime; uniform float uI; uniform vec3 uA; uniform vec3 uB; uniform float uDiamonds;
    varying vec2 vUv; varying vec3 vN; varying vec3 vView;
    float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
    void main() {
      float t = 1.0 - vUv.y;                                   // 0 at the nozzle, 1 at the tail
      vec2 q = vec2(vUv.x * 9.0, t * 5.0 - uTime * 7.0);
      float turb = fbm(q) * 0.75 + fbm(q * 2.7 + 3.1) * 0.35;
      float flick = 0.9 + 0.1 * sin(uTime * 61.0 + t * 13.0);
      float diamonds = 1.0 - uDiamonds * 0.22 * (0.5 + 0.5 * cos(t * 38.0));
      float edge = pow(abs(dot(vN, vView)), 2.2);
      float body = pow(1.0 - t, 1.35) * smoothstep(0.0, 0.03, t + 0.01);
      float tail = smoothstep(1.0, 0.35, t + (turb - 0.5) * 0.55);  // the tail frays out, it does not end in a line
      float a = body * tail * (0.55 + 0.75 * turb) * flick * diamonds * edge * uI;
      vec3 c = mix(uA, uB, smoothstep(0.0, 0.55, t + (turb - 0.5) * 0.2));
      gl_FragColor = vec4(c * (0.75 + 0.5 * turb), a);
    }`,
};

const skyShader = {
  vertex: /* glsl */ `
    varying vec3 vDir;
    void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragment: /* glsl */ `
    uniform float uSpace; uniform vec3 uSun;
    varying vec3 vDir;
    float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      // dusk sky: hazy warm horizon, steel blue, deep zenith; a low sun behind thin haze
      vec3 horizon = vec3(0.93, 0.62, 0.42), mid = vec3(0.30, 0.42, 0.58), zen = vec3(0.06, 0.11, 0.22);
      vec3 col = mix(horizon, mid, smoothstep(-0.01, 0.22, h));
      col = mix(col, zen, smoothstep(0.22, 0.8, h));
      float sd = max(dot(d, normalize(uSun)), 0.0);
      col += vec3(1.0, 0.6, 0.32) * (pow(sd, 8.0) * 0.4 + pow(sd, 2000.0) * 0.8 + pow(sd, 200.0) * 0.15) * (1.0 - smoothstep(0.0, 0.45, h));
      col += vec3(1.0, 0.9, 0.75) * smoothstep(0.99995, 0.99999, sd);  // the sun's disc
      col = mix(col, vec3(0.86, 0.66, 0.52), exp(-abs(h) * 38.0) * 0.35); // haze band on the horizon
      col = mix(col, vec3(0.09, 0.085, 0.09), smoothstep(0.0, -0.06, h));
      // space: black, small dim stars (a camera exposed for a sunlit vehicle barely sees them)
      vec3 space = vec3(0.002, 0.004, 0.01);
      vec3 cell = floor(d * 520.0);
      float n = hash(cell);
      space += vec3(smoothstep(0.9985, 1.0, n) * (0.25 + 0.4 * hash(cell + 7.0)));
      gl_FragColor = vec4(mix(col, space, uSpace), 1.0);
    }`,
};

// ---- procedural textures (canvas, made once)
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void, seed: number, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, rng(seed));
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Rocket skin: off-white paint, panel seams, weld rings, a faint grain; the first stage also gets
 *  soot and engine streaks from the base up (the bottom of the canvas is the bottom of the cylinder). */
const skins = new Map<string, THREE.Texture>();
function rocketSkin(kind: 'stage1' | 'clean' | 'fairing') {
  const hit = skins.get(kind);
  if (hit) return hit;
  const t = canvasTex(512, 1024, (g, r) => {
    const W = 512, H = 1024;
    g.fillStyle = kind === 'fairing' ? '#eceeec' : '#e6e8e4';
    g.fillRect(0, 0, W, H);
    // large soft blotches: paint and light variation, so the cylinder is not one flat colour
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = r() * H, rad = 40 + r() * 120;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() > 0.5;
      gr.addColorStop(0, dark ? 'rgba(120,118,110,0.05)' : 'rgba(255,255,255,0.06)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 9000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(40,40,40,0.035)'; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
    // panel seams (vertical) and weld rings (horizontal), each a dark line with a light lip
    const seams = kind === 'fairing' ? 2 : 4;
    for (let k = 0; k < seams; k++) {
      const x = (k + 0.5) * W / seams;
      g.fillStyle = 'rgba(70,74,78,0.22)'; g.fillRect(x, 0, 1.6, H);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 1.6, 0, 1, H);
    }
    const rings = kind === 'fairing' ? 4 : 8;
    for (let k = 1; k < rings; k++) {
      const y = (k / rings) * H;
      g.fillStyle = 'rgba(70,74,78,0.25)'; g.fillRect(0, y, W, 2);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, y + 2, W, 1);
    }
    // small access hatches
    for (let i = 0; i < (kind === 'fairing' ? 3 : 6); i++) {
      const x = r() * (W - 30), y = 40 + r() * (H - 120);
      g.strokeStyle = 'rgba(70,74,78,0.3)'; g.lineWidth = 1.2; g.strokeRect(x, y, 14 + r() * 16, 10 + r() * 14);
    }
    if (kind === 'stage1') {
      // soot from the base up, with streaks dragged upwards by the airflow
      const sg = g.createLinearGradient(0, H, 0, H * 0.58);
      sg.addColorStop(0, 'rgba(38,32,27,0.92)');
      sg.addColorStop(0.18, 'rgba(52,44,37,0.6)');
      sg.addColorStop(0.55, 'rgba(80,70,60,0.18)');
      sg.addColorStop(1, 'rgba(80,70,60,0)');
      g.fillStyle = sg; g.fillRect(0, H * 0.58, W, H * 0.42);
      for (let i = 0; i < 160; i++) {
        const x = r() * W, len = H * (0.06 + r() * 0.36), w = 1 + r() * 5;
        const lg = g.createLinearGradient(0, H, 0, H - len);
        lg.addColorStop(0, `rgba(36,30,25,${0.25 + r() * 0.35})`);
        lg.addColorStop(1, 'rgba(36,30,25,0)');
        g.fillStyle = lg; g.fillRect(x, H - len, w, len);
      }
    }
  }, kind === 'stage1' ? 11 : kind === 'clean' ? 23 : 37);
  skins.set(kind, t);
  return t;
}

/** Smoke puffs: clumps of soft blobs with a darker, denser underside, masked to a round edge. */
const puffs: THREE.Texture[] = [];
function puffTextures() {
  if (puffs.length) return puffs;
  for (let v = 0; v < 4; v++) {
    puffs.push(canvasTex(128, 128, (g, r) => {
      for (let i = 0; i < 34; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 30;
        const x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d * 0.8, rad = 14 + r() * 22;
        const shade = 200 + Math.round((y - 34) * -0.9 + r() * 30); // brighter on top, greyer below
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(${shade},${shade},${shade},0.42)`);
        gr.addColorStop(0.6, `rgba(${shade},${shade},${shade},0.18)`);
        gr.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      }
      g.globalCompositeOperation = 'destination-in';
      const m = g.createRadialGradient(64, 64, 20, 64, 64, 64);
      m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = m; g.fillRect(0, 0, 128, 128);
    }, 101 + v * 17));
  }
  return puffs;
}

let glowTex: THREE.Texture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.15, 'rgba(255,255,255,0.6)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.14)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }, 1);
  return glowTex;
}

/** Ground textures: weathered concrete with expansion joints, and coastal scrub. */
function concreteTexture() {
  const t = canvasTex(512, 512, (g, r) => {
    g.fillStyle = '#8e8f8c'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 160; i++) {
      const x = r() * 512, y = r() * 512, rad = 10 + r() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() > 0.6 ? 'rgba(40,36,30,0.16)' : 'rgba(200,200,195,0.1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 14000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'; g.fillRect(r() * 512, r() * 512, 1.5, 1.5); }
    g.fillStyle = 'rgba(40,40,40,0.35)';
    for (let k = 0; k <= 4; k++) { g.fillRect(k * 128, 0, 2, 512); g.fillRect(0, k * 128, 512, 2); }
  }, 5);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function scrubTexture() {
  const t = canvasTex(512, 512, (g, r) => {
    g.fillStyle = '#4a4c39'; g.fillRect(0, 0, 512, 512);
    const tones = ['rgba(92,90,62,0.35)', 'rgba(56,64,42,0.4)', 'rgba(120,108,80,0.25)', 'rgba(36,40,30,0.35)'];
    for (let i = 0; i < 1400; i++) {
      const x = r() * 512, y = r() * 512, rad = 3 + r() * 16;
      g.fillStyle = tones[Math.floor(r() * tones.length)];
      g.beginPath(); g.ellipse(x, y, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 12000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,230,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(r() * 512, r() * 512, 1.5, 1.5); }
  }, 9);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function usePlumeMaterial(a: [number, number, number], b: [number, number, number], diamonds = 0) {
  return useMemo(() => new THREE.ShaderMaterial({
    vertexShader: plumeShader.vertex,
    fragmentShader: plumeShader.fragment,
    uniforms: {
      uTime: { value: 0 }, uI: { value: 0 }, uDiamonds: { value: diamonds },
      uA: { value: new THREE.Vector3(...a) }, uB: { value: new THREE.Vector3(...b) },
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), [a, b, diamonds]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Open cylinder hanging down from y = 0 (the nozzle exit), wider at the tail. */
function plumeGeometry(r: number, len: number, spread: number) {
  const g = new THREE.CylinderGeometry(r, r * spread, len, 32, 24, true);
  g.translate(0, -len / 2, 0);
  return g;
}

// ---------------------------------------------------------------------------
function Bell({ r, y = 0, x = 0, z = 0 }: { r: number; y?: number; x?: number; z?: number }) {
  return (
    <mesh position={[x, y - r * 0.55, z]}>
      <cylinderGeometry args={[r * 0.38, r, r * 1.1, 24, 1, true]} />
      <meshStandardMaterial color="#4a3f36" metalness={0.9} roughness={0.42} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** A straight cable between two points (lightning-mast catenaries; the sag is too small to see at this distance). */
function Wire({ a, b }: { a: [number, number, number]; b: [number, number, number] }) {
  const { pos, quat, len } = useMemo(() => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const d = B.clone().sub(A);
    return {
      pos: A.clone().add(B).multiplyScalar(0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()),
      len: d.length(),
    };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[0.012, 0.012, len, 4]} />
      <meshBasicMaterial color="#3a3d40" />
    </mesh>
  );
}

const DARK = { color: '#1b1f23', roughness: 0.55, metalness: 0.25 } as const;

// ---- the orbit Earth: the flight's shader (Blue Marble, clouds and their shadows, glint, haze), seen from ~150 km
const ER = 420; // scene units; the camera sits EH above it, so the horizon dips ~12° like from a low orbit
const EH = 9;
const SUN = new THREE.Vector3(10, 5, 7).normalize();

function OrbitEarth() {
  const [day, night, clouds, water] = useLoader(THREE.TextureLoader, [
    TEX('earth-day-4k.webp'), TEX('earth-night-4k.webp'), TEX('earth-clouds-4k.webp'), TEX('earth-water-2k.webp'),
  ]);
  const gl = useThree((st) => st.gl);
  day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
  for (const t of [day, night, clouds, water]) { t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy()); t.wrapS = THREE.RepeatWrapping; }
  const spin = useRef<THREE.Group>(null);
  // put the tropical Atlantic (lat 14°, lon −38°: open ocean, trade-wind cumulus) straight below the vehicle
  const q = useMemo(() => {
    const lat = 14 * Math.PI / 180, phi = (-38 + 180) * Math.PI / 180;
    const p = new THREE.Vector3(-Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat));
    return new THREE.Quaternion().setFromUnitVectors(p, new THREE.Vector3(0, 1, 0));
  }, []);
  const earthU = useMemo(() => ({
    dayMap: { value: day }, nightMap: { value: night }, cloudMap: { value: clouds }, waterMap: { value: water },
    sunDir: { value: SUN }, storm: { value: 0 }, cloudShift: { value: 0 },
  }), [day, night, clouds, water]);
  const cloudU = useMemo(() => ({ cloudMap: { value: clouds }, sunDir: { value: SUN }, cloudShift: earthU.cloudShift }), [clouds, earthU]);
  const atmoU = useMemo(() => ({ sunDir: { value: SUN } }), []);
  // the ground runs under the vehicle (it flies along +x, so the surface below moves to −x)
  useFrame((_, dt) => { if (spin.current) spin.current.rotation.z += Math.min(dt, 0.1) * 0.006; });
  return (
    <group position={[0, -ER - EH, 0]}>
      <group ref={spin}>
        <mesh quaternion={q}>
          <sphereGeometry args={[ER, 256, 160]} />
          <shaderMaterial uniforms={earthU} vertexShader={earthVertex} fragmentShader={earthFragment} />
        </mesh>
        <mesh quaternion={q} scale={1.0006}>
          <sphereGeometry args={[ER, 256, 160]} />
          <shaderMaterial uniforms={cloudU} vertexShader={earthVertex} fragmentShader={cloudFragment} transparent depthWrite={false} />
        </mesh>
      </group>
      <mesh scale={1.012}>
        <sphereGeometry args={[ER, 192, 96]} />
        <shaderMaterial uniforms={atmoU} vertexShader={atmoVertex} fragmentShader={atmoFragment} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A soft reflection environment so painted metal has something to reflect (no external HDR file). */
function useStudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [gl, scene]);
}

const N_CLOUD = 84; // the exhaust cloud out of the flame trench
const N_TRAIL = 110; // the smoke column the rocket leaves behind

function LaunchWorld({ build, mission, km, onEvent, onShot, onTick, onFinish }: {
  build: Build; mission: Mission; km: number;
  onEvent(e: LaunchEvent | null): void; onShot(s: Shot): void; onTick(t: number): void; onFinish(): void;
}) {
  const spec = ROCKETS[build.rocket] ?? ROCKETS.rideshare;
  const { R, H1, H2, HF, fairingR: RF } = spec;
  const { camera, scene } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const fog = useMemo(() => new THREE.Fog('#a58a7c', 70, 520), []);
  useStudioEnvironment();
  const gl = useThree((st) => st.gl);

  const elapsed = useRef(0);
  const finished = useRef(false);
  const lastEvent = useRef<LaunchEvent | null>(null);
  const lastShot = useRef<Shot | null>(null);

  const vehicle = useRef<THREE.Group>(null);
  const stage1 = useRef<THREE.Group>(null);
  const boosters = useRef<THREE.Group>(null);
  const stage2 = useRef<THREE.Group>(null);
  const fairL = useRef<THREE.Group>(null);
  const fairR = useRef<THREE.Group>(null);
  const sat = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const padWorld = useRef<THREE.Group>(null);
  const mastGroup = useRef<THREE.Group>(null);
  const orbitWorld = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);
  const engineLight = useRef<THREE.PointLight>(null);
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  const plume1 = useRef<THREE.Group>(null);
  const plumeB = useRef<THREE.Group>(null);
  const plume2 = useRef<THREE.Group>(null);
  const nozzleGlow = useRef<THREE.Sprite>(null);
  const flash = useRef<THREE.Sprite>(null);
  const cloudRefs = useRef<(THREE.Sprite | null)[]>([]);
  const trailRefs = useRef<(THREE.Sprite | null)[]>([]);

  const [deploy, setDeploy] = useState(0);
  const deployQ = useRef(0);

  // sea-level kerosene/methalox flame: white-hot core, yellow-orange body; vacuum flame: thin, pale blue-violet
  const mainMat = usePlumeMaterial([1.15, 0.92, 0.6], [0.85, 0.3, 0.06], 0.4);
  const coreMat = usePlumeMaterial([1.5, 1.35, 1.1], [0.9, 0.55, 0.22], 1);
  const vacMat = usePlumeMaterial([1.4, 1.5, 1.9], [0.32, 0.4, 0.9], 0);
  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: skyShader.vertex, fragmentShader: skyShader.fragment, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSpace: { value: 0 }, uSun: { value: new THREE.Vector3(-0.9, 0.06, -0.6) } },
  }), []);

  const skin1 = rocketSkin('stage1');
  const skin2 = rocketSkin('clean');
  const skinF = rocketSkin('fairing');
  const puffTex = puffTextures();
  const concrete = useMemo(() => { const t = concreteTexture(); t.repeat.set(3, 3); return t; }, []);
  const scrub = useMemo(() => { const t = scrubTexture(); t.repeat.set(70, 70); return t; }, []);
  const paint = { roughness: 0.48, metalness: 0.05, envMapIntensity: 0.5 } as const;

  const plumeLen = R * 10;
  const mainGeo = useMemo(() => plumeGeometry(R * (spec.cluster ? 0.8 : 0.44), plumeLen, 2.3), [R, spec.cluster, plumeLen]);
  const coreGeo = useMemo(() => plumeGeometry(R * (spec.cluster ? 0.5 : 0.3), plumeLen * 0.3, 0.9), [R, spec.cluster, plumeLen]);
  const vacGeo = useMemo(() => plumeGeometry(R * 0.5, R * 7, 3.6), [R]);
  const bR = R * 0.62;
  const bX = R + bR + 0.03;

  // the fairing: a cylinder and an ogive nose, built as two halves that split along x
  const fairPts = useMemo(() => {
    const pts = [new THREE.Vector2(R * 0.99, 0), new THREE.Vector2(RF, Math.max(0.04, (RF - R) * 1.6)), new THREE.Vector2(RF, HF * 0.42)];
    for (let i = 1; i <= 16; i++) {
      const u = i / 16;
      pts.push(new THREE.Vector2(Math.max(0.004, RF * Math.pow(1 - u * u, 0.62)), HF * 0.42 + u * HF * 0.58));
    }
    return pts;
  }, [R, RF, HF]);

  // exhaust cloud: billows out of both ends of the flame trench (along ±x), hugs the ground, keeps growing
  const cloudSeeds = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: N_CLOUD }, (_, i) => ({
      born: T_IGNITE + 0.05 + (i / N_CLOUD) * 2.4 + r() * 0.05,
      side: i % 2 ? 1 : -1,
      reach: 3.5 + r() * 7,
      rise: 0.15 + r() * 0.5,
      drift: (r() - 0.5) * 6,
      size: 2.2 + r() * 3.2,
      tone: 0.68 + r() * 0.26,
      rot: r() * Math.PI * 2,
      spin: (r() - 0.5) * 0.5,
      tex: Math.floor(r() * 4),
    }));
  }, []);
  // smoke column: one puff per slot, dropped at the plume tail when the slot's time comes, then left in the air
  const trailSeeds = useMemo(() => {
    const r = rng(91);
    return Array.from({ length: N_TRAIL }, (_, i) => ({
      born: T_LIFTOFF + 0.04 + i * ((T_ORBIT - T_LIFTOFF - 0.1) / N_TRAIL),
      jx: (r() - 0.5), jz: (r() - 0.5), tone: 0.74 + r() * 0.2, rot: r() * Math.PI * 2, spin: (r() - 0.5) * 0.4, tex: Math.floor(r() * 4),
    }));
  }, []);
  const trailPos = useMemo(() => trailSeeds.map(() => new THREE.Vector3()), [trailSeeds]);
  const trailSet = useRef<boolean[]>(trailSeeds.map(() => false));
  const prevNozzle = useMemo(() => new THREE.Vector3(), []);
  const curNozzle = useMemo(() => new THREE.Vector3(), []);
  const prevT = useRef(0);

  const total = H1 + H2 + HF;
  const towerH = total * 1.08;
  const mastH = total * 1.45;
  const masts: [number, number, number][] = useMemo(() => [[-7, 0, -6], [7.5, 0, -5], [0.5, 0, 8]], []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  // compile every shader and upload every texture up front (the orbit world is hidden until the cut,
  // and compiling it there would freeze the picture for a moment)
  useEffect(() => {
    const ow = orbitWorld.current;
    if (!ow) return;
    ow.visible = true;
    gl.compile(scene, camera);
    ow.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
      if (m?.uniforms) for (const u of Object.values(m.uniforms)) if (u.value instanceof THREE.Texture) gl.initTexture(u.value);
    });
    ow.visible = false;
  }, [gl, scene, camera]);

  useFrame((state, dtRaw) => {
    // the timeline follows the real clock, so the launch always ends after T_END s, even at a low frame rate
    elapsed.current += Math.min(dtRaw, 0.25);
    const t = elapsed.current;
    const time = state.clock.elapsedTime;
    onTick(t);
    if (t >= T_END) { if (!finished.current) { finished.current = true; onFinish(); } return; }

    const ev: LaunchEvent | null = t >= T_SEP ? 'release' : t >= T_FAIRING ? 'fairing' : t >= T_STAGE ? 'stage' : t >= T_LIFTOFF ? 'liftoff' : null;
    if (ev !== lastEvent.current) { lastEvent.current = ev; onEvent(ev); }
    const shot: Shot = t >= T_ORBIT ? 'orbit' : t >= T_ASCENT ? 'ascent' : 'pad';
    if (shot !== lastShot.current) {
      lastShot.current = shot; onShot(shot);
      cam.fov = FOV[shot]; cam.near = NEAR[shot]; cam.updateProjectionMatrix();
      scene.environmentIntensity = shot === 'orbit' ? 0.35 : 0.6;
    }

    const v = vehicle.current!;
    const fly = Math.max(0, t - T_LIFTOFF);
    const throttle = smooth(T_IGNITE, T_IGNITE + 0.45, t);
    for (const m of [mainMat, coreMat, vacMat]) m.uniforms.uTime.value = time;
    if (beacon.current) beacon.current.color.setScalar(Math.sin(time * 4) > 0.3 ? 1 : 0.15);

    padWorld.current!.visible = shot !== 'orbit';
    mastGroup.current!.visible = shot === 'pad'; // from under the climbing rocket the cables would cut across the frame
    orbitWorld.current!.visible = shot === 'orbit';
    sky.current!.position.copy(camera.position);
    scene.fog = shot === 'orbit' ? null : fog;

    if (shot !== 'orbit') {
      // ---- pad and ascent
      const space = shot === 'ascent' ? smooth(T_ASCENT, T_ORBIT, t) * 0.95 : 0;
      skyMat.uniforms.uSpace.value = space;
      fog.near = 70 + space * 400; fog.far = 520 + space * 900;
      const y = shot === 'pad' ? 0.35 + 1.25 * fly * fly : 0.35 + 1.25 * 1.6 * 1.6 + 40 * Math.pow(t - T_ASCENT, 2) + 4 * (t - T_ASCENT);
      v.position.set(0, y, 0);
      v.rotation.set(0, 0, shot === 'ascent' ? -0.18 * (t - T_ASCENT) : 0);
      stage1.current!.position.set(0, 0, 0);
      stage1.current!.rotation.set(0, 0, 0);
      stage1.current!.visible = true;
      if (boosters.current) boosters.current.visible = true;
      fairL.current!.rotation.set(0, 0, 0); fairR.current!.rotation.set(0, 0, 0);
      fairL.current!.position.set(RF, H1 + H2, 0); fairR.current!.position.set(-RF, H1 + H2, 0);
      fairL.current!.visible = fairR.current!.visible = true;
      sat.current!.position.set(0, H1 + H2 + HF * 0.3, 0);
      if (arm.current) arm.current.rotation.y = -smooth(1.2, 1.9, t) * 1.25;

      // plumes: grow at ignition, longer and wider as the air thins
      const stretch = 1 + fly * 0.3 + space * 1.6;
      plume1.current!.visible = throttle > 0;
      plume1.current!.scale.set(1 + space * 1.5, throttle * stretch * (t < T_LIFTOFF ? 0.5 : 1), 1 + space * 1.5);
      mainMat.uniforms.uI.value = throttle * (0.7 - space * 0.3);
      coreMat.uniforms.uI.value = throttle * 0.85;
      if (plumeB.current) { plumeB.current.visible = throttle > 0; plumeB.current.scale.copy(plume1.current!.scale); }
      plume2.current!.visible = false;
      nozzleGlow.current!.visible = throttle > 0;
      nozzleGlow.current!.scale.setScalar(R * (9 + Math.sin(time * 47) * 0.5 + Math.sin(time * 29) * 0.4) * throttle * (1 + space));
      (nozzleGlow.current!.material as THREE.SpriteMaterial).opacity = 0.85 - space * 0.4;
      // the ignition flash lights the whole cloud for a moment
      const fl = smooth(T_IGNITE, T_IGNITE + 0.2, t) * (1 - smooth(T_IGNITE + 0.3, T_LIFTOFF + 0.6, t));
      flash.current!.visible = shot === 'pad' && fl > 0.01;
      flash.current!.scale.setScalar(14 * fl + 4);
      (flash.current!.material as THREE.SpriteMaterial).opacity = fl * 0.55;
      if (engineLight.current) engineLight.current.intensity = shot === 'pad' ? throttle * (26 + Math.sin(time * 33) * 5 + Math.sin(time * 51) * 3) * (1 - smooth(1.2, 1.6, fly) * 0.6) : 0;
      if (engineLight.current) engineLight.current.position.set(0, Math.max(0.3, y - R * 2.5), 0.8);

      // the exhaust cloud out of the flame trench: fast at first, then it slows and keeps swelling
      cloudSeeds.forEach((s, i) => {
        const sp = cloudRefs.current[i];
        if (!sp) return;
        const age = t - s.born;
        sp.visible = shot === 'pad' && age > 0;
        if (!sp.visible) return;
        const k = 1 - Math.exp(-age * 1.1);
        const dist = 2.4 + s.reach * k;
        const sz = (0.9 + k * s.size) * (1 + age * 0.12);
        sp.position.set(s.side * dist, 0.3 + sz * 0.32 + s.rise * age * 0.8, s.drift * k);
        sp.scale.setScalar(sz);
        const mat = sp.material as THREE.SpriteMaterial;
        mat.rotation = s.rot + age * s.spin;
        mat.opacity = Math.min(1, age * 3.5) * 0.95;
        // lit orange from below by the flame while it is close to it
        const warm = throttle * Math.exp(-dist * 0.22) * (1 - smooth(0.8, 2.0, fly)) * 1.3;
        const g = s.tone;
        mat.color.setRGB(g + warm * 0.75, g * 0.97 + warm * 0.38, g * 0.93 + warm * 0.05);
      });

      // the smoke column: puffs dropped at the tail of the plume, interpolated between frames so it stays continuous
      v.localToWorld(curNozzle.set(0, -R * 0.55 - plumeLen * 0.55 * (1 + space), 0));
      if (prevT.current === 0) prevNozzle.copy(curNozzle);
      trailSeeds.forEach((s, i) => {
        const sp = trailRefs.current[i];
        if (!sp) return;
        const age = t - s.born;
        if (age < 0) { sp.visible = false; return; }
        if (!trailSet.current[i]) {
          const f = clamp01((s.born - prevT.current) / Math.max(1e-4, t - prevT.current));
          trailPos[i].lerpVectors(prevNozzle, curNozzle, f);
          trailSet.current[i] = true;
        }
        sp.visible = true;
        const thin = Math.min(1, trailPos[i].y / 60); // higher up the smoke is thinner and spreads less
        const sz = R * (3.2 + age * (7 - thin * 4));
        sp.position.set(trailPos[i].x + s.jx * sz * 0.25 + age * 0.35, trailPos[i].y + age * 0.15, trailPos[i].z + s.jz * sz * 0.25);
        sp.scale.setScalar(sz);
        const mat = sp.material as THREE.SpriteMaterial;
        mat.rotation = s.rot + age * s.spin;
        mat.opacity = Math.min(1, age * 10) * (0.92 - thin * 0.5) * (1 - smooth(3.5, 6, age));
        const warm = Math.exp(-age * 5) * 0.9 * (1 - space);
        const g = s.tone * (1 - space * 0.35);
        mat.color.setRGB(g + warm * 0.7, g + warm * 0.35, g * 0.96);
      });
      prevNozzle.copy(curNozzle);
      prevT.current = t;

      // camera
      if (shot === 'pad') {
        // a long lens a few hundred metres away: tracks the rocket up, shakes when the sound arrives
        const p = t / T_ASCENT;
        camera.position.set(
          THREE.MathUtils.lerp(9.5, 8.2, p) * PAD_CAM, THREE.MathUtils.lerp(1.2, 1.6, p), THREE.MathUtils.lerp(11, 9.8, p) * PAD_CAM,
        );
        look.set(0, Math.max(total * 0.5, y + total * 0.5 - 0.4), 0);
        const rumble = smooth(T_IGNITE + 0.25, T_LIFTOFF + 0.3, t) * (1 - smooth(1.0, 1.6, fly) * 0.6);
        look.x += (Math.sin(time * 37) + Math.sin(time * 23.3) * 0.7) * 0.022 * rumble;
        look.y += (Math.sin(time * 41.7) + Math.sin(time * 19.1) * 0.6) * 0.018 * rumble;
        camera.lookAt(look);
      } else {
        // chase camera from below and to the side, far enough for the whole rocket and its plume
        const k = total / 4.4 * 1.25;
        v.localToWorld(tmp.set(0, total * 0.15, 0));
        camera.position.set(tmp.x + 4.6 * k, tmp.y - 1.6 * k, tmp.z + 6.2 * k);
        camera.lookAt(tmp.x, tmp.y, tmp.z);
      }
      return;
    }

    // ---- orbit: the vehicle cruises along +x above the Earth, nose slightly up
    skyMat.uniforms.uSpace.value = 1;
    const to = t - T_ORBIT;
    v.rotation.set(0, 0, -1.32);
    v.position.set(to * 0.5, 0, 0);
    if (boosters.current) boosters.current.visible = false;
    flash.current!.visible = false;
    trailRefs.current.forEach((s) => { if (s) s.visible = false; });

    // first stage: burning, then cut-off and separation; it drifts back slowly, tumbling a little
    const sep = Math.max(0, t - T_STAGE);
    stage1.current!.visible = sep < 3;
    stage1.current!.position.set(0, -sep * 0.45 - sep * sep * 0.22, 0);
    stage1.current!.rotation.set(sep * 0.05, 0, sep * 0.12);
    const burn1 = t < T_STAGE - 0.08 ? 1 : 0;
    plume1.current!.visible = burn1 > 0;
    plume1.current!.scale.set(3.2, 1.5, 3.2); // in near-vacuum the plume balloons wide and thin
    mainMat.uniforms.uI.value = 0.42;
    coreMat.uniforms.uI.value = 0.65;
    nozzleGlow.current!.visible = false;
    if (engineLight.current) engineLight.current.intensity = 0;
    cloudRefs.current.forEach((s) => { if (s) s.visible = false; });

    // upper stage burns between staging and spacecraft separation
    const vac = smooth(T_VAC, T_VAC + 0.25, t) * (1 - smooth(T_SEP - 0.35, T_SEP - 0.1, t));
    plume2.current!.visible = vac > 0.01;
    vacMat.uniforms.uI.value = vac * 0.7;

    // fairing halves are pushed apart, rotate open about their base and drift away
    const f = Math.max(0, t - T_FAIRING);
    const open = Math.min(1.1, f * 1.2);
    fairL.current!.rotation.set(f * 0.06, 0, -open - f * 0.12);
    fairR.current!.rotation.set(-f * 0.06, 0, open + f * 0.12);
    fairL.current!.position.set(RF + f * 0.42, H1 + H2 - f * 0.25, f * 0.12);
    fairR.current!.position.set(-RF - f * 0.42, H1 + H2 - f * 0.25, -f * 0.12);
    fairL.current!.visible = fairR.current!.visible = f < 2.2;

    // the satellite is pushed off the upper stage and unfolds its panels
    const s = Math.max(0, t - T_SEP);
    sat.current!.position.set(0, H1 + H2 + HF * 0.3 + s * 0.45, 0);
    sat.current!.rotation.set(0, s * 0.2, 0);
    const dep = clamp01((t - T_SEP - 0.15) / 0.9);
    const q = Math.round(dep * 20) / 20;
    if (q !== deployQ.current) { deployQ.current = q; setDeploy(q); }

    // camera: square to the upper stack and centred on it, so the stage separation, the nose and both fairing
    // halves stay in frame; the curved horizon behind; after separation it eases in on the satellite
    const push = smooth(T_SEP, T_END - 0.2, t);
    v.localToWorld(tmp.set(0, H1 + (H2 + HF) * 0.45, 0));
    sat.current!.getWorldPosition(look);
    tmp.lerp(look, push * 0.6);
    const d = (3.4 * (H2 + HF) + 2.6) * (1 - push * 0.3);
    camera.position.set(tmp.x - 0.12 * d + to * 0.08, tmp.y + 0.2 * d, tmp.z + d);
    camera.lookAt(tmp.x, tmp.y - 0.05 * d, tmp.z);
  });

  return (
    <>
      <mesh ref={sky} renderOrder={-1} material={skyMat}>
        <sphereGeometry args={[300, 48, 32]} />
      </mesh>

      {/* ---------- pad at dusk ---------- */}
      <group ref={padWorld}>
        <hemisphereLight args={['#f2c7a4', '#2c2a26', 0.65]} />
        <directionalLight position={[-30, 6, -18]} intensity={1.9} color="#ffb57a" />
        <directionalLight position={[20, 14, 16]} intensity={0.75} color="#a9bcd8" />
        <pointLight ref={engineLight} position={[0, 0.3, 0.8]} color="#ff9a3c" distance={30} decay={1.4} intensity={0} />
        {/* coastal scrub, the sea behind */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[900, 900]} />
          <meshStandardMaterial map={scrub} roughness={1} envMapIntensity={0.2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -300]}>
          <planeGeometry args={[1600, 420]} />
          <meshStandardMaterial color="#3a4855" roughness={0.18} metalness={0.5} envMapIntensity={0.6} />
        </mesh>
        {/* concrete apron, flame trench and its deflector, access road */}
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[16, 0.24, 14]} />
          <meshStandardMaterial map={concrete} roughness={0.95} envMapIntensity={0.25} />
        </mesh>
        <mesh position={[0, 0.245, 0]}>
          <boxGeometry args={[9, 0.02, 1.3]} />
          <meshStandardMaterial color="#141210" roughness={1} />
        </mesh>
        <mesh position={[0, 0.25, 16]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.2, 20]} />
          <meshStandardMaterial color="#55565a" roughness={0.9} />
        </mesh>
        {/* lightning protection masts with cables between their tops: they give the scene its scale */}
        <group ref={mastGroup}>
        {masts.map(([x, , z], i) => (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, mastH / 2, 0]}><cylinderGeometry args={[0.05, 0.09, mastH, 8]} /><meshStandardMaterial color="#8b8f92" metalness={0.5} roughness={0.6} /></mesh>
            <mesh position={[0, mastH + 0.25, 0]}><cylinderGeometry args={[0.012, 0.02, 0.5, 6]} /><meshStandardMaterial color="#6a6e72" /></mesh>
          </group>
        ))}
        {masts.map((m, i) => {
          const n = masts[(i + 1) % masts.length];
          return <Wire key={i} a={[m[0], mastH, m[2]]} b={[n[0], mastH, n[2]]} />;
        })}
        </group>
        {/* launch tower: a steel lattice with a retracting access arm and a red beacon */}
        <group position={[-(R + (spec.boosters ? bX : 0) * 0.6 + 1.05), 0.24, -0.2]}>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => (
            <mesh key={`${a}${b}`} position={[a * 0.32, towerH / 2, b * 0.32]}>
              <boxGeometry args={[0.05, towerH, 0.05]} />
              <meshStandardMaterial color="#6f6a63" metalness={0.55} roughness={0.6} />
            </mesh>
          ))}
          {Array.from({ length: Math.floor(towerH / 0.45) }, (_, i) => (
            <group key={i} position={[0, 0.3 + i * 0.45, 0]}>
              {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
                <group key={r} rotation={[0, r, 0]}>
                  <mesh position={[0, 0, 0.32]}><boxGeometry args={[0.66, 0.025, 0.025]} /><meshStandardMaterial color="#6f6a63" metalness={0.55} roughness={0.6} /></mesh>
                  <mesh position={[0, 0.22, 0.32]} rotation={[0, 0, 0.6]}><boxGeometry args={[0.78, 0.018, 0.018]} /><meshStandardMaterial color="#625d57" metalness={0.55} roughness={0.6} /></mesh>
                </group>
              ))}
            </group>
          ))}
          <mesh position={[0, towerH + 0.06, 0]}>
            <sphereGeometry args={[0.05, 12, 8]} />
            <meshBasicMaterial ref={beacon} color="#ff3b30" />
          </mesh>
          <group ref={arm} position={[0.32, H1 + H2 * 0.55, 0.2]}>
            <mesh position={[0.5, 0, 0]}><boxGeometry args={[1.0, 0.12, 0.2]} /><meshStandardMaterial color="#7d7a74" metalness={0.5} roughness={0.55} /></mesh>
          </group>
          {/* floodlights on the tower */}
          <pointLight position={[0.8, 1.2, 1.4]} color="#fff1d6" intensity={4} distance={9} />
          <pointLight position={[0.8, towerH * 0.7, 1.4]} color="#fff1d6" intensity={3} distance={8} />
        </group>
        {/* the ignition flash (a camera flare, not a light) */}
        <sprite ref={flash} position={[0, 0.6, 0]} visible={false}>
          <spriteMaterial map={glowTexture()} color="#ffcf8a" transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0} />
        </sprite>
        {/* smoke: the trench cloud and the column */}
        {cloudSeeds.map((s, i) => (
          <sprite key={`c${i}`} ref={(el) => { cloudRefs.current[i] = el; }} visible={false}>
            <spriteMaterial map={puffTex[s.tex]} color="#cfcac3" transparent depthWrite={false} opacity={0} />
          </sprite>
        ))}
        {trailSeeds.map((s, i) => (
          <sprite key={`t${i}`} ref={(el) => { trailRefs.current[i] = el; }} visible={false}>
            <spriteMaterial map={puffTex[s.tex]} color="#d8d4ce" transparent depthWrite={false} opacity={0} />
          </sprite>
        ))}
      </group>

      {/* ---------- orbit ---------- */}
      <group ref={orbitWorld} visible={false}>
        {/* hard sunlight, almost no fill, a blue bounce from the Earth below */}
        <ambientLight intensity={0.04} />
        <directionalLight position={[SUN.x * 20, SUN.y * 20, SUN.z * 20]} intensity={3.2} color="#fff8ee" />
        <hemisphereLight args={['#05070c', '#4f7fb8', 0.55]} />
        <OrbitEarth />
      </group>

      {/* ---------- the vehicle (rocket-local: y up, base of stage 1 at y = 0) ---------- */}
      <group ref={vehicle}>
        <group ref={stage1}>
          <mesh position={[0, (H1 - 0.32) / 2, 0]}><cylinderGeometry args={[R, R, H1 - 0.32, 48, 1, true]} /><meshStandardMaterial map={skin1} {...paint} /></mesh>
          {/* engine section, a thin band low down, a cable raceway and the dark interstage */}
          <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[R * 1.02, R * 1.04, 0.18, 48]} /><meshStandardMaterial {...DARK} /></mesh>
          <mesh position={[0, H1 * 0.22, 0]}><cylinderGeometry args={[R * 1.015, R * 1.015, 0.035, 48]} /><meshStandardMaterial {...DARK} /></mesh>
          <mesh position={[R * 0.98, H1 * 0.55, 0]}><boxGeometry args={[0.035, H1 * 0.8, 0.06]} /><meshStandardMaterial map={skin1} {...paint} /></mesh>
          <mesh position={[0, H1 - 0.16, 0]}><cylinderGeometry args={[R, R, 0.32, 48]} /><meshStandardMaterial color="#202326" roughness={0.42} metalness={0.3} /></mesh>
          {spec.cluster
            ? <>{Array.from({ length: 8 }, (_, i) => <Bell key={i} r={R * 0.17} x={Math.cos(i * Math.PI / 4) * R * 0.62} z={Math.sin(i * Math.PI / 4) * R * 0.62} />)}<Bell r={R * 0.19} /></>
            : <Bell r={R * 0.42} />}
          <group ref={plume1} position={[0, -R * 0.55, 0]}>
            <mesh geometry={mainGeo} material={mainMat} />
            <mesh geometry={coreGeo} material={coreMat} />
          </group>
          <sprite ref={nozzleGlow} position={[0, -R * 1.6, 0]}>
            <spriteMaterial map={glowTexture()} color="#ffbf70" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          {spec.boosters && (
            <group ref={boosters}>
              {[-1, 1].map((sx) => (
                <group key={sx} position={[sx * bX, 0, 0]}>
                  <mesh position={[0, H1 * 0.4, 0]}><cylinderGeometry args={[bR, bR, H1 * 0.8, 36, 1, true]} /><meshStandardMaterial map={skin1} {...paint} /></mesh>
                  <mesh position={[0, H1 * 0.8 + bR * 0.75, 0]}><coneGeometry args={[bR, bR * 1.5, 36]} /><meshStandardMaterial map={skin2} {...paint} /></mesh>
                  <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[bR * 1.03, bR * 1.05, 0.18, 36]} /><meshStandardMaterial {...DARK} /></mesh>
                  <Bell r={bR * 0.5} />
                  <group position={[0, -bR * 0.6, 0]} ref={sx === 1 ? plumeB : undefined}>
                    <mesh geometry={mainGeo} material={mainMat} scale={[0.7, 0.85, 0.7]} />
                  </group>
                </group>
              ))}
            </group>
          )}
        </group>

        <group ref={stage2}>
          <mesh position={[0, H1 + (H2 - 0.06) / 2, 0]}><cylinderGeometry args={[R, R, H2 - 0.06, 48]} /><meshStandardMaterial map={skin2} {...paint} /></mesh>
          <mesh position={[0, H1 + H2 - 0.03, 0]}><cylinderGeometry args={[R, R, 0.06, 48]} /><meshStandardMaterial {...DARK} /></mesh>
          {/* vacuum engine, hidden in the interstage until staging: dark niobium bell */}
          <mesh position={[0, H1 - R * 0.32, 0]}>
            <cylinderGeometry args={[R * 0.16, R * 0.55, R * 0.62, 32, 1, true]} />
            <meshStandardMaterial color="#2e2a27" metalness={0.85} roughness={0.38} side={THREE.DoubleSide} />
          </mesh>
          <group ref={plume2} position={[0, H1 - R * 0.62, 0]} visible={false}>
            <mesh geometry={vacGeo} material={vacMat} />
          </group>
        </group>

        {[1, -1].map((side) => (
          <group key={side} ref={side === 1 ? fairL : fairR} position={[side * RF, H1 + H2, 0]}>
            <mesh position={[-side * RF, 0, 0]}>
              <latheGeometry args={[fairPts, 48, side === 1 ? 0 : Math.PI, Math.PI]} />
              <meshStandardMaterial map={skinF} {...paint} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}

        <group ref={sat} position={[0, H1 + H2 + HF * 0.3, 0]} scale={spec.satScale}>
          <SatelliteModel build={build} mission={mission} deployProgress={deploy} />
        </group>
      </group>
    </>
  );
}


// ---------------------------------------------------------------------------
export interface Launch3DProps {
  build: Build;
  mission?: Mission;
  onDone(): void;
}

const EVENTS: { id: LaunchEvent; label: string }[] = [
  { id: 'liftoff', label: 'Liftoff' },
  { id: 'stage', label: 'Stage separation' },
  { id: 'fairing', label: 'Fairing separation' },
  { id: 'release', label: 'Spacecraft separation' },
];

export function Launch3D({ build, mission = MISSIONS[0], onDone }: Launch3DProps) {
  const { t } = useT();
  const spec = ROCKETS[build.rocket] ?? ROCKETS.rideshare;
  const km = ORBIT_KM[build.orbit] ?? 500;
  const [event, setEvent] = useState<LaunchEvent | null>(null);
  const [shot, setShot] = useState<Shot>('pad');
  const clockRef = useRef<HTMLDivElement>(null);
  const altRef = useRef<HTMLElement>(null);
  const speedRef = useRef<HTMLElement>(null);
  const beeps = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; doneRef.current(); } };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Tab') finish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // sounds follow the events (the same sounds as Launch2D, plus separation and release)
  useEffect(() => {
    if (event === 'liftoff') { sfx.countdown(true); sfx.liftoff(); }
    else if (event === 'stage' || event === 'fairing') sfx.separation();
    else if (event === 'release') sfx.released();
  }, [event]);

  const lastText = useRef('');
  const onTick = (tt: number) => {
    const tm = telemetry(Math.min(tt, T_END), km);
    if (tt < T_LIFTOFF && Math.floor(tt / 0.8) >= beeps.current) { beeps.current++; sfx.countdown(); }
    const text = `${formatClock(tm.clock)}|${Math.round(tm.alt)}|${Math.round(tm.speed / 10) * 10}`;
    if (text === lastText.current) return;
    lastText.current = text;
    if (clockRef.current) clockRef.current.textContent = formatClock(tm.clock);
    if (altRef.current) altRef.current.textContent = `${Math.round(tm.alt).toLocaleString()} ${t('km')}`;
    if (speedRef.current) speedRef.current.textContent = `${(Math.round(tm.speed / 10) * 10).toLocaleString()} ${t('km/h')}`;
  };

  const reached = event ? EVENTS.findIndex((e) => e.id === event) : -1;

  return (
    <div className="runner-stage l3d" onClick={finish}>
      <Canvas camera={{ position: [9.5 * PAD_CAM, 1.2, 11 * PAD_CAM], fov: FOV.pad, near: NEAR.pad, far: 1200 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <LaunchWorld build={build} mission={mission} km={km} onEvent={setEvent} onShot={setShot} onTick={onTick} onFinish={finish} />
        </Suspense>
      </Canvas>
      {shot !== 'pad' && <div className="l3d-cut" key={shot} />}

      <div className="l3d-head">
        <div className="l3d-clock" ref={clockRef}>{formatClock(-3)}</div>
        <div className="l3d-vehicle">{t('{rocket} rocket to {km} km', { rocket: t(spec.name), km: km.toLocaleString() })}</div>
      </div>
      <div className="l3d-skip">{t('Click or press any key to skip')}</div>

      <div className="l3d-foot">
        <ol className="l3d-events" aria-label={t('Launch events')}>
          {EVENTS.map((e, i) => (
            <li key={e.id} className={i < reached ? 'done' : i === reached ? 'now' : ''} aria-current={i === reached ? 'step' : undefined}>
              {t(e.label)}
            </li>
          ))}
        </ol>
        <dl className="l3d-telemetry">
          <div><dt>{t('Altitude')}</dt><dd ref={altRef}>0 {t('km')}</dd></div>
          <div><dt>{t('Speed')}</dt><dd ref={speedRef}>0 {t('km/h')}</dd></div>
        </dl>
      </div>
    </div>
  );
}
