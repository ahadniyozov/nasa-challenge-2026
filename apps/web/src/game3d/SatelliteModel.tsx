// 3D procedural satellite built directly from the player's Build & Mission.
// Used in Hangar3D, Launch3D, and Flight3D. Lightweight primitives only (< 1,000 triangles).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { analyse, type Build, type SlotId } from '../game2d/config';
import { MISSIONS, type Mission } from '../game2d/missions';

export const BUS_DIMS: Record<string, [number, number, number]> = {
  'cubesat-3u': [0.46, 1.04, 0.46],
  'cubesat-12u': [0.80, 0.86, 0.80],
  smallsat: [1.10, 1.06, 1.10],
  'medium-bus': [1.42, 1.34, 1.42],
};

export interface Box3D {
  name: string;
  min: [number, number, number];
  max: [number, number, number];
  attachedFace: 'body' | 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back' | 'enclosing';
}

/**
 * Axis-aligned boxes of every external part, the same geometry the model below draws (fully deployed).
 * Used for the debris-shield radius here and by model.check.ts (no overlaps, nothing floating, shield encloses all).
 */
export function computeSatelliteBoxes(build: Build, m: Mission): { bus: [number, number, number]; boxes: Box3D[]; shieldRadius: number } {
  const busId = analyse(build, m).design.busId;
  const [w, h, d] = BUS_DIMS[busId] ?? BUS_DIMS['cubesat-12u'];
  const boxes: Box3D[] = [];

  // solar panels
  const wingLen = build.panels === 'solar-deploy-l' ? 1.32 : build.panels === 'solar-deploy-s' ? 0.72 : 0;
  const wingDepth = build.panels === 'solar-deploy-l' ? Math.min(0.56, d * 0.82) : Math.min(0.42, d * 0.68);
  if (wingLen > 0) {
    boxes.push({ name: 'panels-left', min: [-(w / 2 + 0.08 + wingLen), h * 0.08 - 0.035, -wingDepth / 2], max: [-w / 2, h * 0.08 + 0.035, wingDepth / 2], attachedFace: 'left' });
    boxes.push({ name: 'panels-right', min: [w / 2, h * 0.08 - 0.035, -wingDepth / 2], max: [w / 2 + 0.08 + wingLen, h * 0.08 + 0.035, wingDepth / 2], attachedFace: 'right' });
  } else {
    boxes.push({ name: 'panels-front-upper', min: [-w * 0.39, h * 0.07, d / 2], max: [w * 0.39, h * 0.41, d / 2 + 0.01], attachedFace: 'front' });
  }

  // antenna on top (+Y)
  if (build.antenna === 'uhf') {
    boxes.push({ name: 'antenna-uhf', min: [w * 0.22 - 0.04, h / 2, -0.04], max: [w * 0.22 + 0.25, h / 2 + 0.52, 0.04], attachedFace: 'top' });
  } else if (build.antenna === 's-band') {
    boxes.push({ name: 'antenna-s-band', min: [-w * 0.23, h / 2, -d * 0.23], max: [w * 0.23, h / 2 + 0.06, d * 0.23], attachedFace: 'top' });
  } else {
    const dishR = Math.min(0.32, w * 0.46);
    boxes.push({ name: 'antenna-x-band', min: [-dishR, h / 2, -dishR], max: [dishR, h / 2 + 0.14 + dishR * 0.65, dishR], attachedFace: 'top' });
  }

  // front-face indicators
  boxes.push({ name: 'battery', min: [-w * 0.39, -h / 2 + 0.06, d / 2], max: [-w * 0.03, -h / 2 + 0.30, d / 2 + 0.025], attachedFace: 'front' });
  boxes.push({ name: 'memory', min: [w * 0.21 - Math.min(0.12, w * 0.18), -h / 2 + 0.085, d / 2], max: [w * 0.21 + Math.min(0.12, w * 0.18), -h / 2 + 0.275, d / 2 + 0.026], attachedFace: 'front' });
  const compHalfW = (build.computer === 'obc-rad' ? Math.min(0.34, w * 0.56) : Math.min(0.26, w * 0.46)) / 2;
  boxes.push({ name: 'computer', min: [-compHalfW, -h * 0.03 - 0.085, d / 2], max: [compHalfW, -h * 0.03 + 0.085, d / 2 + 0.026], attachedFace: 'front' });

  // instrument at the bottom (-Y, looking at Earth)
  const camDepth = build.camera === 'cam-hires' || build.camera === 'magnetometer' ? 0.44 : 0.26;
  boxes.push({ name: `instrument-${build.camera}`, min: [-0.32, -h / 2 - camDepth, -0.28], max: [0.28, -h / 2, 0.28], attachedFace: 'bottom' });

  // thruster at the back (-Z)
  if (build.thruster === 'prop-cold') {
    boxes.push({ name: 'thruster', min: [-0.095, -h * 0.22 - 0.095, -d / 2 - 0.18], max: [0.095, -h * 0.22 + 0.095, -d / 2], attachedFace: 'back' });
  }

  // the shield sphere must enclose the farthest corner of the body and of every part
  const far = (b: { min: number[]; max: number[] }) => Math.hypot(
    Math.max(Math.abs(b.min[0]), Math.abs(b.max[0])),
    Math.max(Math.abs(b.min[1]), Math.abs(b.max[1])),
    Math.max(Math.abs(b.min[2]), Math.abs(b.max[2])),
  );
  const shieldRadius = Math.max(far({ min: [-w / 2, -h / 2, -d / 2], max: [w / 2, h / 2, d / 2] }), ...boxes.map(far)) + 0.08;

  return { bus: [w, h, d], boxes, shieldRadius };
}

