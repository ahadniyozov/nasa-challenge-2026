// 3D satellite assembly screen (replaces SatelliteArt with interactive 3D hangar).
// Left: 3D SatelliteModel with mouse/touch rotation, auto-rotation, and smooth camera fly-to on slot focus.
// Right & Footer: exact same slots, gauges, blockers, and Launch button as BuildScreen in Game2D.tsx.
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useT } from '../i18n';
import { analyse, slotsFor, type Build, type SlotId } from '../game2d/config';
import type { Mission } from '../game2d/missions';
import { getSlotFocusTarget, SatelliteModel } from './SatelliteModel';
import './game3d.css';

type OrbitControlsHandle = React.ComponentRef<typeof OrbitControls>;

function HangarCameraRig({
  focus,
  build,
  mission,
  controlsRef,
}: {
  focus: SlotId | null;
  build: Build;
  mission: Mission;
  controlsRef: React.RefObject<OrbitControlsHandle | null>;
}) {
  const { camera } = useThree();
  const goalPos = useMemo(() => new THREE.Vector3(), []);
  const goalTarget = useMemo(() => new THREE.Vector3(), []);
  const animLeft = useRef(0);

  useEffect(() => {
    const { target, camPos } = getSlotFocusTarget(focus, build, mission);
    goalTarget.set(target[0], target[1], target[2]);
    goalPos.set(camPos[0], camPos[1], camPos[2]);
    animLeft.current = 0.65;
  }, [focus, build.body, build.panels, build.camera, build.antenna, mission, goalPos, goalTarget]);

  useFrame((_, dt) => {
    if (animLeft.current <= 0) return;
    animLeft.current = Math.max(0, animLeft.current - dt);
    const k = Math.min(1, dt * 6.5);
    camera.position.lerp(goalPos, k);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(goalTarget, k);
      controlsRef.current.update();
    } else {
      camera.lookAt(goalTarget);
    }
  });

  return null;
}

/** Test hook for scripts/model-shots.mjs: triangles of the visible satellite model (budget ≤ 3000). */
function ModelStats() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__g3dModelTriangles = () => {
      let n = 0;
      scene.getObjectByName('satellite-root')?.traverseVisible((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const g = mesh.geometry;
        n += (g.index ? g.index.count : g.attributes.position.count) / 3;
      });
      return Math.round(n);
    };
    return () => { delete w.__g3dModelTriangles; };
  }, [scene]);
  return null;
}

function HangarStage({ build, mission, focus }: { build: Build; mission: Mission; focus: SlotId | null }) {
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  return (
    <>
      <ModelStats />
      <color attach="background" args={['#060b22']} />
      <Stars radius={70} depth={30} count={1200} factor={3} fade />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#bcd4ff', '#141a38', 0.85]} />
      <directionalLight position={[4, 6, 4]} intensity={2.1} />
      <directionalLight position={[-4, -2, -3]} intensity={0.7} color="#4dd2ff" />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={1.1}
        maxDistance={6.5}
        autoRotate={focus === null}
        autoRotateSpeed={1.2}
      />
      <HangarCameraRig focus={focus} build={build} mission={mission} controlsRef={controlsRef} />

      <group position={[0, 0.08, 0]}>
        <SatelliteModel build={build} mission={mission} focus={focus} />
      </group>

      <Grid
        position={[0, -1.25, 0]}
        args={[14, 14]}
        cellColor="#1b3168"
        sectionColor="#3568b8"
        fadeDistance={11}
        infiniteGrid
      />
    </>
  );
}

export interface Hangar3DProps {
  m: Mission;
  build: Build;
  setBuild(b: Build): void;
  focus: SlotId | null;
  setFocus(s: SlotId | null): void;
  onLaunch(): void;
}

