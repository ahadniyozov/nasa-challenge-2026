// 3D launch, shot like a launch broadcast (same { build, mission, onDone } interface as Launch2D).
// Three shots, 9 s in all:
//   pad at dusk (0-4 s): countdown, ignition, smoke from the flame trench, lift-off past the tower;
//   ascent (4-5.6 s): chase camera from below, the sky goes from dusk to black;
//   orbit (5.6-9 s): over the Earth - first stage separation, upper stage burn, fairing halves open,
//   the satellite (SatelliteModel) separates and unfolds its panels.
// The overlay is a broadcast telemetry strip: mission clock, altitude, speed and the event timeline.
// The clock, altitude and speed are a plausible real flight profile squeezed into the 9 seconds.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useT } from '../i18n';
import type { Build } from '../game2d/config';
import { MISSIONS, type Mission } from '../game2d/missions';
import { SatelliteModel } from './SatelliteModel';
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

type Shot = 'pad' | 'ascent' | 'orbit';
export type LaunchEvent = 'liftoff' | 'stage' | 'fairing' | 'release';

const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

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
    uniform float uTime; uniform float uI; uniform vec3 uA; uniform vec3 uB;
    varying vec2 vUv; varying vec3 vN; varying vec3 vView;
    void main() {
      float t = 1.0 - vUv.y;                       // 0 at the nozzle, 1 at the tail
      float flick = 0.86 + 0.14 * sin(uTime * 53.0 + t * 31.0) * sin(uTime * 37.0 + vUv.x * 25.0);
      float diamonds = 0.82 + 0.18 * cos(t * 42.0 - uTime * 9.0);
      float edge = mix(0.3, 1.0, pow(abs(dot(vN, vView)), 0.9));   // soft sides, still visible end-on
      float a = pow(1.0 - t, 1.7) * flick * diamonds * edge * uI;
      vec3 c = mix(uA, uB, smoothstep(0.0, 0.5, t));
      gl_FragColor = vec4(c, a);
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
      // dusk sky: warm horizon, steel blue, deep zenith
      vec3 horizon = vec3(0.98, 0.63, 0.38), mid = vec3(0.27, 0.40, 0.60), zen = vec3(0.05, 0.10, 0.22);
      vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.2, h));
      col = mix(col, zen, smoothstep(0.2, 0.75, h));
      col += vec3(1.0, 0.55, 0.25) * pow(max(dot(d, normalize(uSun)), 0.0), 10.0) * 0.6 * (1.0 - smoothstep(0.0, 0.4, h));
      col = mix(col, vec3(0.08, 0.08, 0.10), smoothstep(0.0, -0.08, h));   // below the horizon
      // space: black with stars, a thin blue limb glow low down
      vec3 space = vec3(0.004, 0.008, 0.02) + vec3(0.12, 0.28, 0.55) * pow(1.0 - abs(h + 0.15), 14.0) * 0.5;
      vec3 cell = floor(d * 420.0);
      float n = hash(cell);
      float star = smoothstep(0.9975, 1.0, n) * (0.5 + 0.5 * hash(cell + 7.0));
      space += vec3(star);
      gl_FragColor = vec4(mix(col, space, uSpace), 1.0);
    }`,
};

const glowShader = {
  vertex: /* glsl */ `
    varying vec3 vN; varying vec3 vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragment: /* glsl */ `
    varying vec3 vN; varying vec3 vView;
    void main() {
      float k = pow(clamp(0.78 + dot(vN, vView), 0.0, 1.0), 5.0);
      gl_FragColor = vec4(vec3(0.38, 0.66, 1.0) * k, k);
    }`,
};

let softTex: THREE.Texture | null = null;
function softTexture() {
  if (softTex) return softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  return softTex;
}

