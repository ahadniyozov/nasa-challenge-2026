// 3D view of the satellite for the build screen (BuildScreen in Game2D.tsx keeps the slots, gauges and GO button).
// SatelliteModel with mouse/touch rotation, slow auto-rotation and a camera fly-to on the open slot.
// Lit like a clean room: light background, soft floor grid.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Build, SlotId } from '../game2d/config';
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
    // the build screen shows the model in a panel, not full screen: stand a bit further back from a focused part
    goalPos.set(camPos[0], camPos[1], camPos[2]);
    if (focus) goalPos.sub(goalTarget).multiplyScalar(1.7).add(goalTarget);
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
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#ffffff', '#c9ced3', 0.9]} />
      <directionalLight position={[4, 6, 4]} intensity={2.2} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        minDistance={1.1}
        maxDistance={6.5}
        autoRotate={focus === null}
        autoRotateSpeed={0.8}
      />
      <HangarCameraRig focus={focus} build={build} mission={mission} controlsRef={controlsRef} />

      <group position={[0, 0.08, 0]}>
        <SatelliteModel build={build} mission={mission} focus={focus} />
      </group>

    </>
  );
}

export interface HangarViewProps { build: Build; mission: Mission; focus: SlotId | null }

/** The 3D satellite on the build screen. Loaded lazily; SatelliteArt (the 2D drawing) shows while it loads or if WebGL fails. */
export function HangarView({ build, mission, focus }: HangarViewProps) {
  return (
    <div className="g3d-hangar-canvas">
      <Canvas camera={{ position: [2.2, 1.3, 2.6], fov: 44 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <HangarStage build={build} mission={mission} focus={focus} />
      </Canvas>
    </div>
  );
}
