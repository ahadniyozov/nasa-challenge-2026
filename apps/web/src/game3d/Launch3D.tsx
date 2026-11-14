// 3D launch cinematic (drop-in replacement for Launch2D with the same { build, onDone } interface):
// 3-2-1 countdown → ignition & smoke → climb (sky darkens, Earth horizon appears) → stage separation
// → fairing halves split → SatelliteModel emerges and unfolds its solar panels. Duration: 8.4s (≤ 9s).
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useT } from '../i18n';
import type { Build } from '../game2d/config';
import { MISSIONS, type Mission } from '../game2d/missions';
import { SatelliteModel } from './SatelliteModel';
import { sfx } from './audio';
import './game3d.css';

interface RocketSpec {
  name: string;
  coreR: number;
  stage1H: number;
  stage2H: number;
  fairingH: number;
  boosters: boolean;
  stripeColor: string;
  satScale: number;
}

const ROCKET_SPECS: Record<string, RocketSpec> = {
  rideshare: {
    name: 'Rideshare',
    coreR: 0.25,
    stage1H: 2.1,
    stage2H: 0.9,
    fairingH: 1.0,
    boosters: false,
    stripeColor: '#3b5998',
    satScale: 0.34,
  },
  medium: {
    name: 'Medium',
    coreR: 0.34,
    stage1H: 3.0,
    stage2H: 1.2,
    fairingH: 1.25,
    boosters: false,
    stripeColor: '#2b56c9',
    satScale: 0.42,
  },
  heavy: {
    name: 'Heavy',
    coreR: 0.40,
    stage1H: 3.5,
    stage2H: 1.35,
    fairingH: 1.45,
    boosters: true,
    stripeColor: '#c0392b',
    satScale: 0.46,
  },
};

const ORBIT_KM: Record<string, number> = {
  'leo-400': 400,
  'sso-550': 550,
  'sso-800': 800,
  'meo-8000': 8000,
  geo: 35786,
};

// Timeline constants (total 8.4s <= 9s)
const T_LIFTOFF = 2.4;   // 0..2.4s: 3 - 2 - 1 countdown (0.8s each)
const T_CLIMB = 3.4;     // 2.4..3.4s: Lift-off!
const T_STAGE = 4.9;     // 3.4..4.9s: Climbing to {km} km...
const T_FAIRING = 5.9;   // 4.9..5.9s: First stage separation
const T_RELEASE = 6.8;   // 5.9..6.8s: Fairing opens
const T_END = 8.4;       // 6.8..8.4s: Satellite released - in orbit!

const N_SMOKE = 56;

