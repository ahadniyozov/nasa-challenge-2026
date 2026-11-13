// "Orbital Runner" prototype: the satellite flies its orbit like a runner character.
// Day/shadow length comes from the real orbit (engine physics); photos count only when sent home over a station.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { physics } from '@mission/engine';
import { useT } from '../i18n';

// ---- tuning -------------------------------------------------------------
const ALTITUDE_KM = 550;
const ORBIT_SEC = 30; // one real orbit (~96 min) squeezed into 30 s
const ORBITS = 3;
const MISSION_SEC = ORBIT_SEC * ORBITS;
const ECLIPSE = physics.eclipseFraction(ALTITUDE_KM); // ≈0.36 of every orbit is in Earth's shadow
const SHADOW_FROM = 0.5 - ECLIPSE / 2;
const SHADOW_TO = 0.5 + ECLIPSE / 2;
const LANES = [-2.4, 0, 2.4];
const SAT_Y = 2.2;
const SPAWN_Z = -70;
const R_EARTH = 80; // ground cylinder radius
const GOAL = 8;
const MEMORY = 6;
const MAX_HP = 3;
const STATION_PHASES = [0.18, 0.62];
const STORM_AT = 48;

const BATTERY = { sunCharge: 16, shadowDrain: 8.5, photo: 3, transfer: 5 };
const TRANSFER_PER_SEC = 4;

type Kind = 'debris' | 'target' | 'station';
interface Obj { id: number; kind: Kind; lane: number; z: number; done: boolean; spin: number }

interface Game {
  t: number; speed: number; lane: number; x: number;
  battery: number; asleepUntil: number; safe: boolean;
  hp: number; invulnUntil: number; memory: number; delivered: number; captured: number;
  objs: Obj[]; nextId: number; nextDebris: number; nextTarget: number; stationsSpawned: Set<string>;
  storm: 'none' | 'warning' | 'active' | 'over'; stormTick: number;
  contact: boolean; ended: boolean;
  stats: { hits: number; sleeps: number; memoryFull: number; nightTargets: number; stormHits: number };
  flash: { text: string; until: number } | null;
}

const phaseAt = (t: number) => (t / ORBIT_SEC) % 1;
const isShadow = (t: number) => { const p = phaseAt(t); return p > SHADOW_FROM && p < SHADOW_TO; };
const groundY = (z: number) => -(z * z) / (2 * R_EARTH); // curvature of the planet ahead

function newGame(): Game {
  return {
    t: 0, speed: 16, lane: 1, x: 0, battery: 100, asleepUntil: 0, safe: false,
    hp: MAX_HP, invulnUntil: 0, memory: 0, delivered: 0, captured: 0,
    objs: [], nextId: 1, nextDebris: 2, nextTarget: 1, stationsSpawned: new Set(),
    storm: 'none', stormTick: 0, contact: false, ended: false,
    stats: { hits: 0, sleeps: 0, memoryFull: 0, nightTargets: 0, stormHits: 0 },
    flash: null,
  };
}

export interface RunResult { delivered: number; captured: number; lostInMemory: number; survived: boolean; stats: Game['stats'] }

// ======================================================================
export function RunnerGame({ links }: { links: React.ReactNode }) {
  const { t } = useT();
  const [screen, setScreen] = useState<'start' | 'play' | 'result'>('start');
  const [result, setResult] = useState<RunResult | null>(null);
  const [runId, setRunId] = useState(0);
  const idleGame = useRef(newGame());

  const start = () => { setResult(null); setRunId((n) => n + 1); setScreen('play'); };

  return (
    <div className="runner">
      <header className="runner-top">
        <div className="logo">GO<span>/</span>NO-GO <small>{t('Orbital Runner')}</small></div>
        <div className="runner-links">{links}</div>
      </header>
      {screen === 'play' ? (
        <Run key={runId} onEnd={(r) => { setResult(r); setScreen('result'); }} />
      ) : (
        <div className="runner-stage">
          <Canvas camera={{ position: [0, 6.2, 7.5], fov: 58 }} dpr={[1, 2]}>
        <CameraFit />
            <Suspense fallback={null}><World g={idleGame} idle /></Suspense>
          </Canvas>
          {screen === 'start' ? <StartCard onPlay={start} /> : <ResultCard r={result!} onAgain={start} />}
        </div>
      )}
    </div>
  );
}

