// 3D flight over a real globe. The rules are the same sim.ts as the 2D flight (same seed + input =
// same FlightStats); this file only shows SimState in three.js and reuses the 2D HUD on top.
// The sim is stepped in useFrame and meshes are moved through refs - no React state per frame.
import { Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { Build, FlightParams } from '../game2d/config';
import { FlightHud, FlightMessages, hudOf, initialHud, playFlightSounds, useFlightControls, type HudState } from '../game2d/FlightHud';
import type { Mission } from '../game2d/missions';
import { createSim, stepSim, type FlightStats, type SimInput, type SimState } from '../game2d/sim';
import { useT } from '../i18n';
import { Earth } from './flight/Earth';
import { FlightModel, FlightSatellite } from './flight/FlightSatellite';
import { Targets } from './flight/Targets';
import { makeTrack, REACH_X, SAT_ALT, sunDir, trackPos, type Track } from './flight/track';
import { Debris, Lanes, Stations, StormSparks } from './flight/World';
import './flight3d.css';

/** `build` is the player's satellite, drawn by SatelliteModel. */
export default function Flight3D({ p, m, build, onEnd, seed }: { p: FlightParams; m: Mission; build: Build; onEnd(s: FlightStats): void; seed?: number }) {
  const { t } = useT();
  const [hud, setHud] = useState(() => initialHud(p));
  const control = useFlightControls(p, 'g3d');
  const s = useMemo(() => createSim(p, m, seed), [p, m, seed]);
  const msgs = useMemo(() => new FlightMessages(t), [t]);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const overlay = useRef<HTMLDivElement>(null);
  const phone = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__g3d = s;
    let timer = 0;
    const check = window.setInterval(() => {
      if (s.ended && !timer) timer = window.setTimeout(() => endRef.current({ ...s.stats }), 900);
    }, 100);
    return () => { clearInterval(check); clearTimeout(timer); };
  }, [s]);

  return (
    <div className="runner-stage g2d-flight g3d-flight">
      <Canvas dpr={[1, phone ? 1.5 : 2]} camera={{ fov: 55, near: 0.1, far: 600, position: [0, 3.4, 6.5] }} gl={{ antialias: !phone, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#02040f']} />
        <Scene s={s} build={build} control={control} msgs={msgs} setHud={setHud} overlay={overlay} reachLabel={t('◀ your orbit never flies north of this line')} />
      </Canvas>
      <div ref={overlay} className="g3d-overlay" />
      <div className="g3d-north">{t('◀ North')}</div>
      <FlightHud p={p} m={m} hud={hud} control={control} />
    </div>
  );
}

function Scene({ s, build, control, msgs, setHud, overlay, reachLabel }: {
  s: SimState; build: Build; control: MutableRefObject<SimInput>; msgs: FlightMessages; setHud(h: HudState): void;
  overlay: MutableRefObject<HTMLDivElement | null>; reachLabel: string;
}) {
  const tr = useMemo(() => makeTrack(s.p), [s]);
  const satPos = useMemo(() => new THREE.Vector3(1, SAT_ALT, 0), []);
  const photoAt = useRef(-9);
  const hitAt = useRef(-9);
  const hudAt = useRef(0);

  // ---- the game loop: step the rules first (priority -1), everything else reads SimState after
  useFrame((_, dt) => {
    stepSim(s, Math.min(dt, 0.05), control.current);
    msgs.take(s);
    playFlightSounds(s);
    for (const e of s.events) {
      if (e.type === 'photo') photoAt.current = s.t;
      if (e.type === 'hit' || e.type === 'stormHit') hitAt.current = s.t;
    }
    if (s.t - hudAt.current > 0.1 || s.ended) { hudAt.current = s.t; setHud(hudOf(s, msgs.current(s))); }

    // screen-wide flashes: white for a photo, red for a hit, orange during a solar storm
    const el = overlay.current;
    if (el) {
      const hit = Math.max(0, 1 - (s.t - hitAt.current) / 0.4), photo = Math.max(0, 1 - (s.t - photoAt.current) / 0.18);
      const storm = s.storm === 2 ? 0.14 + Math.sin(s.t * 9) * 0.05 : 0;
      el.style.background = hit > 0 ? `rgba(255,40,40,${0.35 * hit})` : photo > 0 ? `rgba(255,255,255,${0.22 * photo})` : storm > 0 ? `rgba(255,140,30,${storm})` : 'transparent';
    }
  }, -1);

  return (
    <>
      <CameraRig s={s} tr={tr} hitAt={hitAt} />
      <Lights s={s} />
      <Stars radius={220} depth={60} count={2500} factor={5} fade speed={0.4} />
      <Suspense fallback={null}><Earth s={s} tr={tr} /></Suspense>
      <Lanes s={s} tr={tr} />
      <Targets s={s} tr={tr} />
      <Debris s={s} tr={tr} />
      <Stations s={s} tr={tr} satPos={satPos} />
      <StormSparks s={s} />
      <FlightSatellite s={s} pos={satPos} photoAt={photoAt}>
        <FlightModel s={s} build={build} />
      </FlightSatellite>
      {!s.p.reachesTargets && <ReachLabel tr={tr} text={reachLabel} />}
    </>
  );
}

/** Third-person camera behind and above the satellite; further back in portrait and in geostationary orbit. */
function CameraRig({ s, tr, hitAt }: { s: SimState; tr: Track; hitAt: MutableRefObject<number> }) {
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const follow = useRef(0);
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const back = Math.min(1.9, Math.max(1, 1.25 / aspect)); // narrow screens: step back so all lanes fit
    const geo = tr.geo ? 1.5 : 1;
    follow.current += ((s.laneY - 1) * 0.55 - follow.current) * 0.08;
    const shake = Math.max(0, 1 - (s.t - hitAt.current) / 0.4) * 0.25;
    const jx = shake * Math.sin(s.t * 90), jy = shake * Math.cos(s.t * 77);
    // high behind the satellite, looking down the track: the satellite sits in the lower third, the track ahead stays visible
    cam.position.set(follow.current + jx, (5.6 * back) * geo + jy, 6.2 * back * geo);
    look.set(follow.current * 0.5, tr.geo ? -1.2 : -3.2, tr.geo ? -13 : -8.5);
    cam.lookAt(look);
    const fov = aspect < 0.8 ? 62 : 55;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  });
  return null;
}