export function Hangar3D({ m, build, setBuild, focus, setFocus, onLaunch }: Hangar3DProps) {
  const { t } = useT();
  const a = useMemo(() => analyse(build, m), [build, m]);
  const slots = useMemo(() => slotsFor(m), [m]);
  const busName = {
    'cubesat-3u': 'Tiny (3U)',
    'cubesat-12u': 'Medium (12U)',
    smallsat: 'Large (150 kg)',
    'medium-bus': 'Huge (800 kg)',
  }[a.design.busId] ?? a.design.busId;
  const face = { good: '🙂', warn: '😬', bad: '😱' } as const;

  const focusedSlot = focus ? slots.find((s) => s.id === focus) : undefined;

  const slotRow = (id: SlotId) => {
    const slot = slots.find((s) => s.id === id)!;
    const chosen = slot.options.find((o) => o.id === build[id]) ?? slot.options[0];
    const open = focus === id;
    return (
      <div key={id} className={`g2d-slot ${open ? 'open' : ''}`}>
        <button className="g2d-slot-head" onClick={() => setFocus(open ? null : id)}>
          <span className="e">{slot.emoji}</span>
          <b>{t(slot.title)}</b>
          <span className="v">{chosen.emoji} {t(chosen.title)}</span>
          <span className="chev">{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div className="g2d-opts">
            {slot.options.map((o) => (
              <button
                key={o.id}
                className={`g2d-opt ${build[id] === o.id ? 'on' : ''}`}
                onClick={() => setBuild({ ...build, [id]: o.id })}
              >
                <span className="e">{o.emoji}</span>
                <b>{t(o.title)}</b>
                {o.text && <small>{t(o.text)}</small>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const sat = slots.filter((s) => s.group === 'satellite');
  const mis = slots.filter((s) => s.group === 'mission');

  return (
    <div className="g2d-build">
      <div className="g2d-art g3d-hangar-art">
        <div className="g3d-hangar-canvas">
          <Canvas camera={{ position: [2.2, 1.3, 2.6], fov: 44 }} dpr={[1, 1.5]}>
            <Suspense fallback={null}>
              <HangarStage build={build} mission={m} focus={focus} />
            </Suspense>
          </Canvas>
        </div>
        {focusedSlot && (
          <div className="g3d-focus-pill">
            {focusedSlot.emoji} {t(focusedSlot.title)}
          </div>
        )}
        <div className="g3d-hangar-hud">
          <div className="g2d-size">
            {t('Satellite size')}: <b>{t(busName)}</b> · {Math.round(a.flight.massKg)} {t('kg')}
          </div>
          {m.slots.length < 6 && (
            <div className="g2d-size">
              {t('On this mission you choose only {n} things - the rest is ready.', { n: m.slots.length })}
            </div>
          )}
        </div>
      </div>

      <div className="g2d-slots">
        {sat.length > 0 && <h3>{t('🛰️ Satellite')}</h3>}
        {sat.map((s) => slotRow(s.id))}
        {mis.length > 0 && <h3>{t('🚀 Mission')}</h3>}
        {mis.map((s) => slotRow(s.id))}
      </div>

      <footer className="g2d-foot">
        <div className="g2d-gauges">
          {a.gauges.map((g) => (
            <div key={g.id} className={`g2d-gauge ${g.level}`} title={t(g.detail, g.params)}>
              <div className="top">
                <span>{g.emoji} {t(g.label)}</span>
                <span>{face[g.level]}</span>
              </div>
              <div className="track">
                <div style={{ width: `${Math.min(100, Math.max(4, g.value * 100))}%` }} />
              </div>
              <small>{t(g.detail, g.params)}</small>
            </div>
          ))}
        </div>
        <div className="g2d-launch">
          {a.blockers.map((b) => (
            <div key={b} className="g2d-blocker">⛔ {t(b)}</div>
          ))}
          <button className="r-btn" disabled={!a.canLaunch} onClick={onLaunch}>
            {t('🚀 Launch!')}
          </button>
        </div>
      </footer>
    </div>
  );
}