function StartCard({ onPlay }: { onPlay(): void }) {
  const { t } = useT();
  return (
    <div className="r-card">
      <div className="r-emoji">🛰️</div>
      <h1>{t('Orbital Runner')}</h1>
      <p>{t('Fly your satellite around the Earth. Photograph targets and send the photos home.')}</p>
      <div className="r-rules">
        <div><b>◀ ▶</b><span>{t('Dodge space junk')}</span></div>
        <div><b>📸</b><span>{t('Fly over ⭐ in daylight to take a photo')}</span></div>
        <div><b>📡</b><span>{t('Photos count only after you fly over a station')}</span></div>
        <div><b>🌑</b><span>{t('In Earth\'s shadow there is no sun - the battery drains')}</span></div>
      </div>
      <button className="r-btn" onClick={onPlay}>{t('▶ Launch!')}</button>
      <small className="r-keys">{t('Keys: ← → or A D · Space = safe mode · on phone: tap left/right')}</small>
    </div>
  );
}

function ResultCard({ r, onAgain }: { r: RunResult; onAgain(): void }) {
  const { t } = useT();
  const stars = (r.survived ? 1 : 0) + (r.delivered >= GOAL ? 1 : 0) + (r.delivered >= GOAL * 2 ? 1 : 0);
  const lessons: string[] = [];
  if (r.lostInMemory > 0) lessons.push(t('{n} photos were still in memory at the end - they never reached Earth. Fly over stations more often or carry a faster antenna.', { n: r.lostInMemory }));
  if (r.stats.sleeps > 0) lessons.push(t('The battery ran flat in Earth\'s shadow {n} time(s). A bigger battery or bigger solar panels would help.', { n: r.stats.sleeps }));
  if (r.stats.memoryFull > 0) lessons.push(t('Memory was full {n} time(s), so new photos were lost. More memory or more stations!', { n: r.stats.memoryFull }));
  if (r.stats.nightTargets > 0) lessons.push(t('{n} targets passed in the dark. A normal camera needs sunlight - a heat camera could see at night.', { n: r.stats.nightTargets }));
  if (r.stats.stormHits > 0) lessons.push(t('The solar storm hit you {n} time(s). Safe mode (Space) protects the electronics.', { n: r.stats.stormHits }));
  if (r.stats.hits > 0 && r.stats.hits !== r.stats.stormHits) lessons.push(t('Space junk is real: over 30,000 tracked pieces orbit Earth. Satellites dodge them with small thrusters.'));
  if (!lessons.length) lessons.push(t('Perfect run! Every photo made it home.'));
  return (
    <div className="r-card">
      <div className="stars">{[0, 1, 2].map((i) => <span key={i} className={i < stars ? 'on' : ''}>★</span>)}</div>
      <h1>{r.delivered >= GOAL ? t('Mission complete!') : r.survived ? t('Not enough photos') : t('Satellite lost')}</h1>
      <div className="r-big">📡 {r.delivered} / {GOAL} <small>{t('photos delivered')}</small></div>
      <div className="r-lessons">{lessons.map((l, i) => <p key={i}>💡 {l}</p>)}</div>
      <button className="r-btn" onClick={onAgain}>{t('🔁 One more run')}</button>
      <small className="r-keys">{t('Next step: a garage with upgrades between runs.')}</small>
    </div>
  );
}