let cachedSolarTex: THREE.CanvasTexture | null = null;
function getSolarTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;
  if (cachedSolarTex) return cachedSolarTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#122c6e';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1d459e';
  for (let y = 4; y < 128; y += 32) {
    for (let x = 4; x < 128; x += 32) {
      g.fillRect(x, y, 24, 24);
    }
  }
  g.strokeStyle = '#8fb0ff';
  g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cachedSolarTex = t;
  return t;
}

const badgeCache = new Map<string, THREE.CanvasTexture>();
function getBadgeTexture(text: string, fg: string, bg: string, border: string): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;
  const key = `${text}|${fg}|${bg}|${border}`;
  const found = badgeCache.get(key);
  if (found) return found;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 80);
  g.strokeStyle = border;
  g.lineWidth = 6;
  g.strokeRect(3, 3, 122, 74);
  g.fillStyle = fg;
  g.font = '900 44px system-ui, -apple-system, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 42);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  badgeCache.set(key, t);
  return t;
}

let cachedRainbowTex: THREE.CanvasTexture | null = null;
function getRainbowTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;
  if (cachedRainbowTex) return cachedRainbowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, '#ff3b3b');
  grad.addColorStop(0.33, '#ffd23f');
  grad.addColorStop(0.66, '#3ddc84');
  grad.addColorStop(1, '#3898ff');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cachedRainbowTex = t;
  return t;
}

/** Returns 3D focus target and camera offset for Hangar3D when a slot is selected. */
export function getSlotFocusTarget(slot: SlotId | null, build: Build, mission: Mission = MISSIONS[0]): {
  target: [number, number, number];
  camPos: [number, number, number];
} {
  const busId = analyse(build, mission).design.busId;
  const [w, h, d] = BUS_DIMS[busId] ?? BUS_DIMS['cubesat-12u'];
  const wing = build.panels === 'solar-deploy-l' ? 1.32 : build.panels === 'solar-deploy-s' ? 0.72 : 0;
  // frame the whole satellite: the UHF whip and the dish stick out above, the instrument below
  const top = build.antenna === 'uhf' ? 0.52 : build.antenna === 'x-band' ? 0.14 + Math.min(0.32, w * 0.46) * 0.65 : 0.06;
  const bottom = build.camera === 'cam-hires' || build.camera === 'magnetometer' ? 0.44 : 0.26;
  const midY = (top - bottom) / 2;
  const baseDist = Math.max(2.3, (w + wing * 2) * 0.95, (h + top + bottom) * 1.45);

  switch (slot) {
    case 'camera':
      return { target: [0, -h / 2 - 0.18, 0], camPos: [0.85, -h / 2 - 0.35, 1.35] };
    case 'antenna':
      return { target: [0, h / 2 + 0.18, 0], camPos: [0.9, h / 2 + 0.55, 1.35] };
    case 'panels':
      return wing > 0
        ? { target: [w / 2 + wing * 0.45, h * 0.08, 0], camPos: [w / 2 + wing * 0.55, h * 0.55, 1.65] }
        : { target: [w / 2, h * 0.16, 0], camPos: [w + 1.1, h * 0.35, 1.1] };
    case 'battery':
      return { target: [-w * 0.2, -h * 0.26, d / 2], camPos: [-0.55, -h * 0.2, d / 2 + 1.25] };
    case 'memory':
      return { target: [w * 0.2, -h * 0.26, d / 2], camPos: [0.55, -h * 0.2, d / 2 + 1.25] };
    case 'computer':
      return { target: [0, -h * 0.02, d / 2], camPos: [0.25, 0.1, d / 2 + 1.2] };
    case 'thruster':
      return { target: [0, -h * 0.22, -d / 2 - 0.08], camPos: [0.75, -h * 0.15, -d / 2 - 1.35] };
    case 'body':
      return { target: [0, midY, 0], camPos: [baseDist * 0.65, midY + baseDist * 0.35, baseDist * 0.75] };
    case 'shield':
      return { target: [0, midY, 0], camPos: [baseDist * 0.78, midY + baseDist * 0.42, baseDist * 0.88] };
    default:
      return { target: [0, midY, 0], camPos: [baseDist * 0.68, midY + baseDist * 0.42, baseDist * 0.82] };
  }
}

