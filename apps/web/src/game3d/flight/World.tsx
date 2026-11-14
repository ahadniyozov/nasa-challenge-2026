// Everything in the flight that is not the globe, the targets or the satellite:
// lane lines, the orbit's reach line, space junk, ground stations with their radio cones,
// data packets flying home, and solar-storm particles. Instanced meshes, updated through refs.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CONTACT_WINDOW, type SimState } from '../../game2d/sim';
import { disposeTree, glowTexture } from './Targets';
import { GAP, GROUND_ALT, laneX, REACH_X, SAT_ALT, trackPos, trackTilt, type Track } from './track';

const v = new THREE.Vector3();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const one = new THREE.Vector3(1, 1, 1);
const scale = new THREE.Vector3();
const mtx = new THREE.Matrix4();

// ---- lane lines: dashes at flight height that stream past (they show the speed)
const DASH_STEP = 0.16; // seconds between dashes
const DASH_FROM = -0.9, DASH_TO = 1.6;
const DASHES = Math.ceil((DASH_TO - DASH_FROM) / DASH_STEP);

function Dashes({ s, tr, xs, color, opacity, alt }: { s: SimState; tr: Track; xs: number[]; color: string; opacity: number; alt: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    const im = ref.current;
    if (!im) return;
    let i = 0;
    const shift = (s.t % DASH_STEP);
    for (const x of xs) for (let k = 0; k < DASHES; k++) {
      const ahead = DASH_FROM + k * DASH_STEP - shift;
      trackPos(tr, ahead, x, alt, v);
      q.setFromEuler(e.set(trackTilt(tr, ahead), 0, 0));
      im.setMatrixAt(i++, mtx.compose(v, q, one));
    }
    im.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, xs.length * DASHES]} frustumCulled={false}>
      <boxGeometry args={[0.07, 0.02, DASH_STEP * tr.V * 0.45]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </instancedMesh>
  );
}

export function Lanes({ s, tr }: { s: SimState; tr: Track }) {
  return (
    <>
      <Dashes s={s} tr={tr} xs={[-GAP, 0, GAP]} color="#4dd2ff" opacity={0.45} alt={SAT_ALT - 0.35} />
      {!s.p.reachesTargets && <Dashes s={s} tr={tr} xs={[REACH_X]} color="#ff5a5a" opacity={0.9} alt={GROUND_ALT + 0.02} />}
    </>
  );
}

// ---- space junk
const JUNK = 24;
export function Debris({ s, tr }: { s: SimState; tr: Track }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    const im = ref.current;
    if (!im) return;
    let n = 0;
    for (const o of s.objects) {
      if (o.kind !== 'debris' || o.done || n >= JUNK) continue;
      trackPos(tr, o.ahead, laneX(o.lane), SAT_ALT, v);
      q.setFromEuler(e.set(o.id + s.t * 1.7, o.id * 2.3 + s.t * 2.3, o.id));
      const sc = 0.8 + (o.id % 3) * 0.2;
      im.setMatrixAt(n++, mtx.compose(v, q, scale.set(sc, sc * 0.7, sc)));
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, JUNK]} frustumCulled={false}>
      <dodecahedronGeometry args={[0.36, 0]} />
      <meshStandardMaterial color="#9aa1ad" metalness={0.6} roughness={0.45} flatShading />
    </instancedMesh>
  );
}

// ---- ground stations: a dish beside the track, the reach of its radio (a faint cone),
// a bright beam to the satellite while in contact, and green data packets flying down
const STATION_X = GAP * 2.7;
const STATIONS = 4;
const PACKETS = 14;