function LaunchWorld({
  build,
  mission,
  onPhaseText,
  onFinish,
}: {
  build: Build;
  mission: Mission;
  onPhaseText(key: string): void;
  onFinish(): void;
}) {
  const spec = ROCKET_SPECS[build.rocket] ?? ROCKET_SPECS.rideshare;
  const { scene, camera } = useThree();

  const elapsed = useRef(0);
  const done = useRef(false);
  const lastPhase = useRef('');

  const vehicleRef = useRef<THREE.Group>(null);
  const stage1Ref = useRef<THREE.Group>(null);
  const boosterLRef = useRef<THREE.Group>(null);
  const boosterRRef = useRef<THREE.Group>(null);
  const stage2Ref = useRef<THREE.Group>(null);
  const fairingLRef = useRef<THREE.Group>(null);
  const fairingRRef = useRef<THREE.Group>(null);
  const satGroupRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const mainFlameRef = useRef<THREE.Mesh>(null);
  const vacFlameRef = useRef<THREE.Mesh>(null);
  const flameLRef = useRef<THREE.Mesh>(null);
  const flameRRef = useRef<THREE.Mesh>(null);
  const engineLightRef = useRef<THREE.PointLight>(null);
  const earthCurveRef = useRef<THREE.Group>(null);
  const smokeRef = useRef<THREE.InstancedMesh>(null);

  const [deployProgress, setDeployProgress] = useState(0);
  const lastDeployQuant = useRef(0);

  const skyDay = useMemo(() => new THREE.Color('#4682dc'), []);
  const skySpace = useMemo(() => new THREE.Color('#020410'), []);
  const skyCur = useMemo(() => new THREE.Color('#4682dc'), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const smokeSeeds = useMemo(
    () =>
      Array.from({ length: N_SMOKE }, () => ({
        angle: Math.random() * Math.PI * 2,
        speed: 1.4 + Math.random() * 2.8,
        lift: 0.4 + Math.random() * 1.4,
        phase: Math.random(),
      })),
    [],
  );

  const setPhase = (p: string) => {
    if (lastPhase.current !== p) {
      lastPhase.current = p;
      onPhaseText(p);
    }
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05); // smooth animation steps
    // the timeline follows the real clock, so the launch ends after T_END s even at a low frame rate (≤ 9 s)
    elapsed.current += Math.min(dtRaw, 0.5);
    const tt = elapsed.current;

    // 1. Caption phase
    if (tt < 0.8) setPhase('3');
    else if (tt < 1.6) setPhase('2');
    else if (tt < T_LIFTOFF) setPhase('1');
    else if (tt < T_CLIMB) setPhase('liftoff');
    else if (tt < T_STAGE) setPhase('climb');
    else if (tt < T_FAIRING) setPhase('stage');
    else if (tt < T_RELEASE) setPhase('fairing');
    else setPhase('release');

    if (tt >= T_END) {
      if (!done.current) {
        done.current = true;
        onFinish();
      }
      return;
    }

    const fly = Math.max(0, tt - T_LIFTOFF);
    const ignited = tt > T_LIFTOFF - 0.55;
    const staged = tt >= T_STAGE;
    const fairingOpen = tt >= T_FAIRING;
    const released = tt >= T_RELEASE;

    // Altitude curve
    const alt = fly > 0 ? 1.8 * fly * fly : 0;
    const spaceFactor = THREE.MathUtils.clamp((tt - T_LIFTOFF) / (T_STAGE - T_LIFTOFF + 0.4), 0, 1);

    // Sky color transition
    skyCur.copy(skyDay).lerp(skySpace, spaceFactor);
    scene.background = skyCur;

    // Umbilical tower arm swings back at ignition
    if (armRef.current) {
      const armSwing = THREE.MathUtils.clamp((tt - (T_LIFTOFF - 0.5)) * 2.2, 0, 1);
      armRef.current.rotation.z = -armSwing * 1.1;
    }

    // Vehicle climb and subtle pitch
    const pitch = fly > 0 ? Math.min(0.32, fly * 0.055) : 0;
    const shake = ignited && fly < 1.4 ? (Math.random() - 0.5) * 0.05 : 0;
    if (vehicleRef.current) {
      vehicleRef.current.position.set(shake, alt, 0);
      vehicleRef.current.rotation.z = -pitch;
    }

    // Stage 1 + boosters separation
    const sepTime = Math.max(0, tt - T_STAGE);
    if (stage1Ref.current) {
      stage1Ref.current.position.y = -sepTime * sepTime * 2.6;
      stage1Ref.current.position.x = -sepTime * 0.35;
      stage1Ref.current.rotation.z = sepTime * 0.35;
    }
    const bOffset = spec.coreR + 0.24;
    if (boosterLRef.current) {
      boosterLRef.current.position.set(-bOffset - sepTime * 1.1, -sepTime * sepTime * 2.8, 0);
      boosterLRef.current.rotation.z = sepTime * 0.7;
    }
    if (boosterRRef.current) {
      boosterRRef.current.position.set(bOffset + sepTime * 1.1, -sepTime * sepTime * 2.8, 0);
      boosterRRef.current.rotation.z = -sepTime * 0.7;
    }

    // Flames
    const flicker = 0.85 + Math.sin(tt * 55) * 0.18;
    if (mainFlameRef.current) {
      mainFlameRef.current.visible = ignited && !staged;
      mainFlameRef.current.scale.set(1, flicker, 1);
    }
    if (flameLRef.current) {
      flameLRef.current.visible = ignited && !staged && spec.boosters;
      flameLRef.current.scale.set(1, flicker, 1);
    }
    if (flameRRef.current) {
      flameRRef.current.visible = ignited && !staged && spec.boosters;
      flameRRef.current.scale.set(1, flicker, 1);
    }
    if (vacFlameRef.current) {
      vacFlameRef.current.visible = staged && !released;
      vacFlameRef.current.scale.set(1, flicker, 1);
    }
    if (engineLightRef.current) {
      engineLightRef.current.intensity = ignited && !released ? (staged ? 12 : 28) : 0;
    }

    // Fairing split & drift away
    const fTime = Math.max(0, tt - T_FAIRING);
    if (fairingLRef.current) {
      fairingLRef.current.position.set(-fTime * 1.45, -fTime * fTime * 0.8, 0);
      fairingLRef.current.rotation.z = fTime * 1.1;
      fairingLRef.current.visible = fTime < 2.2;
    }
    if (fairingRRef.current) {
      fairingRRef.current.position.set(fTime * 1.45, -fTime * fTime * 0.8, 0);
      fairingRRef.current.rotation.z = -fTime * 1.1;
      fairingRRef.current.visible = fTime < 2.2;
    }

    // Satellite release & panel unfolding
    const rTime = Math.max(0, tt - T_RELEASE);
    const satBaseY = spec.stage1H + spec.stage2H + spec.fairingH * 0.28;
    if (satGroupRef.current) {
      satGroupRef.current.visible = fairingOpen;
      satGroupRef.current.position.set(0, satBaseY + rTime * 1.15, 0);
      satGroupRef.current.rotation.y = rTime * 0.85;
    }
    if (stage2Ref.current && released) {
      stage2Ref.current.position.y = -rTime * 0.9;
    }

    const dep = released ? THREE.MathUtils.clamp((tt - T_RELEASE) / 0.95, 0, 1) : 0;
    const quant = Math.round(dep * 25);
    if (quant !== lastDeployQuant.current) {
      lastDeployQuant.current = quant;
      setDeployProgress(dep);
    }

    // Pad smoke (active near ground)
    if (smokeRef.current) {
      const smokeActive = ignited && spaceFactor < 0.75;
      smokeSeeds.forEach((s, i) => {
        if (!smokeActive) {
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          smokeRef.current!.setMatrixAt(i, dummy.matrix);
          return;
        }
        const age = ((tt * 0.9 + s.phase) % 1);
        const rad = age * s.speed * (fly < 1.2 ? 2.4 : 1.2);
        dummy.position.set(Math.cos(s.angle) * rad, 0.25 + age * s.lift, Math.sin(s.angle) * rad);
        dummy.scale.setScalar((0.35 + age * 1.35) * (1 - spaceFactor));
        dummy.updateMatrix();
        smokeRef.current!.setMatrixAt(i, dummy.matrix);
      });
      smokeRef.current.instanceMatrix.needsUpdate = true;
    }

    // Curved Earth horizon below rocket when in space
    if (earthCurveRef.current) {
      earthCurveRef.current.visible = spaceFactor > 0.35;
      earthCurveRef.current.position.set(0, alt - 28, -10);
      earthCurveRef.current.rotation.z += dt * 0.04;
    }

    // Camera tracking: frames the full rocket on pad, then zooms closer to upper stage & satellite release
    const focusHeight = !staged
      ? alt + (spec.stage1H + spec.stage2H) * 0.55
      : alt + satBaseY + (released ? rTime * 1.15 : -0.2);
    const camDist = !staged ? 9.2 : fairingOpen ? 4.2 : 5.8;
    const camRight = Math.sin(pitch) * focusHeight;
    const camUp = Math.cos(pitch) * focusHeight;

    camera.position.set(
      camRight + camDist * 0.38,
      Math.max(2.2, camUp + (released ? 0.6 : 0.2)),
      camDist,
    );
    camera.lookAt(camRight, Math.max(1.8, camUp), 0);
  });

  const towerH = spec.stage1H + spec.stage2H + spec.fairingH * 0.85;
  const towerX = spec.coreR + (spec.boosters ? 0.95 : 0.55);
  const fairingBaseY = spec.stage1H + spec.stage2H;

  return (
    <>
      <Stars radius={120} depth={50} count={2200} factor={4} fade />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#cfe2ff', '#1b2436', 0.7]} />
      <directionalLight position={[8, 14, 10]} intensity={2.0} />

      {/* Ground & Launchpad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#2c5d34" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[2.2, 2.6, 0.3, 28]} />
        <meshStandardMaterial color="#68707e" roughness={0.7} />
      </mesh>
      {/* Flame trench */}
      <mesh position={[0, 0.31, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.04, 20]} />
        <meshStandardMaterial color="#232730" />
      </mesh>

      {/* Launch Tower */}
      <group position={[towerX, 0.3, 0]}>
        <mesh position={[0, towerH / 2, 0]}>
          <boxGeometry args={[0.38, towerH, 0.38]} />
          <meshStandardMaterial color="#c0392b" wireframe />
        </mesh>
        <mesh position={[0, towerH / 2, 0]}>
          <boxGeometry args={[0.14, towerH, 0.14]} />
          <meshStandardMaterial color="#962d22" metalness={0.4} roughness={0.5} />
        </mesh>
        {/* Umbilical swing arm */}
        <group ref={armRef} position={[0, towerH * 0.78, 0]}>
          <mesh position={[-towerX * 0.48, 0, 0]}>
            <boxGeometry args={[towerX * 0.95, 0.1, 0.12]} />
            <meshStandardMaterial color="#c0392b" />
          </mesh>
        </group>
      </group>

      {/* Pad Smoke */}
      <instancedMesh ref={smokeRef} args={[undefined, undefined, N_SMOKE]}>
        <sphereGeometry args={[0.7, 10, 10]} />
        <meshStandardMaterial color="#e8ecf5" transparent opacity={0.45} depthWrite={false} />
      </instancedMesh>

      {/* Curved Earth horizon in space */}
      <group ref={earthCurveRef} visible={false}>
        <mesh>
          <sphereGeometry args={[24, 48, 32]} />
          <meshStandardMaterial color="#1b56b0" emissive="#0a2458" emissiveIntensity={0.4} roughness={0.6} />
        </mesh>
        <mesh scale={1.03}>
          <sphereGeometry args={[24, 48, 24]} />
          <meshBasicMaterial color="#66bdff" transparent opacity={0.22} side={THREE.BackSide} />
        </mesh>
      </group>

      {/* ==================== ROCKET & PAYLOAD ==================== */}
      <group ref={vehicleRef} position={[0, 0.3, 0]}>
        <pointLight ref={engineLightRef} position={[0, -0.5, 0]} color="#ff9d3b" distance={22} intensity={0} />

        {/* ---- STAGE 1 ---- */}
        <group ref={stage1Ref}>
          <mesh position={[0, spec.stage1H / 2, 0]}>
            <cylinderGeometry args={[spec.coreR, spec.coreR, spec.stage1H, 24]} />
            <meshStandardMaterial color="#f2f4f8" metalness={0.25} roughness={0.4} />
          </mesh>
          {/* Accent stripe */}
          <mesh position={[0, spec.stage1H * 0.72, 0]}>
            <cylinderGeometry args={[spec.coreR * 1.01, spec.coreR * 1.01, 0.22, 24]} />
            <meshStandardMaterial color={spec.stripeColor} />
          </mesh>
          {/* Interstage dark collar */}
          <mesh position={[0, spec.stage1H - 0.12, 0]}>
            <cylinderGeometry args={[spec.coreR * 1.005, spec.coreR * 1.005, 0.24, 24]} />
            <meshStandardMaterial color="#252b38" />
          </mesh>
          {/* 4 Tail Fins */}
          {[0, 1, 2, 3].map((k) => {
            const ang = (k * Math.PI) / 2;
            return (
              <mesh
                key={k}
                position={[Math.cos(ang) * (spec.coreR + 0.12), 0.32, Math.sin(ang) * (spec.coreR + 0.12)]}
                rotation={[0, -ang, 0]}
              >
                <boxGeometry args={[0.28, 0.55, 0.04]} />
                <meshStandardMaterial color="#252b38" />
              </mesh>
            );
          })}
          {/* Stage 1 Nozzle */}
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[spec.coreR * 0.45, spec.coreR * 0.68, 0.28, 16]} />
            <meshStandardMaterial color="#333947" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Main Exhaust Plume */}
          <mesh ref={mainFlameRef} visible={false} position={[0, -1.05, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[spec.coreR * 0.75, 1.9, 16, 1, true]} />
            <meshBasicMaterial color="#ffb338" transparent opacity={0.92} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* ---- SIDE BOOSTERS (Heavy Rocket only) ---- */}
        {spec.boosters && (
          <>
            <group ref={boosterLRef} position={[-(spec.coreR + 0.24), 0, 0]}>
              <mesh position={[0, 1.35, 0]}>
                <cylinderGeometry args={[0.21, 0.21, 2.7, 18]} />
                <meshStandardMaterial color="#e8ecf2" metalness={0.25} roughness={0.4} />
              </mesh>
              <mesh position={[0, 2.92, 0]}>
                <coneGeometry args={[0.21, 0.45, 18]} />
                <meshStandardMaterial color="#c0392b" />
              </mesh>
              <mesh ref={flameLRef} visible={false} position={[0, -0.8, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.18, 1.5, 12, 1, true]} />
                <meshBasicMaterial color="#ff9d2e" transparent opacity={0.9} side={THREE.DoubleSide} />
              </mesh>
            </group>

            <group ref={boosterRRef} position={[spec.coreR + 0.24, 0, 0]}>
              <mesh position={[0, 1.35, 0]}>
                <cylinderGeometry args={[0.21, 0.21, 2.7, 18]} />
                <meshStandardMaterial color="#e8ecf2" metalness={0.25} roughness={0.4} />
              </mesh>
              <mesh position={[0, 2.92, 0]}>
                <coneGeometry args={[0.21, 0.45, 18]} />
                <meshStandardMaterial color="#c0392b" />
              </mesh>
              <mesh ref={flameRRef} visible={false} position={[0, -0.8, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.18, 1.5, 12, 1, true]} />
                <meshBasicMaterial color="#ff9d2e" transparent opacity={0.9} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </>
        )}

        {/* ---- STAGE 2 (UPPER STAGE) ---- */}
        <group ref={stage2Ref} position={[0, spec.stage1H, 0]}>
          <mesh position={[0, spec.stage2H / 2, 0]}>
            <cylinderGeometry args={[spec.coreR * 0.96, spec.coreR * 0.98, spec.stage2H, 24]} />
            <meshStandardMaterial color="#f5f7fa" metalness={0.25} roughness={0.4} />
          </mesh>
          <mesh position={[0, spec.stage2H * 0.5, 0]}>
            <cylinderGeometry args={[spec.coreR * 0.97, spec.coreR * 0.97, 0.12, 24]} />
            <meshStandardMaterial color={spec.stripeColor} />
          </mesh>
          {/* Payload adapter frustum */}
          <mesh position={[0, spec.stage2H + 0.08, 0]}>
            <cylinderGeometry args={[spec.coreR * 0.55, spec.coreR * 0.85, 0.16, 20]} />
            <meshStandardMaterial color="#40485c" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Upper Stage Vacuum Plume */}
          <mesh ref={vacFlameRef} visible={false} position={[0, -0.65, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[spec.coreR * 0.65, 1.3, 16, 1, true]} />
            <meshBasicMaterial color="#7cc4ff" transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        </group>

        {/* ---- PAYLOAD FAIRING (2 HALVES) ---- */}
        <group position={[0, fairingBaseY, 0]}>
          {/* Left Fairing Half (-X) */}
          <group ref={fairingLRef}>
            <mesh position={[0, spec.fairingH * 0.28, 0]} rotation={[0, Math.PI / 2, 0]}>
              <cylinderGeometry args={[spec.coreR, spec.coreR, spec.fairingH * 0.56, 16, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.35} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, spec.fairingH * 0.56, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <sphereGeometry args={[spec.coreR, 16, 12, 0, Math.PI, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.35} side={THREE.DoubleSide} />
            </mesh>
          </group>

          {/* Right Fairing Half (+X) */}
          <group ref={fairingRRef}>
            <mesh position={[0, spec.fairingH * 0.28, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <cylinderGeometry args={[spec.coreR, spec.coreR, spec.fairingH * 0.56, 16, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.35} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, spec.fairingH * 0.56, 0]} rotation={[0, Math.PI / 2, 0]}>
              <sphereGeometry args={[spec.coreR, 16, 12, 0, Math.PI, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.35} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>

        {/* ---- SATELLITE PAYLOAD (Same SatelliteModel) ---- */}
        <group ref={satGroupRef} visible={false} position={[0, fairingBaseY + spec.fairingH * 0.28, 0]} scale={spec.satScale}>
          <SatelliteModel build={build} mission={mission} deployProgress={deployProgress} />
        </group>
      </group>
    </>
  );
}

export interface Launch3DProps {
  build: Build;
  mission?: Mission;
  onDone(): void;
}

export function Launch3D({ build, mission = MISSIONS[0], onDone }: Launch3DProps) {
  const { t } = useT();
  const [phaseKey, setPhaseKey] = useState('3');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finishedRef = useRef(false);

  const finish = () => {
    if (!finishedRef.current) {
      finishedRef.current = true;
      doneRef.current();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const spec = ROCKET_SPECS[build.rocket] ?? ROCKET_SPECS.rideshare;
  const km = ORBIT_KM[build.orbit] ?? 500;

  // sounds follow the launch phases (same sounds as Launch2D, plus separation and release)
  useEffect(() => {
    if (phaseKey === '3' || phaseKey === '2' || phaseKey === '1') sfx.countdown();
    else if (phaseKey === 'liftoff') { sfx.countdown(true); sfx.liftoff(); }
    else if (phaseKey === 'stage' || phaseKey === 'fairing') sfx.separation();
    else if (phaseKey === 'release') sfx.released();
  }, [phaseKey]);

  const caption = useMemo(() => {
    switch (phaseKey) {
      case '3':
      case '2':
      case '1':
        return phaseKey;
      case 'liftoff':
        return t('Lift-off!');
      case 'climb':
        return t('Climbing to {km} km…', { km: km.toLocaleString() });
      case 'stage':
        return t('First stage separation');
      case 'fairing':
        return t('Fairing opens');
      default:
        return t('Satellite released - in orbit!');
    }
  }, [phaseKey, km, t]);

  return (
    <div className="runner-stage g2d-launch" onClick={finish}>
      <Canvas camera={{ position: [3.5, 2.6, 9.2], fov: 46 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <LaunchWorld build={build} mission={mission} onPhaseText={setPhaseKey} onFinish={finish} />
        </Suspense>
      </Canvas>
      <div className={`g2d-countdown ${/^\d$/.test(caption) ? 'big' : ''}`} key={caption}>
        {caption}
      </div>
      <div className="g2d-launch-info">
        🚀 {t(spec.name)} · 🌍 {km.toLocaleString()} {t('km')}
      </div>
      <div className="g2d-skip">{t('Click to skip')}</div>
    </div>
  );
}