export interface SatelliteModelProps {
  build: Build;
  mission?: Mission;
  /** Currently focused slot in Hangar3D (highlights the corresponding part). */
  focus?: SlotId | null;
  /** 0 = folded inside fairing, 1 = fully deployed in orbit (default 1). */
  deployProgress?: number;
  /** Optional flight visual states for Flight3D. */
  shadow?: boolean;
  asleep?: boolean;
  safe?: boolean;
}

export function SatelliteModel({
  build,
  mission = MISSIONS[0],
  focus = null,
  deployProgress = 1,
  shadow = false,
  asleep = false,
  safe = false,
}: SatelliteModelProps) {
  const busId = useMemo(() => analyse(build, mission).design.busId, [build, mission]);
  const [w, h, d] = BUS_DIMS[busId] ?? BUS_DIMS['cubesat-12u'];

  const solarTex = useMemo(getSolarTexture, []);
  const rainbowTex = useMemo(getRainbowTexture, []);
  const memLabel = build.memory === 'm12' ? '12' : build.memory === 'm8' ? '8' : '4';
  const memTex = useMemo(() => getBadgeTexture(memLabel, '#4dd2ff', '#1b2463', '#4dd2ff'), [memLabel]);
  const radTex = useMemo(() => getBadgeTexture('RAD', '#4dd2ff', '#16284c', '#4dd2ff'), []);

  const wingLen = build.panels === 'solar-deploy-l' ? 1.32 : build.panels === 'solar-deploy-s' ? 0.72 : 0;
  const wingDepth = build.panels === 'solar-deploy-l' ? Math.min(0.56, d * 0.82) : Math.min(0.42, d * 0.68);
  const batteryBars = build.battery === 'batt-l' ? 3 : build.battery === 'batt-m' ? 2 : 1;
  const deploy = THREE.MathUtils.clamp(deployProgress, 0, 1);
  const wingFoldAngle = (1 - deploy) * (Math.PI * 0.47);

  // Shield radius encloses the body and every part, antennas included (same boxes as model.check.ts)
  const shieldR = useMemo(() => computeSatelliteBoxes(build, mission).shieldRadius, [build, mission]);

  const isHi = (s: SlotId) => focus === s;
  const foilEmissive = isHi('body') ? '#ff7a2f' : asleep ? '#110a00' : shadow ? '#1f1400' : '#3a2600';
  const foilIntensity = isHi('body') ? 0.55 : asleep ? 0.08 : shadow ? 0.2 : 0.35;

  const dishR = Math.min(0.32, w * 0.46);
  const dishTheta = Math.PI * 0.38;
  // Sphere center so that the bottom vertex (y = -dishR) sits right on top of the mast (y = h/2 + 0.14)
  const dishCenterY = h / 2 + 0.14 + dishR;

  const radioR = Math.min(0.28, w * 0.44);
  // Downward-opening dish: top vertex (y = +radioR) touches bottom of collar (y = -h/2 - 0.06)
  const radioCenterY = -h / 2 - 0.06 - radioR;

  return (
    <group name="satellite-root">
      {/* ==================== BUS BODY ==================== */}
      <group name="slot-body">
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color="#f1b93a"
            metalness={0.42}
            roughness={0.36}
            emissive={foilEmissive}
            emissiveIntensity={foilIntensity}
          />
        </mesh>
        {/* Top and bottom structural end-frames */}
        {[-1, 1].map((dir) => (
          <mesh key={dir} position={[0, dir * (h / 2 - 0.024), 0]}>
            <boxGeometry args={[w * 1.016, 0.044, d * 1.016]} />
            <meshStandardMaterial color="#2b3348" metalness={0.65} roughness={0.35} />
          </mesh>
        ))}
        {/* 4 corner rails */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}-${sz}`} position={[sx * (w / 2 - 0.012), 0, sz * (d / 2 - 0.012)]}>
              <boxGeometry args={[0.032, h, 0.032]} />
              <meshStandardMaterial color="#394460" metalness={0.65} roughness={0.35} />
            </mesh>
          )),
        )}
        {/* Extra reinforcement belt for sturdy SmallSat / Medium bus */}
        {(busId === 'smallsat' || busId === 'medium-bus') && (
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[w * 1.02, 0.05, d * 1.02]} />
            <meshStandardMaterial color="#495678" metalness={0.7} roughness={0.3} />
          </mesh>
        )}
      </group>

      {/* ==================== SOLAR PANELS ==================== */}
      <group name="slot-panels">
        {build.panels === 'solar-body' ? (
          <>
            {/* Left & Right body-mounted cells */}
            {[-1, 1].map((side) => (
              <mesh
                key={`lr-${side}`}
                position={[side * (w / 2 + 0.005), h * 0.14, 0]}
                rotation={[0, (side * Math.PI) / 2, 0]}
              >
                <planeGeometry args={[d * 0.78, h * 0.48]} />
                <meshStandardMaterial
                  map={solarTex}
                  color={isHi('panels') ? '#7ce2ff' : '#ffffff'}
                  emissive={isHi('panels') ? '#1e6fa8' : '#0a1e54'}
                  emissiveIntensity={isHi('panels') ? 0.65 : 0.25}
                  metalness={0.35}
                  roughness={0.35}
                />
              </mesh>
            ))}
            {/* Front & Back upper body-mounted cells */}
            {[-1, 1].map((side) => (
              <mesh
                key={`fb-${side}`}
                position={[0, h * 0.24, side * (d / 2 + 0.005)]}
                rotation={[0, side === 1 ? 0 : Math.PI, 0]}
              >
                <planeGeometry args={[w * 0.78, h * 0.34]} />
                <meshStandardMaterial
                  map={solarTex}
                  color={isHi('panels') ? '#7ce2ff' : '#ffffff'}
                  emissive={isHi('panels') ? '#1e6fa8' : '#0a1e54'}
                  emissiveIntensity={isHi('panels') ? 0.65 : 0.25}
                  metalness={0.35}
                  roughness={0.35}
                />
              </mesh>
            ))}
          </>
        ) : (
          /* Deployable small or large wings on left (-X) and right (+X) */
          [-1, 1].map((side) => (
            <group
              key={side}
              position={[side * (w / 2), h * 0.08, 0]}
              rotation={[0, 0, -side * wingFoldAngle]}
            >
              {/* Hinge bracket attached to bus wall */}
              <mesh position={[side * 0.02, 0, 0]}>
                <boxGeometry args={[0.04, 0.07, 0.12]} />
                <meshStandardMaterial color="#9aa4b8" metalness={0.6} roughness={0.35} />
              </mesh>
              {/* Yoke / strut connecting bus wall to wing */}
              <mesh position={[side * 0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.018, 0.018, 0.08, 10]} />
                <meshStandardMaterial color="#b8c0d0" metalness={0.6} roughness={0.3} />
              </mesh>
              {/* Wing aluminum backing frame */}
              <mesh position={[side * (0.08 + wingLen / 2), 0, 0]}>
                <boxGeometry args={[wingLen, 0.018, wingDepth + 0.02]} />
                <meshStandardMaterial color="#7d89a3" metalness={0.55} roughness={0.4} />
              </mesh>
              {/* Solar cell array surface */}
              <mesh position={[side * (0.08 + wingLen / 2), 0, 0]}>
                <boxGeometry args={[wingLen - 0.02, 0.026, wingDepth]} />
                <meshStandardMaterial
                  map={solarTex}
                  color={isHi('panels') ? '#8ae8ff' : '#ffffff'}
                  emissive={isHi('panels') ? '#247bb8' : '#0d2666'}
                  emissiveIntensity={isHi('panels') ? 0.7 : 0.3}
                  metalness={0.35}
                  roughness={0.3}
                />
              </mesh>
            </group>
          ))
        )}
      </group>

      {/* ==================== ANTENNA (TOP +Y FACE) ==================== */}
      <group name="slot-antenna">
        {build.antenna === 'uhf' && (
          <group position={[w * 0.22, h / 2, 0]}>
            {/* Base mount on top face */}
            <mesh position={[0, 0.025, 0]}>
              <cylinderGeometry args={[0.032, 0.042, 0.05, 12]} />
              <meshStandardMaterial color="#7a8499" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Whip rod tilted outward */}
            <group position={[0, 0.04, 0]} rotation={[0, 0, -0.42]}>
              <mesh position={[0, 0.25 * deploy, 0]}>
                <cylinderGeometry args={[0.01, 0.016, 0.5 * Math.max(0.2, deploy), 10]} />
                <meshStandardMaterial
                  color="#e2e6f0"
                  emissive={isHi('antenna') ? '#ff7a2f' : '#000000'}
                  emissiveIntensity={isHi('antenna') ? 0.7 : 0}
                  metalness={0.7}
                  roughness={0.2}
                />
              </mesh>
              <mesh position={[0, 0.5 * Math.max(0.2, deploy), 0]}>
                <sphereGeometry args={[0.022, 10, 10]} />
                <meshStandardMaterial color="#4dd2ff" emissive="#4dd2ff" emissiveIntensity={0.6} />
              </mesh>
            </group>
          </group>
        )}

        {build.antenna === 's-band' && (
          <group position={[0, h / 2, 0]}>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[w * 0.46, 0.04, d * 0.46]} />
              <meshStandardMaterial color="#d8dde8" metalness={0.3} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.045, 0]}>
              <boxGeometry args={[w * 0.34, 0.016, d * 0.34]} />
              <meshStandardMaterial
                color="#d4af37"
                emissive={isHi('antenna') ? '#ff7a2f' : '#4a3500'}
                emissiveIntensity={isHi('antenna') ? 0.7 : 0.25}
                metalness={0.7}
                roughness={0.25}
              />
            </mesh>
          </group>
        )}

        {build.antenna === 'x-band' && (
          <group position={[0, 0, 0]}>
            {/* Mast from y = h/2 to y = h/2 + 0.14 */}
            <mesh position={[0, h / 2 + 0.07, 0]}>
              <cylinderGeometry args={[0.032, 0.045, 0.14, 12]} />
              <meshStandardMaterial color="#9aa3b5" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Parabolic dish opening upward (+Y), bottom vertex touches y = h/2 + 0.14 */}
            <mesh position={[0, dishCenterY, 0]} rotation={[Math.PI, 0, 0]}>
              <sphereGeometry args={[dishR, 20, 10, 0, Math.PI * 2, 0, dishTheta]} />
              <meshStandardMaterial
                color="#f2f4f8"
                emissive={isHi('antenna') ? '#ff7a2f' : '#1b2440'}
                emissiveIntensity={isHi('antenna') ? 0.55 : 0.15}
                metalness={0.25}
                roughness={0.35}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Central feed horn inside dish */}
            <mesh position={[0, h / 2 + 0.14 + dishR * 0.28, 0]}>
              <cylinderGeometry args={[0.014, 0.022, dishR * 0.55, 10]} />
              <meshStandardMaterial color="#556078" metalness={0.7} roughness={0.25} />
            </mesh>
            <mesh position={[0, h / 2 + 0.14 + dishR * 0.56, 0]}>
              <sphereGeometry args={[0.024, 10, 10]} />
              <meshStandardMaterial color="#4dd2ff" emissive="#4dd2ff" emissiveIntensity={0.6} />
            </mesh>
          </group>
        )}
      </group>

      {/* ==================== BATTERY INDICATORS (FRONT +Z, BOTTOM-LEFT) ==================== */}
      <group name="slot-battery" position={[-w * 0.21, -h / 2 + 0.18, d / 2]}>
        {/* Backing plate flush with front face */}
        <mesh position={[0, 0, 0.006]}>
          <boxGeometry args={[w * 0.36, 0.24, 0.012]} />
          <meshStandardMaterial color="#142038" metalness={0.4} roughness={0.5} />
        </mesh>
        {Array.from({ length: 3 }, (_, i) => {
          const active = i < batteryBars;
          return (
            <mesh key={i} position={[0, -0.07 + i * 0.07, 0.016]}>
              <boxGeometry args={[w * 0.30, 0.046, 0.016]} />
              <meshStandardMaterial
                color={active ? '#3ddc84' : '#1e2c48'}
                emissive={active ? (isHi('battery') ? '#7affb2' : '#3ddc84') : '#000000'}
                emissiveIntensity={active ? (isHi('battery') ? 1.1 : 0.65) : 0}
                roughness={0.3}
              />
            </mesh>
          );
        })}
      </group>

      {/* ==================== MEMORY CHIP (FRONT +Z, BOTTOM-RIGHT) ==================== */}
      <group name="slot-memory" position={[w * 0.21, -h / 2 + 0.18, d / 2]}>
        <mesh position={[0, 0, 0.014]}>
          <boxGeometry args={[Math.min(0.24, w * 0.36), 0.19, 0.024]} />
          <meshStandardMaterial
            map={memTex}
            color="#ffffff"
            emissive={isHi('memory') ? '#ff7a2f' : '#1b3b6f'}
            emissiveIntensity={isHi('memory') ? 0.65 : 0.25}
            roughness={0.35}
          />
        </mesh>
      </group>

      {/* ==================== COMPUTER MODULE (FRONT +Z, CENTER) ==================== */}
      <group name="slot-computer" position={[0, -h * 0.03, d / 2]}>
        {build.computer === 'obc-rad' ? (
          <>
            {/* Radiation-hardened shielding frame */}
            <mesh position={[0, 0, 0.012]}>
              <boxGeometry args={[Math.min(0.34, w * 0.56), 0.17, 0.022]} />
              <meshStandardMaterial
                color="#4dd2ff"
                emissive="#4dd2ff"
                emissiveIntensity={isHi('computer') ? 0.95 : 0.45}
                metalness={0.6}
                roughness={0.25}
              />
            </mesh>
            {/* Front plate with crisp "RAD" mark */}
            <mesh position={[0, 0, 0.025]}>
              <planeGeometry args={[Math.min(0.31, w * 0.52), 0.145]} />
              <meshStandardMaterial
                map={radTex}
                emissive="#4dd2ff"
                emissiveIntensity={0.35}
                roughness={0.3}
              />
            </mesh>
          </>
        ) : (
          <mesh position={[0, 0, 0.012]}>
            <boxGeometry args={[Math.min(0.26, w * 0.46), 0.13, 0.02]} />
            <meshStandardMaterial
              color="#20304f"
              emissive={isHi('computer') ? '#ff7a2f' : '#0d1830'}
              emissiveIntensity={isHi('computer') ? 0.65 : 0.2}
              metalness={0.4}
              roughness={0.45}
            />
          </mesh>
        )}
      </group>

      {/* ==================== 7 INSTRUMENTS (BOTTOM -Y FACE) ==================== */}
      <group name="slot-camera">
        {/* 1. Simple camera (cam-cubesat) */}
        {build.camera === 'cam-cubesat' && (
          <group position={[0, -h / 2, 0]}>
            <mesh position={[0, -0.07, 0]}>
              <cylinderGeometry args={[0.11, 0.12, 0.14, 16]} />
              <meshStandardMaterial
                color="#dde2ec"
                emissive={isHi('camera') ? '#ff7a2f' : '#000000'}
                emissiveIntensity={isHi('camera') ? 0.5 : 0}
                metalness={0.45}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, -0.142, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.085, 16]} />
              <meshStandardMaterial color="#182a58" emissive="#2850a8" emissiveIntensity={0.55} />
            </mesh>
          </group>
        )}

        {/* 2. Thermal infrared camera (cam-thermal) */}
        {build.camera === 'cam-thermal' && (
          <group position={[0, -h / 2, 0]}>
            <mesh position={[0, -0.06, 0]}>
              <boxGeometry args={[0.26, 0.12, 0.26]} />
              <meshStandardMaterial
                color="#dce0e8"
                emissive={isHi('camera') ? '#ff7a2f' : '#000000'}
                emissiveIntensity={isHi('camera') ? 0.5 : 0}
                metalness={0.45}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0, -0.14, 0]}>
              <cylinderGeometry args={[0.12, 0.135, 0.08, 16]} />
              <meshStandardMaterial color="#ff6a3d" emissive="#ff4500" emissiveIntensity={0.45} />
            </mesh>
            <mesh position={[0, -0.182, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.10, 16]} />
              <meshStandardMaterial color="#7a1f1f" emissive="#ff5522" emissiveIntensity={0.7} />
            </mesh>
          </group>
        )}

        {/* 3. High-resolution telescope tube (cam-hires) */}
        {build.camera === 'cam-hires' && (
          <group position={[0, -h / 2, 0]}>
            {/* Mounting flange */}
            <mesh position={[0, -0.03, 0]}>
              <cylinderGeometry args={[0.20, 0.20, 0.06, 18]} />
              <meshStandardMaterial color="#8c96ab" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Long optical telescope baffle tube */}
            <mesh position={[0, -0.22, 0]}>
              <cylinderGeometry args={[0.165, 0.185, 0.38, 18]} />
              <meshStandardMaterial
                color="#e8ecf2"
                emissive={isHi('camera') ? '#ff7a2f' : '#000000'}
                emissiveIntensity={isHi('camera') ? 0.5 : 0}
                metalness={0.45}
                roughness={0.3}
              />
            </mesh>
            {/* Baffle rings */}
            {[-0.14, -0.28, -0.39].map((ry, idx) => (
              <mesh key={idx} position={[0, ry, 0]}>
                <cylinderGeometry args={[0.19, 0.19, 0.025, 18]} />
                <meshStandardMaterial color="#2b354d" metalness={0.6} roughness={0.35} />
              </mesh>
            ))}
            {/* Primary mirror / lens */}
            <mesh position={[0, -0.412, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.155, 18]} />
              <meshStandardMaterial color="#162858" emissive="#2b62d9" emissiveIntensity={0.65} />
            </mesh>
          </group>
        )}

        {/* 4. Hyperspectral imager (spectro) */}
        {build.camera === 'spectro' && (
          <group position={[0, -h / 2, 0]}>
            <mesh position={[0, -0.09, 0]}>
              <boxGeometry args={[0.30, 0.18, 0.26]} />
              <meshStandardMaterial
                color="#dde2ec"
                emissive={isHi('camera') ? '#ff7a2f' : '#000000'}
                emissiveIntensity={isHi('camera') ? 0.5 : 0}
                metalness={0.45}
                roughness={0.35}
              />
            </mesh>
            {/* Rainbow spectral prism band visible on front/back & bottom */}
            <mesh position={[0, -0.165, 0]}>
              <boxGeometry args={[0.24, 0.05, 0.22]} />
              <meshStandardMaterial map={rainbowTex} emissive="#ffffff" emissiveMap={rainbowTex} emissiveIntensity={0.45} />
            </mesh>
          </group>
        )}

        {/* 5. Microwave radiometer dish (radiometer) */}
        {build.camera === 'radiometer' && (
          <group position={[0, 0, 0]}>
            {/* Collar from -h/2 to -h/2 - 0.06 */}
            <mesh position={[0, -h / 2 - 0.03, 0]}>
              <cylinderGeometry args={[0.07, 0.055, 0.06, 12]} />
              <meshStandardMaterial color="#8c96ab" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Dish opening downward, vertex touches -h/2 - 0.06 */}
            <mesh position={[0, radioCenterY, 0]}>
              <sphereGeometry args={[radioR, 20, 10, 0, Math.PI * 2, 0, dishTheta]} />
              <meshStandardMaterial
                color="#e6eaf2"
                emissive={isHi('camera') ? '#ff7a2f' : '#1b2440'}
                emissiveIntensity={isHi('camera') ? 0.55 : 0.15}
                metalness={0.3}
                roughness={0.35}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Feed horn inside downward dish */}
            <mesh position={[0, -h / 2 - 0.06 - radioR * 0.25, 0]}>
              <cylinderGeometry args={[0.02, 0.03, radioR * 0.5, 10]} />
              <meshStandardMaterial color="#4a5268" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        )}

        {/* 6. Magnetometer on a boom (magnetometer) */}
        {build.camera === 'magnetometer' && (
          <group position={[-w * 0.15, -h / 2, 0]}>
            {/* Base bracket on nadir face */}
            <mesh position={[0, -0.025, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 0.05, 10]} />
              <meshStandardMaterial color="#8c96ab" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Boom extending downward-left */}
            <group position={[0, -0.04, 0]} rotation={[0, 0, -0.62]}>
              <mesh position={[0, -0.20, 0]}>
                <cylinderGeometry args={[0.016, 0.016, 0.40, 10]} />
                <meshStandardMaterial
                  color="#cfd6e6"
                  emissive={isHi('camera') ? '#ff7a2f' : '#000000'}
                  emissiveIntensity={isHi('camera') ? 0.6 : 0}
                  metalness={0.65}
                  roughness={0.25}
                />
              </mesh>
              {/* Red/Blue dipole sensor head at end of boom */}
              <group position={[0, -0.42, 0]}>
                <mesh position={[-0.035, 0, 0]}>
                  <boxGeometry args={[0.07, 0.09, 0.09]} />
                  <meshStandardMaterial color="#c0392b" emissive="#c0392b" emissiveIntensity={0.35} />
                </mesh>
                <mesh position={[0.035, 0, 0]}>
                  <boxGeometry args={[0.07, 0.09, 0.09]} />
                  <meshStandardMaterial color="#2c6fd1" emissive="#2c6fd1" emissiveIntensity={0.35} />
                </mesh>
              </group>
            </group>
          </group>
        )}

        {/* 7. Radiation monitor (radiation-mon) */}
        {build.camera === 'radiation-mon' && (
          <group position={[0, -h / 2, 0]}>
            <mesh position={[0, -0.075, 0]}>
              <cylinderGeometry args={[0.11, 0.11, 0.15, 16]} />
              <meshStandardMaterial
                color="#ffd23f"
                emissive={isHi('camera') ? '#ff7a2f' : '#a67c00'}
                emissiveIntensity={isHi('camera') ? 0.65 : 0.3}
                metalness={0.35}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0, -0.152, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.065, 16]} />
              <meshStandardMaterial color="#1a1d24" />
            </mesh>
          </group>
        )}
      </group>

      {/* ==================== THRUSTER (BACK -Z FACE) ==================== */}
      {build.thruster === 'prop-cold' && (
        <group name="slot-thruster" position={[0, -h * 0.22, -d / 2]}>
          {/* Mounting block flush with -Z wall */}
          <mesh position={[0, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.055, 0.065, 0.04, 12]} />
            <meshStandardMaterial color="#7d879c" metalness={0.65} roughness={0.3} />
          </mesh>
          {/* Conical thruster nozzle bell */}
          <mesh position={[0, 0, -0.10]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.095, 0.15, 14, 1, true]} />
            <meshStandardMaterial
              color="#566075"
              emissive={isHi('thruster') ? '#ff7a2f' : '#000000'}
              emissiveIntensity={isHi('thruster') ? 0.65 : 0}
              metalness={0.75}
              roughness={0.25}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* ==================== DEBRIS SHIELD (SPHERE) ==================== */}
      {build.shield === 'shield' && (
        <group name="slot-shield">
          <mesh>
            <sphereGeometry args={[shieldR, 20, 14]} />
            <meshBasicMaterial
              color="#4dd2ff"
              transparent
              opacity={isHi('shield') ? 0.22 : 0.1}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[shieldR * 0.985, shieldR, 36]} />
            <meshBasicMaterial color="#4dd2ff" transparent opacity={0.42} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* Safe mode ring for Flight3D */}
      {safe && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[shieldR * 0.95, shieldR * 1.04, 36]} />
          <meshBasicMaterial color="#ffd23f" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

    </group>
  );
}