function dishGroup() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#d7deea', roughness: 0.4, metalness: 0.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.4, 8), metal); base.position.y = 0.2; g.add(base);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: '#eef2f8', side: THREE.DoubleSide, roughness: 0.35 }));
  dish.rotation.x = Math.PI; dish.position.y = 0.95;
  const tilt = new THREE.Group(); tilt.add(dish); tilt.rotation.z = 0.5; g.add(tilt);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#3ddc84' })); lamp.position.set(-0.2, 0.75, 0); g.add(lamp);
  // radio reach at flight height: a glowing green circle over the track, as wide as the sim's contact window
  const reach = new THREE.Group(); reach.name = 'reach';
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#3ddc84', transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }));
  const edge = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 48), new THREE.MeshBasicMaterial({ color: '#3ddc84', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = edge.rotation.x = -Math.PI / 2;
  reach.add(disc, edge); g.add(reach);
  return g;
}

export function Stations({ s, tr, satPos }: { s: SimState; tr: Track; satPos: THREE.Vector3 }) {
  const pool = useMemo(() => Array.from({ length: STATIONS }, dishGroup), []);
  useEffect(() => () => pool.forEach(disposeTree), [pool]);
  const beam = useRef<THREE.Mesh>(null);
  const packets = useRef<THREE.InstancedMesh>(null);
  const flying = useMemo(() => Array.from({ length: PACKETS }, () => ({ t0: -9 })), []);
  const state = useMemo(() => ({ next: 0, last: 0, dish: new THREE.Vector3() }), []);
  const reachR = CONTACT_WINDOW * tr.V;

  useFrame(() => {
    let n = 0, active: THREE.Vector3 | null = null;
    for (const o of s.objects) {
      if (o.kind !== 'station' || n >= STATIONS) continue;
      const g = pool[n++];
      g.visible = true;
      trackPos(tr, o.ahead, STATION_X, GROUND_ALT, g.position);
      g.rotation.set(trackTilt(tr, o.ahead), 0, 0);
      const reach = g.getObjectByName('reach')!;
      reach.scale.set(reachR, 1, reachR);
      reach.position.set(-STATION_X, SAT_ALT - 0.3 - GROUND_ALT, 0);
      if (s.contact && Math.abs(o.ahead) < CONTACT_WINDOW) active = state.dish.copy(g.position).add(v.set(0, 1, 0));
    }
    for (let i = n; i < STATIONS; i++) pool[i].visible = false;

    // the beam from the dish to the satellite while sending
    const b = beam.current;
    if (b) {
      b.visible = !!active;
      if (active) {
        const len = active.distanceTo(satPos);
        b.position.copy(active).add(satPos).multiplyScalar(0.5);
        b.scale.set(1, len, 1);
        b.quaternion.setFromUnitVectors(v.set(0, 1, 0), v.copy(satPos).sub(active).normalize());
        (b.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(s.t * 20) * 0.15;
      }
    }

    // green data packets: one every ~0.12 s while sending, each flies satellite → dish in 0.45 s
    if (active && s.memory > 0.05 && s.t - state.last > 0.12) { flying[state.next].t0 = s.t; state.next = (state.next + 1) % PACKETS; state.last = s.t; }
    const im = packets.current;
    if (im) {
      let k = 0;
      for (const p of flying) {
        const u = (s.t - p.t0) / 0.45;
        if (u < 0 || u > 1 || !active) continue;
        v.copy(satPos).lerp(active, u);
        im.setMatrixAt(k++, mtx.compose(v, q.identity(), one));
      }
      im.count = k;
      im.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {pool.map((g, i) => <primitive key={i} object={g} />)}
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.05, 0.12, 1, 8, 1, true]} />
        <meshBasicMaterial color="#3ddc84" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <instancedMesh ref={packets} args={[undefined, undefined, PACKETS]} frustumCulled={false}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshBasicMaterial color="#5dff9d" />
      </instancedMesh>
    </>
  );
}

// ---- solar storm: orange particles streaming from the Sun's side
const SPARKS = 260;
export function StormSparks({ s }: { s: SimState }) {
  const ref = useRef<THREE.Points>(null);
  const seeds = useMemo(() => Float32Array.from({ length: SPARKS * 3 }, (_, i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1), []);
  const pos = useMemo(() => new Float32Array(SPARKS * 3), []);
  useFrame(() => {
    const pts = ref.current;
    if (!pts) return;
    pts.visible = s.storm > 0;
    if (!pts.visible) return;
    const n = s.storm === 2 ? SPARKS : SPARKS / 5;
    for (let i = 0; i < SPARKS; i++) {
      const a = seeds[i * 3], b = seeds[i * 3 + 1], c = seeds[i * 3 + 2];
      const u = (a + s.t * (0.35 + b * 0.5)) % 1; // 0..1 along the flight from the Sun's side
      pos[i * 3] = 14 - u * 28;
      pos[i * 3 + 1] = -1 + b * 9 - u * 3;
      pos[i * 3 + 2] = -24 + c * 30;
    }
    const geo = pts.geometry;
    geo.setDrawRange(0, n);
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial map={glowTexture()} color="#ffa040" size={0.45} transparent depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}