// ======================================================================
function Run({ onEnd }: { onEnd(r: RunResult): void }) {
  const { t } = useT();
  const g = useRef<Game>(newGame());
  const [hud, setHud] = useState(() => snapshot(g.current));

  const end = () => {
    const s = g.current;
    if (s.ended) return;
    s.ended = true;
    setTimeout(() => onEnd({ delivered: Math.floor(s.delivered), captured: s.captured, lostInMemory: Math.round(s.memory), survived: s.hp > 0, stats: s.stats }), 600);
  };

  // controls
  useEffect(() => {
    const move = (d: number) => { const s = g.current; if (s.t < s.asleepUntil) return; s.lane = THREE.MathUtils.clamp(s.lane + d, 0, 2); };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A', 'ф', 'Ф'].includes(e.key)) move(-1);
      else if (['ArrowRight', 'd', 'D', 'в', 'В'].includes(e.key)) move(1);
      else if (e.key === ' ') { e.preventDefault(); g.current.safe = !g.current.safe; }
    };
    window.addEventListener('keydown', onKey);
    (window as unknown as Record<string, unknown>).__runner = { g: g.current, move };
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { const id = setInterval(() => setHud(snapshot(g.current)), 100); return () => clearInterval(id); }, []);

  const tapMove = (d: number) => { const s = g.current; if (s.t >= s.asleepUntil) s.lane = THREE.MathUtils.clamp(s.lane + d, 0, 2); };
  const phase = phaseAt(hud.t);
  const toShadow = hud.shadow ? 0 : ((SHADOW_FROM - phase + 1) % 1) * ORBIT_SEC;
  const toSun = hud.shadow ? (SHADOW_TO - phase) * ORBIT_SEC : 0;

  return (
    <div className="runner-stage">
      <Canvas camera={{ position: [0, 6.2, 7.5], fov: 58 }} dpr={[1, 2]}>
        <CameraFit />
        <Suspense fallback={null}><World g={g} onEnd={end} /></Suspense>
      </Canvas>

      <div className={`r-dim ${hud.shadow ? 'on' : ''}`} />
      {hud.storm === 'active' && <div className="r-storm" />}

      {/* top HUD */}
      <div className="r-hud top">
        <div className="r-goal"><b>📡 {Math.floor(hud.delivered)} / {GOAL}</b><small>{t('photos delivered')}</small></div>
        <div className="r-mem" title={t('Memory')}>
          📷 {Array.from({ length: MEMORY }, (_, i) => <span key={i} className={i < Math.round(hud.memory) ? 'full' : ''} />)}
        </div>
        <div className="r-hp">{Array.from({ length: MAX_HP }, (_, i) => <span key={i}>{i < hud.hp ? '❤️' : '🖤'}</span>)}</div>
        <div className="r-orbit">
          <small>{t('Orbit {n} of {m}', { n: Math.min(ORBITS, Math.floor(hud.t / ORBIT_SEC) + 1), m: ORBITS })}</small>
          <div className="r-strip">
            <div className="shadow" style={{ left: `${SHADOW_FROM * 100}%`, width: `${ECLIPSE * 100}%` }} />
            {STATION_PHASES.map((p) => <i key={p} style={{ left: `${p * 100}%` }}>📡</i>)}
            <div className="you" style={{ left: `${phase * 100}%` }} />
          </div>
        </div>
      </div>

      {/* bottom HUD */}
      <div className="r-hud bottom">
        <div className={`r-chip ${hud.shadow ? 'night' : 'day'}`}>
          {hud.shadow ? t('🌑 Shadow · sun in {s} s', { s: Math.ceil(toSun) }) : t('☀️ Charging · shadow in {s} s', { s: Math.ceil(toShadow) })}
        </div>
        <div className="r-battery">
          🔋<div className="r-bar"><div className={hud.battery < 25 ? 'low' : ''} style={{ width: `${hud.battery}%` }} /></div>
        </div>
        {hud.contact && <div className="r-chip contact">{t('📡 Sending photos home!')}</div>}
        <button className={`r-chip safe ${hud.safe ? 'on' : ''}`} onClick={() => { g.current.safe = !g.current.safe; }}>
          {hud.safe ? t('🛡️ Safe mode ON') : t('🛡️ Safe mode')}
        </button>
      </div>

      {hud.storm === 'warning' && <div className="r-warn">{t('☀️ SOLAR STORM in 3 s! Press Space for safe mode')}</div>}
      {hud.asleep && <div className="r-warn sleep">{t('🪫 Battery empty - satellite is asleep…')}</div>}
      {hud.flash && <div className="r-flash">{hud.flash}</div>}
      {hud.t < 6 && <div className="r-tip">{t('Fly over the ⭐ to take photos, then over 📡 to send them home!')}</div>}

      <div className="r-touch">
        <button onPointerDown={() => tapMove(-1)} aria-label="left">◀</button>
        <button onPointerDown={() => tapMove(1)} aria-label="right">▶</button>
      </div>
    </div>
  );
}

