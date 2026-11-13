// The mission as a mini-game: tap targets inside the green circle, photos fly home over ground stations,
// the battery drains in Earth's shadow, and real events from the engine's simulation interrupt you.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { physics, stationById, type Budgets, type SimResult, type TimelineEvent } from '@mission/engine';
import { Earth, EarthFixed, inShadow, latLonToVec, orbitPos, SUN } from '../scenes/OrbitScene';
import { useT } from '../i18n';
import type { FlightResult } from './store';

const DURATION = 70; // real seconds for the whole mission
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

interface Target { id: number; vec: THREE.Vector3; born: number; bonus: boolean }

interface G {
  t: number; earthRot: number; sat: THREE.Vector3; sub: THREE.Vector3;
  battery: number; shadow: boolean; contact: string | null;
  memory: number; delivered: number; captured: number;
  camOffUntil: number; camBroken: boolean; paused: boolean;
  targets: Target[]; nextId: number; nextSpawn: number; evIdx: number; ended: boolean;
  batteryOuts: number; missedFar: number; stormChoice: 'hide' | 'risk' | null; endText: string | null;
  flash: { text: string; until: number } | null;
}

export interface FlightProps {
  budgets: Budgets;
  sim: SimResult;
  stationIds: string[];
  targetKind: 'fire' | 'sight';
  goal: number;
  onEnd(r: FlightResult): void;
}

function footprintDeg(alt: number) {
  return alt <= 450 ? 14 : alt <= 600 ? 16 : alt <= 900 ? 20 : alt < 30000 ? 45 : 70;
}