/** Sunlight follows the sim: it goes out in Earth's shadow and turns orange in a solar storm. */
function Lights({ s }: { s: SimState }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const storm = useRef<THREE.DirectionalLight>(null);
  const lit = useRef(1);
  useFrame(() => {
    lit.current += ((s.shadow ? 0.05 : 1) - lit.current) * 0.08;
    if (sun.current) {
      sunDir(s.p, s.t, sun.current.position).multiplyScalar(30);
      sun.current.intensity = 2.6 * lit.current;
    }
    if (storm.current) storm.current.intensity = s.storm === 2 ? 1.6 + Math.sin(s.t * 13) * 0.6 : s.storm === 1 ? 0.4 : 0;
  });
  return (
    <>
      <ambientLight intensity={0.35} color="#9fb4ff" />
      <directionalLight ref={sun} intensity={2.6} />
      <directionalLight ref={storm} position={[20, 12, -10]} color="#ff8a2a" intensity={0} />
    </>
  );
}

/** "Your orbit never flies north of this line", a label standing on the red line a little ahead (drawn on a canvas, no emoji). */
function ReachLabel({ tr, text }: { tr: Track; text: string }) {
  const at = useMemo(() => trackPos(tr, 0.9, REACH_X, 0.9, new THREE.Vector3()), [tr]);
  const [tex, aspect] = useMemo(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('2d')!;
    const font = '700 40px system-ui, sans-serif';
    g.font = font;
    c.width = Math.ceil(g.measureText(text).width) + 40; c.height = 64;
    g.font = font; g.fillStyle = 'rgba(40,6,12,0.85)'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ff9a9a'; g.textBaseline = 'middle'; g.fillText(text, 20, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return [t, c.width / c.height] as const;
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  const h = 0.6;
  return (
    <sprite position={[at.x - (h * aspect) / 2 + 0.3, at.y, at.z]} scale={[h * aspect, h, 1]}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  );
}