function snapshot(s: Game) {
  return {
    t: s.t, battery: s.battery, hp: s.hp, memory: s.memory, delivered: s.delivered, safe: s.safe, contact: s.contact,
    shadow: isShadow(s.t), storm: s.storm, asleep: s.t < s.asleepUntil,
    flash: s.flash && s.flash.until > s.t ? s.flash.text : null,
  };
}

/** Keep all three lanes on screen: pull the camera back on tall (phone) screens. */
function CameraFit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const k = aspect < 1 ? 1 / aspect : 1;
    cam.fov = aspect < 1 ? 66 : 58;
    cam.position.set(0, 6.2 * Math.min(k, 1.9), 7.5 * Math.min(k, 1.9));
    cam.lookAt(0, 0.6, -7);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

// ======================================================================
function World({ g, onEnd, idle = false }: { g: React.MutableRefObject<Game>; onEnd?: () => void; idle?: boolean }) {
  const { t } = useT();
  const [objs, setObjs] = useState<Obj[]>([]);
  const refs = useRef(new Map<number, THREE.Group>());
  const sat = useRef<THREE.Group>(null);
  const satGlow = useRef<THREE.MeshStandardMaterial>(null);
  const shield = useRef<THREE.Mesh>(null);
  const ground = useRef<THREE.Mesh>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  const [day, night] = useLoader(THREE.TextureLoader, ['/textures/earth-day.webp', '/textures/earth-night.webp']);
  day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
  day.wrapS = night.wrapS = THREE.RepeatWrapping;
  const uniforms = useMemo(() => ({ dayMap: { value: day }, nightMap: { value: night }, light: { value: 1 } }), [day, night]);
  const bg = useMemo(() => new THREE.Color(), []);

  const spawn = (kind: Kind, lane: number) => {
    const s = g.current;
    s.objs.push({ id: s.nextId++, kind, lane, z: SPAWN_Z, done: false, spin: Math.random() * 6 });
    setObjs([...s.objs]);
  };
  const say = (text: string, sec = 1.4) => { g.current.flash = { text, until: g.current.t + sec }; };

  useFrame((_, dtRaw) => {
    const s = g.current;
    const dt = Math.min(dtRaw, 0.05);
    if (!idle && !s.ended) s.t += dt;
    const time = idle ? (performance.now() / 1000) % MISSION_SEC : s.t;
    const shadow = isShadow(time);
    const speed = idle ? 10 : s.speed + s.t * 0.06;

    // ground scroll + day/night look
    if (ground.current) ground.current.rotation.x += (speed * dt) / R_EARTH;
    const targetLight = shadow ? 0 : 1;
    uniforms.light.value += (targetLight - uniforms.light.value) * Math.min(1, dt * 2.5);
    bg.setRGB(0.01 + 0.05 * uniforms.light.value, 0.02 + 0.08 * uniforms.light.value, 0.06 + 0.16 * uniforms.light.value);
    scene.background = bg;
    if (sun.current) sun.current.intensity = 0.3 + 2.2 * uniforms.light.value;

    if (idle || s.ended) return;

    // end of mission
    if (s.t >= MISSION_SEC || s.hp <= 0) { onEnd?.(); return; }
    const asleep = s.t < s.asleepUntil;

    // battery
    if (shadow) s.battery -= BATTERY.shadowDrain * dt;
    else s.battery += BATTERY.sunCharge * dt;
    if (s.battery <= 0 && !asleep) {
      s.battery = 0; s.asleepUntil = s.t + 3; s.stats.sleeps++;
    }
    s.battery = THREE.MathUtils.clamp(s.battery, 0, 100);

    // storm event
    if (s.storm === 'none' && s.t >= STORM_AT - 3) s.storm = 'warning';
    if (s.storm === 'warning' && s.t >= STORM_AT) { s.storm = 'active'; s.stormTick = s.t + 0.8; }
    if (s.storm === 'active') {
      if (s.t >= s.stormTick) {
        s.stormTick = s.t + 1.2;
        if (!s.safe) { s.hp--; s.stats.hits++; s.stats.stormHits++; say(t('⚡ Radiation hit! Use safe mode!')); }
      }
      if (s.t >= STORM_AT + 5) { s.storm = 'over'; say(t('The storm is over - turn safe mode off')); }
    }

    // spawning
    if (s.t >= s.nextDebris) {
      const lanes = Math.random() < 0.25 ? [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, 2) : [Math.floor(Math.random() * 3)];
      lanes.forEach((l) => spawn('debris', l));
      s.nextDebris = s.t + Math.max(0.7, 1.5 - s.t * 0.008);
    }
    if (s.t >= s.nextTarget) {
      // fewer targets in the dark - just enough to show that a normal camera needs sunlight
      if (!isShadow(s.t + -SPAWN_Z / speed) || Math.random() < 0.3) spawn('target', Math.floor(Math.random() * 3));
      s.nextTarget = s.t + 1.2 + Math.random() * 0.8;
    }
    const orbit = Math.floor(s.t / ORBIT_SEC);
    const lead = -SPAWN_Z / speed / ORBIT_SEC; // spawn early so the station arrives at its phase
    STATION_PHASES.forEach((p, i) => {
      const key = `${orbit}-${i}`;
      if (!s.stationsSpawned.has(key) && phaseAt(s.t) >= p - lead && phaseAt(s.t) < p) { s.stationsSpawned.add(key); spawn('station', 1); }
    });

    // movement
    s.x += (LANES[s.lane] - s.x) * Math.min(1, dt * 12);
    if (sat.current) {
      sat.current.position.set(s.x, SAT_Y + Math.sin(s.t * 3) * 0.06, 0);
      sat.current.rotation.z = (LANES[s.lane] - s.x) * -0.25;
      const blink = s.t < s.invulnUntil && Math.floor(s.t * 12) % 2 === 0;
      sat.current.visible = !blink;
    }
    if (satGlow.current) satGlow.current.emissiveIntensity = asleep ? 0 : shadow ? 0.3 : 1;
    if (shield.current) shield.current.visible = s.safe;

    // objects
    let contact = false;
    let changed = false;
    for (const o of s.objs) {
      o.z += speed * dt;
      const ref = refs.current.get(o.id);
      const sameLane = Math.abs(LANES[o.lane] - s.x) < 1.1;
      if (o.kind === 'debris') {
        if (ref) { ref.position.set(LANES[o.lane], SAT_Y + groundY(o.z) * 0.3, o.z); ref.rotation.set(o.spin + s.t * 2, o.spin + s.t * 1.3, 0); }
        if (!o.done && Math.abs(o.z) < 0.7 && sameLane && s.t > s.invulnUntil) {
          o.done = true;
          if (s.safe) { say(t('🛡️ Shield took the hit')); s.safe = false; }
          else { s.hp--; s.stats.hits++; s.invulnUntil = s.t + 1.2; s.memory = Math.max(0, s.memory - 1); say(t('💥 Hit by space junk! Lost a photo')); }
        }
      } else if (o.kind === 'target') {
        if (ref) ref.position.set(LANES[o.lane], groundY(o.z) + 0.05, o.z);
        if (!o.done && o.z > -0.5) {
          o.done = true;
          if (!sameLane) { /* missed */ }
          else if (shadow) { s.stats.nightTargets++; say(t('🌑 Too dark for the camera!')); }
          else if (asleep || s.safe) say(t('📷 Camera is off'));
          else if (s.memory >= MEMORY) { s.stats.memoryFull++; say(t('💾 Memory full! Find a station')); }
          else { s.memory++; s.captured++; s.battery -= BATTERY.photo; say('📸 +1', 0.8); changed = true; }
          if (ref) ref.visible = false;
        }
      } else {
        if (ref) ref.position.set(0, groundY(o.z), o.z);
        if (o.z > -14 && o.z < 4) contact = true;
      }
    }
    s.contact = contact && !asleep && !s.safe;
    if (s.contact && s.memory > 0) {
      const sent = Math.min(s.memory, TRANSFER_PER_SEC * dt);
      s.memory -= sent; s.delivered += sent; s.battery -= BATTERY.transfer * dt;
    }
    const before = s.objs.length;
    s.objs = s.objs.filter((o) => o.z < 8);
    if (before !== s.objs.length || changed) setObjs([...s.objs]);
  });

  return (
    <>
      <Stars radius={150} depth={50} count={2500} factor={4} fade />
      <ambientLight intensity={0.35} />
      <directionalLight ref={sun} position={[4, 10, 6]} intensity={2.2} />
      <hemisphereLight args={['#9ec5ff', '#0b1430', 0.4]} />

      {/* the planet as a giant rotating drum under the satellite */}
      <mesh ref={ground} position={[0, -R_EARTH, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[R_EARTH, R_EARTH, 40, 160, 1, true]} />
        <shaderMaterial uniforms={uniforms} side={THREE.DoubleSide}
          vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
          fragmentShader={`uniform sampler2D dayMap; uniform sampler2D nightMap; uniform float light; varying vec2 vUv;
            void main(){ vec2 uv = vec2(vUv.x * 2.0, 0.3 + vUv.y * 0.4);
              vec3 d = texture2D(dayMap, uv).rgb; vec3 n = texture2D(nightMap, uv).rgb * 1.6 + d * 0.12;
              gl_FragColor = vec4(mix(n, d * 1.25 + vec3(0.06, 0.12, 0.22), light), 1.0); }`} />
      </mesh>
      {/* lane guides */}
      {LANES.map((x) => (
        <mesh key={x} position={[x, SAT_Y - 0.9, -20]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.04, 60]} />
          <meshBasicMaterial color="#4dd2ff" transparent opacity={0.18} />
        </mesh>
      ))}

      {/* satellite */}
      <group ref={sat} position={[0, SAT_Y, 0]}>
        <mesh><boxGeometry args={[0.6, 0.5, 0.6]} /><meshStandardMaterial ref={satGlow} color="#e8b23a" metalness={0.4} roughness={0.4} emissive="#3a2600" /></mesh>
        <mesh position={[1.0, 0, 0]}><boxGeometry args={[1.2, 0.04, 0.55]} /><meshStandardMaterial color="#1d3f9e" metalness={0.5} roughness={0.3} emissive="#0d2a7a" emissiveIntensity={0.4} /></mesh>
        <mesh position={[-1.0, 0, 0]}><boxGeometry args={[1.2, 0.04, 0.55]} /><meshStandardMaterial color="#1d3f9e" metalness={0.5} roughness={0.3} emissive="#0d2a7a" emissiveIntensity={0.4} /></mesh>
        <mesh position={[0, -0.35, 0]}><cylinderGeometry args={[0.14, 0.18, 0.2, 16]} /><meshStandardMaterial color="#ddd" /></mesh>
        <mesh ref={shield} visible={false}><sphereGeometry args={[1.25, 24, 16]} /><meshBasicMaterial color="#4dd2ff" transparent opacity={0.18} /></mesh>
      </group>

      {objs.map((o) => (
        <group key={o.id} ref={(el) => { if (el) refs.current.set(o.id, el); else refs.current.delete(o.id); }} position={[LANES[o.lane], 0, SPAWN_Z]}>
          {o.kind === 'debris' && (
            <>
              <mesh><dodecahedronGeometry args={[0.45, 0]} /><meshStandardMaterial color="#8a8f99" roughness={0.9} flatShading /></mesh>
              <mesh position={[0.35, 0.2, 0]}><boxGeometry args={[0.5, 0.05, 0.25]} /><meshStandardMaterial color="#5a6170" /></mesh>
            </>
          )}
          {o.kind === 'target' && (
            <>
              <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.5, 0.75, 32]} /><meshBasicMaterial color="#ffd400" transparent opacity={0.9} side={THREE.DoubleSide} /></mesh>
              <mesh position={[0, 0.5, 0]}><octahedronGeometry args={[0.32]} /><meshBasicMaterial color="#ffd400" /></mesh>
            </>
          )}
          {o.kind === 'station' && (
            <>
              <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.08, 0.2, 1.2, 8]} /><meshStandardMaterial color="#ddd" /></mesh>
              <mesh position={[0, 1.3, 0]} rotation={[0.6, 0, 0]}><sphereGeometry args={[0.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3]} /><meshStandardMaterial color="#f2f2f2" side={THREE.DoubleSide} /></mesh>
              <mesh position={[0, 6, 0]}><cylinderGeometry args={[3.6, 0.3, 10, 24, 1, true]} /><meshBasicMaterial color="#3ddc84" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} /></mesh>
            </>
          )}
        </group>
      ))}
    </>
  );
}