export function FlightGame(props: FlightProps) {
  const { t, msg, name } = useT();
  const g = useRef<G>({
    t: 0, earthRot: 0, sat: new THREE.Vector3(), sub: new THREE.Vector3(1, 0, 0), battery: 100, shadow: false, contact: null,
    memory: 0, delivered: 0, captured: 0, camOffUntil: 0, camBroken: false, paused: false, targets: [], nextId: 1, nextSpawn: 0,
    evIdx: 0, ended: false, batteryOuts: 0, missedFar: 0, stormChoice: null, endText: null, flash: null,
  });
  const [hud, setHud] = useState({ t: 0, battery: 100, shadow: false, contact: null as string | null, memory: 0, delivered: 0, camState: 'ok' as 'ok' | 'off' | 'broken' | 'empty', flash: null as string | null });
  const [storm, setStorm] = useState(false);
  const [tip, setTip] = useState(true);

  // the HUD refreshes 6x per second; the 3D scene runs every frame
  useEffect(() => {
    const id = setInterval(() => {
      const s = g.current;
      const camState = s.camBroken ? 'broken' : s.battery <= 0 ? 'empty' : s.t < s.camOffUntil ? 'off' : 'ok';
      setHud({ t: s.t, battery: s.battery, shadow: s.shadow, contact: s.contact, memory: s.memory, delivered: s.delivered, camState, flash: s.flash && s.flash.until > s.t ? s.flash.text : null });
    }, 160);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { const id = setTimeout(() => setTip(false), 9000); return () => clearTimeout(id); }, []);

  const end = () => {
    const s = g.current;
    if (s.ended) return;
    s.ended = true;
    props.onEnd({
      delivered: Math.floor(s.delivered), captured: s.captured, survived: !s.endText, endText: s.endText,
      lostInSpace: Math.round(s.memory), batteryOuts: s.batteryOuts, missedFar: s.missedFar, stormChoice: s.stormChoice,
    });
  };

  const chooseStorm = (c: 'hide' | 'risk') => {
    const s = g.current;
    s.stormChoice = c;
    if (c === 'hide') { s.camOffUntil = s.t + 5; s.flash = { text: t('Safe mode: camera sleeps for a moment'), until: s.t + 3 }; }
    else if (Math.random() < 0.3) { s.camBroken = true; s.flash = { text: t('Ouch! The storm broke the camera...'), until: s.t + 4 }; }
    else s.flash = { text: t('Phew! Lucky this time.'), until: s.t + 3 };
    s.paused = false;
    setStorm(false);
  };

  const goalText = props.targetKind === 'fire' ? '🔥' : '📸';
  const year = Math.min(props.budgets.scenario.durationYears, Math.floor((hud.t / DURATION) * props.budgets.scenario.durationYears) + 1);

  return (
    <div className="flight">
      <Canvas camera={{ position: [3, 1, 3], fov: 50 }} dpr={[1, 2]}>
        <FlightScene {...props} g={g} onStorm={() => { g.current.paused = true; setStorm(true); }} onEnd={end} msg={msg} tt={t} />
      </Canvas>

      <div className="hud top">
        <div className="hud-goal">
          <div className="big">{goalText} {Math.floor(hud.delivered)} / {props.goal}</div>
          <small>{t('photos delivered to Earth')}</small>
        </div>
        <div className="hud-mem">📷 {t('In memory')}: <b>{Math.round(hud.memory)}</b></div>
        <div className="hud-time">
          <small>{t('Year {y} of {n}', { y: year, n: props.budgets.scenario.durationYears })}</small>
          <div className="mini-track"><div style={{ width: `${(hud.t / DURATION) * 100}%` }} /></div>
        </div>
      </div>

      <div className="hud bottom">
        <div className={`hud-chip ${hud.shadow ? 'dark' : 'sun'}`}>{hud.shadow ? t('🌑 Earth\'s shadow') : t('☀️ Sunlight')}</div>
        <div className="hud-battery">
          🔋 <div className="mini-track"><div className={hud.battery < 25 ? 'low' : ''} style={{ width: `${hud.battery}%` }} /></div>
        </div>
        <div className={`hud-chip ${hud.contact ? 'on' : ''}`}>{hud.contact ? t('📡 Sending photos to {s}…', { s: name(hud.contact) }) : t('📡 No station in sight')}</div>
        <div className={`hud-chip cam-${hud.camState}`}>
          {hud.camState === 'ok' ? t('📷 Camera ready') : hud.camState === 'off' ? t('📷 Camera resting…') : hud.camState === 'empty' ? t('🪫 Battery empty!') : t('💥 Camera broken')}
        </div>
      </div>

      {hud.flash && <div className="flash-msg">{hud.flash}</div>}
      {tip && (
        <div className="tip-bubble" onClick={() => setTip(false)}>
          <span className="avatar">👩‍🚀</span>
          <div>
            {t(props.targetKind === 'fire' ? 'Tap the 🔥 fires when they are inside the green circle!' : 'Tap the ⭐ places when they are inside the green circle!')}
            <br />
            <small>{t('Photos wait in memory and fly home when you pass over a 📡 station.')}</small>
          </div>
        </div>
      )}
      {storm && (
        <div className="event-card">
          <div className="event-emoji">☀️</div>
          <h2>{t('Solar storm!')}</h2>
          <p>{t('The Sun is throwing out dangerous particles. They can break electronics.')}</p>
          <div className="event-actions">
            <button className="kbtn green" onClick={() => chooseStorm('hide')}>{t('🛡️ Hide (camera sleeps 5 s)')}</button>
            <button className="kbtn red" onClick={() => chooseStorm('risk')}>{t('🎲 Keep shooting (30% risk)')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FlightScene({ budgets, sim, stationIds, targetKind, g, onStorm, onEnd, msg, tt }: Omit<FlightProps, "onEnd"> & { onEnd(): void; g: React.MutableRefObject<G>; onStorm(): void; msg(s: string): string; tt(s: string): string }) {
  const { camera } = useThree();
  const orbit = budgets.orbit;
  const r = 1 + orbit.altitudeKm / physics.EARTH_RADIUS_KM;
  const inc = orbit.inclinationDeg * DEG;
  const raan = orbit.kind === 'SSO' ? 35 * DEG : 15 * DEG;
  const period = physics.periodMin(orbit.altitudeKm) * 60;
  const isGeo = orbit.kind === 'GEO';
  const timeScale = isGeo ? 86164 / 45 : period / 12; // one orbit ≈ 12 s
  const fpDeg = footprintDeg(orbit.altitudeKm);
  const fpRad = fpDeg * DEG;
  const stations = useMemo(() => stationIds.map((id) => stationById.get(id)!).filter(Boolean).map((s) => ({ s, local: latLonToVec(s.lat, s.lon, 1.003) })), [stationIds]);
  const earthRot = useRef(0);
  const satRef = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const linkGeom = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), []);
  const link = useMemo(() => new THREE.Line(linkGeom, new THREE.LineBasicMaterial({ color: '#22c55e' })), [linkGeom]);

  // photo size and link speed decide how fast photos fly home
  const comms = budgets.parts.filter((p) => p.category === 'comms') as { downlinkMbps: number }[];
  const linkMbps = Math.max(0, ...comms.map((c) => c.downlinkMbps)) * physics.linkDistanceFactor(orbit.altitudeKm);
  const photoMb = budgets.instruments.some((i) => i.id === 'cam-hires') ? 60 : budgets.instruments.some((i) => i.id === 'cam-thermal') ? 8 : 5;
  // game time is compressed (a year in ~70 s), so each pass carries a day's worth of downlink
  const photosPerSec = (linkMbps / photoMb) * 1.5;
  const stationReach = Math.max(physics.visibilityHalfAngle(orbit.altitudeKm, 0), 25 * DEG);
  const photoValue = budgets.science.bestResolutionM !== null && budgets.science.bestResolutionM > 100 ? 0.5 : 1;
  const powerOk = budgets.power.marginPct >= 0;
  const drainRatio = budgets.power.batteryUsableWh > 0 ? budgets.power.eclipseNeedWh / budgets.power.batteryUsableWh : 9;
  const eclipseReal = (budgets.orbitInfo.eclipseMin * 60) / timeScale;
  const latBand: [number, number] = targetKind === 'fire' ? [50, 68] : [-50, 62];
  const events = useMemo(() => sim.timeline.filter((e) => e.kind !== 'launch').map((e) => ({ e, at: (e.month / sim.monthsPlanned) * DURATION })), [sim]);

  const subLonLat = () => {
    const s = g.current.sub;
    return { lat: Math.asin(THREE.MathUtils.clamp(s.y, -1, 1)) / DEG, lon: Math.atan2(s.z, -s.x) / DEG - 180 };
  };

  const spawn = (bonus = false) => {
    const s = g.current;
    const near = bonus || Math.random() < 0.7;
    const sub = subLonLat();
    const clampLat = (x: number) => THREE.MathUtils.clamp(x, latBand[0], latBand[1]);
    const lat = near ? clampLat(sub.lat + (Math.random() * 40 - 20)) : latBand[0] + Math.random() * (latBand[1] - latBand[0]);
    const L = near ? sub.lon + (Math.random() * 70 - 20) : Math.random() * 360 - 180;
    s.targets.push({ id: s.nextId++, vec: latLonToVec(lat, L, 1.004), born: s.t, bonus });
  };

  const handleEvent = (e: TimelineEvent) => {
    const s = g.current;
    const say = (text: string, sec = 3) => { s.flash = { text, until: s.t + sec }; };
    switch (e.kind) {
      case 'solar-storm': onStorm(); break;
      case 'glitch': s.camOffUntil = s.t + 3; say('💻 ' + msg(e.title)); break;
      case 'opportunity': for (let k = 0; k < 4; k++) spawn(true); say('🌋 ' + msg(e.title) + '!'); break;
      case 'failure':
        if (e.severity === 'bad' && /camera|imager|telescope/i.test(e.title)) s.camBroken = true;
        say((e.severity === 'info' ? '🛟 ' : '⚠️ ') + msg(e.text), 4);
        break;
      case 'end': case 'reentry':
        if (e.severity === 'fatal') { s.endText = e.text; onEnd(); }
        break;
      default: say(msg(e.title));
    }
  };

  let hudTick = 0;
  useFrame((_, dtRaw) => {
    const s = g.current;
    if (s.ended || s.paused) return;
    const dt = Math.min(dtRaw, 0.1);
    s.t += dt;
    if (s.t >= DURATION) { onEnd(); return; }
    while (s.evIdx < events.length && events[s.evIdx].at <= s.t) handleEvent(events[s.evIdx++].e);
    if (s.ended || s.paused) return;

    const simT = s.t * timeScale;
    earthRot.current = (simT / 86164) * Math.PI * 2;
    s.earthRot = earthRot.current;
    const u = isGeo ? earthRot.current + Math.PI / 2.2 : (simT / period) * Math.PI * 2;
    orbitPos(r, u, inc, raan, s.sat);
    s.sub.copy(s.sat).normalize().applyAxisAngle(UP, -earthRot.current); // Earth-fixed sub-satellite point

    if (satRef.current) { satRef.current.position.copy(s.sat); satRef.current.lookAt(0, 0, 0); }
    const dir = s.sat.clone().normalize();
    if (ring.current) {
      ring.current.position.copy(dir.clone().multiplyScalar(Math.cos(fpRad) * 1.006));
      ring.current.lookAt(dir.clone().multiplyScalar(2));
    }
    const camDist = Math.max(2.9, r + 1.7);
    const want = dir.clone().multiplyScalar(camDist).add(new THREE.Vector3(0, 0.35, 0));
    camera.position.lerp(want, 0.35);
    camera.lookAt(0, 0, 0);

    // energy: battery drains in shadow, recharges in sunlight
    s.shadow = inShadow(s.sat);
    if (s.shadow) s.battery -= (100 * drainRatio * dt) / Math.max(eclipseReal, 0.5);
    else if (powerOk) s.battery += 22 * dt;
    if (s.battery <= 0 && s.battery + 50 * dt > 0) s.batteryOuts++;
    s.battery = THREE.MathUtils.clamp(s.battery, 0, 100);

    // radio contact with any ground station above 10° elevation
    let contact: (typeof stations)[number] | null = null;
    for (const st of stations) {
      if (st.local.angleTo(s.sub) < stationReach) { contact = st; break; }
    }
    s.contact = contact?.s.name ?? null;
    link.visible = !!contact;
    if (contact) {
      linkGeom.setFromPoints([contact.local.clone().applyAxisAngle(UP, earthRot.current), s.sat]);
      const sent = Math.min(s.memory, photosPerSec * dt);
      s.memory -= sent;
      s.delivered += sent;
    }

    // targets
    if (s.t >= s.nextSpawn && s.targets.length < 12) { spawn(); s.nextSpawn = s.t + 1.1; }
    s.targets = s.targets.filter((tg) => s.t - tg.born < 12);
    if (++hudTick % 6 === 0) setTargets([...s.targets]);
  });

  const tap = (tg: Target) => {
    const s = g.current;
    if (s.ended || s.paused) return;
    if (s.camBroken) { s.flash = { text: '💥', until: s.t + 1 }; return; }
    if (s.battery <= 0) { s.flash = { text: '🪫', until: s.t + 1 }; return; }
    if (s.t < s.camOffUntil) return;
    const angle = tg.vec.clone().normalize().angleTo(s.sub);
    if (angle > fpRad) { s.missedFar++; s.flash = { text: tt('Too far! Wait until it is inside the green circle.'), until: s.t + 1.5 }; return; }
    s.targets = s.targets.filter((x) => x.id !== tg.id);
    setTargets([...s.targets]);
    s.captured++;
    s.memory += photoValue * (tg.bonus ? 2 : 1);
    s.battery = Math.max(0, s.battery - 1.5);
    s.flash = { text: photoValue < 1 ? tt('📸 Blurry photo… (too high up)') : tg.bonus ? '📸 +2!' : '📸 +1', until: s.t + 1 };
  };

  // test hook (dev only): capture the nearest target inside the circle
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__flight = g.current;
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__tapNearest = () => {
    const tg = [...g.current.targets].sort((a, b) => a.vec.angleTo(g.current.sub) - b.vec.angleTo(g.current.sub))[0];
    if (tg) tap(tg);
  };

  return (
    <>
      <color attach="background" args={['#02040a']} />
      <Stars radius={120} depth={60} count={3000} factor={4} fade />
      <ambientLight intensity={0.2} />
      <directionalLight position={SUN.clone().multiplyScalar(10)} intensity={2.2} />
      <Earth rotation={earthRot} />
      <EarthFixed rotation={earthRot}>
        {stations.map(({ s, local }) => (
          <group key={s.id} position={local}>
            <mesh><sphereGeometry args={[0.03, 12, 12]} /><meshBasicMaterial color="#facc15" /></mesh>
            <mesh position={local.clone().normalize().multiplyScalar(0.04)}><sphereGeometry args={[0.06, 16, 16]} /><meshBasicMaterial color="#facc15" transparent opacity={0.25} /></mesh>
          </group>
        ))}
        {targets.map((tg) => (
          <TargetMarker key={tg.id} tg={tg} kind={targetKind} g={g} onTap={() => tap(tg)} />
        ))}
      </EarthFixed>
      <mesh ref={ring}>
        <ringGeometry args={[Math.sin(fpRad) * 0.97, Math.sin(fpRad), 64]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <primitive object={link} />
      <group ref={satRef}>
        <mesh><boxGeometry args={[0.05, 0.05, 0.05]} /><meshStandardMaterial color="#ffd36b" emissive="#ffb300" emissiveIntensity={0.8} /></mesh>
        <mesh position={[0.08, 0, 0]}><boxGeometry args={[0.1, 0.004, 0.05]} /><meshStandardMaterial color="#2c4fa3" /></mesh>
        <mesh position={[-0.08, 0, 0]}><boxGeometry args={[0.1, 0.004, 0.05]} /><meshStandardMaterial color="#2c4fa3" /></mesh>
      </group>
    </>
  );
}

function TargetMarker({ tg, kind, g, onTap }: { tg: Target; kind: 'fire' | 'sight'; g: React.MutableRefObject<G>; onTap(): void }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const age = g.current.t - tg.born;
    const pulse = 1 + Math.sin(age * 8) * 0.18;
    const fade = age > 9 ? Math.max(0.2, 1 - (age - 9) / 3) : 1;
    ref.current.scale.setScalar(pulse * fade);
  });
  const color = kind === 'fire' ? (tg.bonus ? '#ff2d55' : '#ff6a00') : tg.bonus ? '#ff2d55' : '#ffd400';
  return (
    <group ref={ref} position={tg.vec} onPointerDown={(e) => { e.stopPropagation(); onTap(); }}>
      <mesh>
        {kind === 'fire' ? <coneGeometry args={[0.05, 0.11, 10]} /> : <octahedronGeometry args={[0.055]} />}
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
    </group>
  );
}