function usePlumeMaterial(a: string, b: string) {
  return useMemo(() => new THREE.ShaderMaterial({
    vertexShader: plumeShader.vertex,
    fragmentShader: plumeShader.fragment,
    uniforms: { uTime: { value: 0 }, uI: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), [a, b]);
}

/** Open cylinder hanging down from y = 0 (the nozzle exit), wider at the tail. */
function plumeGeometry(r: number, len: number, spread: number) {
  const g = new THREE.CylinderGeometry(r, r * spread, len, 28, 1, true);
  g.translate(0, -len / 2, 0);
  return g;
}

// ---------------------------------------------------------------------------
function Bell({ r, y = 0, x = 0, z = 0 }: { r: number; y?: number; x?: number; z?: number }) {
  return (
    <mesh position={[x, y - r * 0.55, z]}>
      <cylinderGeometry args={[r * 0.38, r, r * 1.1, 20, 1, true]} />
      <meshStandardMaterial color="#3b4047" metalness={0.85} roughness={0.35} side={THREE.DoubleSide} />
    </mesh>
  );
}

const WHITE = { color: '#eef0ee', roughness: 0.5, metalness: 0.05 } as const;
const DARK = { color: '#1d2329', roughness: 0.6, metalness: 0.2 } as const;

function LaunchWorld({ build, mission, km, onEvent, onShot, onTick, onFinish }: {
  build: Build; mission: Mission; km: number;
  onEvent(e: LaunchEvent | null): void; onShot(s: Shot): void; onTick(t: number): void; onFinish(): void;
}) {
  const spec = ROCKETS[build.rocket] ?? ROCKETS.rideshare;
  const { R, H1, H2, HF, fairingR: RF } = spec;
  const { camera, scene } = useThree();
  const fog = useMemo(() => new THREE.Fog('#6d5a55', 40, 260), []);
  const [day] = useLoader(THREE.TextureLoader, [`${import.meta.env.BASE_URL}textures/earth-day.webp`]);
  day.colorSpace = THREE.SRGBColorSpace;

  const elapsed = useRef(0);
  const finished = useRef(false);
  const lastEvent = useRef<LaunchEvent | null>(null);
  const lastShot = useRef<Shot>('pad');

  const vehicle = useRef<THREE.Group>(null);
  const stage1 = useRef<THREE.Group>(null);
  const boosters = useRef<THREE.Group>(null);
  const stage2 = useRef<THREE.Group>(null);
  const fairL = useRef<THREE.Group>(null);
  const fairR = useRef<THREE.Group>(null);
  const sat = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const padWorld = useRef<THREE.Group>(null);
  const orbitWorld = useRef<THREE.Group>(null);
  const sky = useRef<THREE.Mesh>(null);
  const engineLight = useRef<THREE.PointLight>(null);
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  const plume1 = useRef<THREE.Group>(null);
  const plumeB = useRef<THREE.Group>(null);
  const plume2 = useRef<THREE.Group>(null);
  const nozzleGlow = useRef<THREE.Sprite>(null);
  const smokeRefs = useRef<(THREE.Sprite | null)[]>([]);

  const [deploy, setDeploy] = useState(0);
  const deployQ = useRef(0);

  const mainMat = usePlumeMaterial('#fff6dc', '#ff8a2a');
  const coreMat = usePlumeMaterial('#ffffff', '#ffd28a');
  const vacMat = usePlumeMaterial('#e8f0ff', '#7fa6ff');
  const skyMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: skyShader.vertex, fragmentShader: skyShader.fragment, side: THREE.BackSide, depthWrite: false,
    uniforms: { uSpace: { value: 0 }, uSun: { value: new THREE.Vector3(-0.9, 0.12, -0.6) } },
  }), []);

  const plumeLen = R * 9;
  const mainGeo = useMemo(() => plumeGeometry(R * (spec.cluster ? 0.78 : 0.42), plumeLen, 2.0), [R, spec.cluster, plumeLen]);
  const coreGeo = useMemo(() => plumeGeometry(R * (spec.cluster ? 0.5 : 0.3), plumeLen * 0.45, 1.1), [R, spec.cluster, plumeLen]);
  const vacGeo = useMemo(() => plumeGeometry(R * 0.5, R * 7, 3.2), [R]);
  const bR = R * 0.62;
  const bX = R + bR + 0.03;

  // the fairing: a cylinder and an ogive nose, built as two halves that split along x
  const fairPts = useMemo(() => {
    const pts = [new THREE.Vector2(R * 0.99, 0), new THREE.Vector2(RF, Math.max(0.04, (RF - R) * 1.6)), new THREE.Vector2(RF, HF * 0.42)];
    for (let i = 1; i <= 12; i++) {
      const u = i / 12;
      pts.push(new THREE.Vector2(Math.max(0.004, RF * Math.pow(1 - u * u, 0.62)), HF * 0.42 + u * HF * 0.58));
    }
    return pts;
  }, [R, RF, HF]);

  const smokeSeeds = useMemo(() => Array.from({ length: 64 }, (_, i) => ({
    born: T_IGNITE + i * 0.045,
    side: i % 2 ? 1 : -1,
    speed: 1.8 + ((i * 37) % 17) / 6,
    rise: 0.25 + ((i * 13) % 11) / 18,
    drift: (((i * 29) % 19) / 19 - 0.5) * 1.6,
  })), []);

  const total = H1 + H2 + HF;
  const towerH = total * 1.08;
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

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
    if (shot !== lastShot.current) { lastShot.current = shot; onShot(shot); }

    const v = vehicle.current!;
    const fly = Math.max(0, t - T_LIFTOFF);
    const throttle = smooth(T_IGNITE, T_IGNITE + 0.45, t);
    for (const m of [mainMat, coreMat, vacMat]) m.uniforms.uTime.value = time;
    if (beacon.current) beacon.current.color.setScalar(Math.sin(time * 4) > 0.3 ? 1 : 0.15);

    padWorld.current!.visible = shot !== 'orbit';
    orbitWorld.current!.visible = shot === 'orbit';
    sky.current!.position.copy(camera.position);
    scene.fog = shot === 'orbit' ? null : fog;

    if (shot !== 'orbit') {
      // ---- pad and ascent
      const space = shot === 'ascent' ? smooth(T_ASCENT, T_ORBIT, t) * 0.92 : 0;
      skyMat.uniforms.uSpace.value = space;
      const y = shot === 'pad' ? 0.35 + 1.25 * fly * fly : 0.35 + 1.25 * 1.6 * 1.6 + 40 * Math.pow(t - T_ASCENT, 2) + 4 * (t - T_ASCENT);
      const shake = fly > 0 && fly < 1.2 ? (Math.sin(time * 70) * 0.012) : 0;
      v.position.set(shake, y, 0);
      v.rotation.set(0, 0, shot === 'ascent' ? -0.18 * (t - T_ASCENT) : 0);
      stage1.current!.position.set(0, 0, 0);
      stage1.current!.rotation.set(0, 0, 0);
      stage1.current!.visible = true;
      if (boosters.current) boosters.current.visible = true;
      fairL.current!.rotation.set(0, 0, 0); fairR.current!.rotation.set(0, 0, 0);
      fairL.current!.position.set(RF, H1 + H2, 0); fairR.current!.position.set(-RF, H1 + H2, 0);
      sat.current!.position.set(0, H1 + H2 + HF * 0.3, 0);
      if (arm.current) arm.current.rotation.y = -smooth(1.2, 1.9, t) * 1.25;

      // plumes: grow at ignition, longer and wider as the air thins
      const stretch = 1 + fly * 0.35 + space * 1.4;
      plume1.current!.visible = throttle > 0;
      plume1.current!.scale.set(1 + space * 1.3, throttle * stretch * (t < T_LIFTOFF ? 0.55 : 1), 1 + space * 1.3);
      mainMat.uniforms.uI.value = throttle * 0.95;
      coreMat.uniforms.uI.value = throttle;
      if (plumeB.current) { plumeB.current.visible = throttle > 0; plumeB.current.scale.copy(plume1.current!.scale); }
      plume2.current!.visible = false;
      nozzleGlow.current!.visible = throttle > 0;
      nozzleGlow.current!.scale.setScalar(R * (6 + Math.sin(time * 40) * 0.6) * throttle);
      if (engineLight.current) engineLight.current.intensity = shot === 'pad' ? throttle * (14 + Math.sin(time * 33) * 3) : 0;

      // smoke rolls out of the flame trench on both sides and climbs
      smokeSeeds.forEach((s, i) => {
        const sp = smokeRefs.current[i];
        if (!sp) return;
        const age = t - s.born;
        sp.visible = shot === 'pad' && age > 0;
        if (!sp.visible) return;
        const k = 1 - Math.exp(-age * 0.9);
        sp.position.set(s.side * (0.6 + s.speed * k * 2.2), 0.25 + s.rise * age * 1.1, s.drift * k * 2);
        sp.scale.setScalar(0.5 + k * 3.4);
        const mat = sp.material as THREE.SpriteMaterial;
        mat.opacity = Math.min(1, age * 3) * (1 - smooth(2.4, 4.2, age)) * 0.8;
        const warm = Math.max(0, 1 - k * 2.2) * throttle;
        mat.color.setRGB(0.78 + warm * 0.22, 0.76 + warm * 0.1, 0.74 - warm * 0.25);
      });

      // camera
      if (shot === 'pad') {
        const p = t / T_ASCENT;
        camera.position.set(THREE.MathUtils.lerp(9.5, 7.2, p), THREE.MathUtils.lerp(1.6, 2.2, p), THREE.MathUtils.lerp(11, 8.8, p));
        look.set(0, Math.max(total * 0.45, y + total * 0.5 - 0.6), 0);
        camera.lookAt(look);
      } else {
        // chase camera from below and to the side, far enough for the whole rocket and its plume
        const k = total / 4.4;
        v.localToWorld(tmp.set(0, total * 0.2, 0));
        camera.position.set(tmp.x + 4.6 * k, tmp.y - 1.2 * k, tmp.z + 6.2 * k);
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

    // first stage: burning, then cut-off and separation, falls back and tumbles
    const sep = Math.max(0, t - T_STAGE);
    stage1.current!.visible = sep < 2.2;
    stage1.current!.position.set(0, -sep * 0.55 - sep * sep * 0.35, 0);
    stage1.current!.rotation.set(sep * 0.12, 0, sep * 0.28);
    const burn1 = t < T_STAGE - 0.08 ? 1 : 0;
    plume1.current!.visible = burn1 > 0;
    plume1.current!.scale.set(2.6, 1.6, 2.6);
    mainMat.uniforms.uI.value = 0.75;
    coreMat.uniforms.uI.value = 0.8;
    nozzleGlow.current!.visible = false;
    if (engineLight.current) engineLight.current.intensity = 0;
    smokeRefs.current.forEach((s) => { if (s) s.visible = false; });

    // upper stage burns between staging and spacecraft separation
    const vac = smooth(T_VAC, T_VAC + 0.25, t) * (1 - smooth(T_SEP - 0.35, T_SEP - 0.1, t));
    plume2.current!.visible = vac > 0.01;
    vacMat.uniforms.uI.value = vac * 0.8;

    // fairing halves swing open about their base hinges and drift away
    const f = Math.max(0, t - T_FAIRING);
    const open = Math.min(1.25, f * 1.6);
    fairL.current!.rotation.set(0, 0, -open - f * 0.15);
    fairR.current!.rotation.set(0, 0, open + f * 0.15);
    fairL.current!.position.set(RF + f * 0.5, H1 + H2 - f * 0.2, f * 0.15);
    fairR.current!.position.set(-RF - f * 0.5, H1 + H2 - f * 0.2, -f * 0.15);
    fairL.current!.visible = fairR.current!.visible = f < 2;

    // the satellite is pushed off the upper stage and unfolds its panels
    const s = Math.max(0, t - T_SEP);
    sat.current!.position.set(0, H1 + H2 + HF * 0.3 + s * 0.55, 0);
    sat.current!.rotation.set(0, s * 0.25, 0);
    const dep = clamp01((t - T_SEP - 0.15) / 0.9);
    const q = Math.round(dep * 20) / 20;
    if (q !== deployQ.current) { deployQ.current = q; setDeploy(q); }

    // camera: beside the upper stage, Earth's limb in the lower third, a slow drift;
    // after separation it pushes in on the satellite
    const push = smooth(T_SEP, T_END - 0.2, t);
    v.localToWorld(tmp.set(0, H1 + H2 * 0.6, 0));
    sat.current!.getWorldPosition(look);
    tmp.lerp(look, push);
    const d = (2.4 * (H2 + HF) + 2.2) * (1 - push * 0.5);
    camera.position.set(tmp.x - 0.35 * d + to * 0.12, tmp.y + 0.28 * d, tmp.z + d);
    camera.lookAt(tmp.x + 0.25 * (1 - push), tmp.y - 0.1, tmp.z);
  });

  return (
    <>
      <mesh ref={sky} renderOrder={-1} material={skyMat}>
        <sphereGeometry args={[300, 48, 32]} />
      </mesh>

      {/* ---------- pad at dusk ---------- */}
      <group ref={padWorld}>
        <hemisphereLight args={['#ffc49a', '#2a2f36', 0.75]} />
        <directionalLight position={[-30, 8, -18]} intensity={1.6} color="#ffc08a" />
        <directionalLight position={[20, 14, 16]} intensity={1.1} color="#b9cbe4" />
        <pointLight ref={engineLight} position={[0, 0.2, 0.6]} color="#ffa14a" distance={18} decay={1.6} intensity={0} />
        {/* ground, sea far behind */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[900, 900]} />
          <meshStandardMaterial color="#2c3238" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -260]}>
          <planeGeometry args={[1400, 380]} />
          <meshStandardMaterial color="#25384b" roughness={0.25} metalness={0.4} />
        </mesh>
        {/* concrete pad and flame trench */}
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[3.4, 3.8, 0.3, 48]} />
          <meshStandardMaterial color="#8a8f94" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.31, 0]}>
          <boxGeometry args={[4.6, 0.04, 0.9]} />
          <meshStandardMaterial color="#15191d" roughness={1} />
        </mesh>
        {/* launch tower: a steel lattice with a retracting access arm and a red beacon */}
        <group position={[-(R + (spec.boosters ? bX : 0) * 0.6 + 1.05), 0.3, -0.2]}>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => (
            <mesh key={`${a}${b}`} position={[a * 0.32, towerH / 2, b * 0.32]}>
              <boxGeometry args={[0.05, towerH, 0.05]} />
              <meshStandardMaterial color="#7c838b" metalness={0.6} roughness={0.5} />
            </mesh>
          ))}
          {Array.from({ length: Math.floor(towerH / 0.45) }, (_, i) => (
            <group key={i} position={[0, 0.3 + i * 0.45, 0]}>
              {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
                <group key={r} rotation={[0, r, 0]}>
                  <mesh position={[0, 0, 0.32]}><boxGeometry args={[0.66, 0.025, 0.025]} /><meshStandardMaterial color="#7c838b" metalness={0.6} roughness={0.5} /></mesh>
                  <mesh position={[0, 0.22, 0.32]} rotation={[0, 0, 0.6]}><boxGeometry args={[0.78, 0.018, 0.018]} /><meshStandardMaterial color="#6c737a" metalness={0.6} roughness={0.5} /></mesh>
                </group>
              ))}
            </group>
          ))}
          <mesh position={[0, towerH + 0.06, 0]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshBasicMaterial ref={beacon} color="#ff3b30" />
          </mesh>
          <group ref={arm} position={[0.32, H1 + H2 * 0.55, 0.2]}>
            <mesh position={[0.5, 0, 0]}><boxGeometry args={[1.0, 0.12, 0.2]} /><meshStandardMaterial color="#8e959c" metalness={0.5} roughness={0.5} /></mesh>
          </group>
          {/* floodlights on the tower */}
          <pointLight position={[0.8, 1.2, 1.4]} color="#fff1d6" intensity={4} distance={9} />
          <pointLight position={[0.8, towerH * 0.7, 1.4]} color="#fff1d6" intensity={3} distance={8} />
        </group>
        {/* smoke */}
        {smokeSeeds.map((_, i) => (
          <sprite key={i} ref={(el) => { smokeRefs.current[i] = el; }} visible={false}>
            <spriteMaterial map={softTexture()} color="#d0cdc8" transparent depthWrite={false} opacity={0} />
          </sprite>
        ))}
      </group>

      {/* ---------- orbit ---------- */}
      <group ref={orbitWorld} visible={false}>
        <ambientLight intensity={0.22} />
        <directionalLight position={[10, 5, 7]} intensity={2.6} color="#ffffff" />
        <hemisphereLight args={['#1b2a44', '#3d6ea8', 0.5]} />
        <group position={[2, -40, -14]} rotation={[0.35, 2.2, 0.2]}>
          <mesh>
            <sphereGeometry args={[34, 96, 64]} />
            <meshStandardMaterial map={day} roughness={0.9} metalness={0} />
          </mesh>
          <mesh scale={1.05}>
            <sphereGeometry args={[34, 64, 48]} />
            <shaderMaterial vertexShader={glowShader.vertex} fragmentShader={glowShader.fragment} side={THREE.BackSide} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      </group>

      {/* ---------- the vehicle (rocket-local: y up, base of stage 1 at y = 0) ---------- */}
      <group ref={vehicle}>
        <group ref={stage1}>
          <mesh position={[0, H1 / 2, 0]}><cylinderGeometry args={[R, R, H1, 40]} /><meshStandardMaterial {...WHITE} /></mesh>
          {/* engine section, a thin band low down, a cable raceway and the dark interstage */}
          <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[R * 1.02, R * 1.04, 0.18, 40]} /><meshStandardMaterial {...DARK} /></mesh>
          <mesh position={[0, H1 * 0.22, 0]}><cylinderGeometry args={[R * 1.005, R * 1.005, 0.05, 40]} /><meshStandardMaterial {...DARK} /></mesh>
          <mesh position={[R * 0.98, H1 * 0.55, 0]}><boxGeometry args={[0.04, H1 * 0.8, 0.07]} /><meshStandardMaterial color="#c9cdd0" roughness={0.6} /></mesh>
          <mesh position={[0, H1 - 0.16, 0]}><cylinderGeometry args={[R * 1.005, R * 1.005, 0.32, 40]} /><meshStandardMaterial {...DARK} /></mesh>
          {spec.cluster
            ? <>{Array.from({ length: 8 }, (_, i) => <Bell key={i} r={R * 0.17} x={Math.cos(i * Math.PI / 4) * R * 0.62} z={Math.sin(i * Math.PI / 4) * R * 0.62} />)}<Bell r={R * 0.19} /></>
            : <Bell r={R * 0.42} />}
          <group ref={plume1} position={[0, -R * 0.55, 0]}>
            <mesh geometry={mainGeo} material={mainMat} />
            <mesh geometry={coreGeo} material={coreMat} />
          </group>
          <sprite ref={nozzleGlow} position={[0, -R * 0.9, 0]}>
            <spriteMaterial map={softTexture()} color="#ffb060" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          {spec.boosters && (
            <group ref={boosters}>
              {[-1, 1].map((sx) => (
                <group key={sx} position={[sx * bX, 0, 0]}>
                  <mesh position={[0, H1 * 0.4, 0]}><cylinderGeometry args={[bR, bR, H1 * 0.8, 32]} /><meshStandardMaterial {...WHITE} /></mesh>
                  <mesh position={[0, H1 * 0.8 + bR * 0.75, 0]}><coneGeometry args={[bR, bR * 1.5, 32]} /><meshStandardMaterial {...WHITE} /></mesh>
                  <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[bR * 1.03, bR * 1.05, 0.18, 32]} /><meshStandardMaterial {...DARK} /></mesh>
                  <Bell r={bR * 0.5} />
                  <group position={[0, -bR * 0.6, 0]} ref={sx === 1 ? plumeB : undefined}>
                    <mesh geometry={mainGeo} material={mainMat} scale={[0.85, 0.85, 0.85]} />
                    <mesh geometry={coreGeo} material={coreMat} scale={[0.85, 0.85, 0.85]} />
                  </group>
                </group>
              ))}
            </group>
          )}
        </group>

        <group ref={stage2}>
          <mesh position={[0, H1 + H2 / 2, 0]}><cylinderGeometry args={[R, R, H2, 40]} /><meshStandardMaterial {...WHITE} /></mesh>
          <mesh position={[0, H1 + H2 - 0.03, 0]}><cylinderGeometry args={[R * 1.005, R * 1.005, 0.06, 40]} /><meshStandardMaterial {...DARK} /></mesh>
          {/* vacuum engine, hidden in the interstage until staging */}
          <mesh position={[0, H1 - R * 0.32, 0]}>
            <cylinderGeometry args={[R * 0.16, R * 0.55, R * 0.62, 24, 1, true]} />
            <meshStandardMaterial color="#5a4a3a" metalness={0.8} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>
          <group ref={plume2} position={[0, H1 - R * 0.62, 0]} visible={false}>
            <mesh geometry={vacGeo} material={vacMat} />
          </group>
        </group>

        {[1, -1].map((side) => (
          <group key={side} ref={side === 1 ? fairL : fairR} position={[side * RF, H1 + H2, 0]}>
            <mesh position={[-side * RF, 0, 0]}>
              <latheGeometry args={[fairPts, 40, side === 1 ? 0 : Math.PI, Math.PI]} />
              <meshStandardMaterial {...WHITE} side={THREE.DoubleSide} />
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
      <Canvas camera={{ position: [9.5, 1.6, 11], fov: 40, near: 0.05, far: 900 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
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
