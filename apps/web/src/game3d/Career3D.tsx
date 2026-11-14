// 3D Career globe with 6 mission markers at their real geographical regions.
// Hovering a marker shows the mission card; clicking an unlocked marker opens its brief.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useT } from '../i18n';
import { MISSIONS, type Mission } from '../game2d/missions';
import './game3d.css';

type OrbitControlsHandle = React.ComponentRef<typeof OrbitControls>;

const PROGRESS_KEY = 'g2d-progress-v1';
function loadSavedStars(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

const DEG = Math.PI / 180;
const R_GLOBE = 1;

/** Real-world geographical coordinates for each of the 6 missions. */
export const MISSION_COORDS: Record<string, { lat: number; lon: number }> = {
  first: { lat: 46, lon: 63 },        // Baikonur / Central Eurasia
  wildfire: { lat: 61, lon: 98 },     // Siberia boreal forests
  ice: { lat: 74, lon: -42 },         // Greenland glaciers (~75° N)
  weather: { lat: 23, lon: -64 },     // Tropical North Atlantic hurricane alley
  spaceweather: { lat: 69, lon: 19 }, // Northern Scandinavia / Svalbard auroral oval
  mapping: { lat: 35.7, lon: 139.7 }, // Tokyo megacity
};

export function latLonToVec3(lat: number, lon: number, r = R_GLOBE): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

const earthShader = {
  vertex: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormalW;
    void main() {
      vUv = uv;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: /* glsl */ `
    uniform sampler2D dayMap;
    uniform sampler2D nightMap;
    uniform vec3 sunDir;
    varying vec2 vUv;
    varying vec3 vNormalW;
    void main() {
      float l = dot(normalize(vNormalW), normalize(sunDir));
      float mixF = smoothstep(-0.25, 0.25, l);
      vec3 day = texture2D(dayMap, vUv).rgb * (0.38 + 0.82 * max(l, 0.0));
      vec3 night = texture2D(nightMap, vUv).rgb * 1.45 + texture2D(dayMap, vUv).rgb * 0.28;
      gl_FragColor = vec4(mix(night, day, mixF), 1.0);
    }
  `,
};

function CareerGlobe({
  stars,
  unlocked,
  activeId,
  flyTargetId,
  onHover,
  onPick,
}: {
  stars: Record<string, number>;
  unlocked(m: Mission): boolean;
  activeId: string;
  flyTargetId: string | null;
  onHover(id: string): void;
  onPick(m: Mission): void;
}) {
  const { t } = useT();
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  const globeRef = useRef<THREE.Mesh>(null!);
  const [day, night] = useLoader(THREE.TextureLoader, ['/textures/earth-day.webp', '/textures/earth-night.webp']);
  day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;

  const uniforms = useMemo(
    () => ({
      dayMap: { value: day },
      nightMap: { value: night },
      sunDir: { value: new THREE.Vector3(1.2, 0.4, 0.9).normalize() },
    }),
    [day, night],
  );

  // Pull the camera back on narrow portrait screens so the globe and its pins fit the width, not just the height
  const aspect = size.width / Math.max(1, size.height);
  const baseDist = aspect < 0.7 ? 3.3 : size.width < 600 ? 2.65 : 2.25;
  const flyGoal = useMemo(() => new THREE.Vector3(), []);
  const flyLeft = useRef(0);

  useEffect(() => {
    if (!flyTargetId) return;
    const coord = MISSION_COORDS[flyTargetId] ?? { lat: 30, lon: 0 };
    const dir = latLonToVec3(coord.lat, coord.lon, baseDist);
    flyGoal.copy(dir);
    flyLeft.current = 0.65;
  }, [flyTargetId, baseDist, flyGoal]);

  useFrame((_, dt) => {
    if (flyLeft.current <= 0) return;
    flyLeft.current = Math.max(0, flyLeft.current - dt);
    camera.position.lerp(flyGoal, Math.min(1, dt * 6));
    camera.position.normalize().multiplyScalar(baseDist);
    if (controlsRef.current) controlsRef.current.update();
  });

  const markers = useMemo(
    () =>
      MISSIONS.map((m) => {
        const c = MISSION_COORDS[m.id] ?? { lat: m.num * 12, lon: m.num * 45 };
        const pos = latLonToVec3(c.lat, c.lon, R_GLOBE * 1.015);
        const pinPos = latLonToVec3(c.lat, c.lon, R_GLOBE * 1.07);
        const normal = pos.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        return { m, pos, pinPos, quat };
      }),
    [],
  );

  return (
    <>
      <Stars radius={90} depth={40} count={1800} factor={3.5} fade />
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 3, 5]} intensity={1.8} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={1.65}
        maxDistance={Math.max(3.4, baseDist + 0.6)}
        rotateSpeed={0.75}
      />

      {/* Earth Mesh (also hides the pins on the far side: Html occlude) */}
      <mesh ref={globeRef}>
        <sphereGeometry args={[R_GLOBE, 64, 48]} />
        <shaderMaterial uniforms={uniforms} vertexShader={earthShader.vertex} fragmentShader={earthShader.fragment} />
      </mesh>

      {/* Atmosphere Rim Glow */}
      <mesh scale={1.03}>
        <sphereGeometry args={[R_GLOBE, 48, 32]} />
        <meshBasicMaterial color="#4dd2ff" transparent opacity={0.14} side={THREE.BackSide} />
      </mesh>

      {/* Subtle decorative equatorial/polar orbit rings */}
      <mesh rotation={[Math.PI / 2.2, 0.3, 0]}>
        <ringGeometry args={[1.22, 1.226, 72]} />
        <meshBasicMaterial color="#4dd2ff" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>

      {/* 6 Mission Markers on Globe */}
      {markers.map(({ m, pos, pinPos, quat }) => {
        const open = unlocked(m);
        const nStars = stars[m.id] ?? 0;
        const isActive = activeId === m.id;
        const color = !open
          ? '#5a6aa8'
          : m.level === 'Cadet'
            ? '#3ddc84'
            : m.level === 'Engineer'
              ? '#ffc53d'
              : '#ff5c6c';

        return (
          <group key={m.id}>
            {/* 3D Beacon on Surface */}
            <group position={pos} quaternion={quat}>
              <mesh position={[0, 0.025, 0]}>
                <cylinderGeometry args={[0.008, 0.018, 0.05, 10]} />
                <meshBasicMaterial color={color} />
              </mesh>
              <mesh position={[0, 0.055, 0]}>
                <sphereGeometry args={[isActive ? 0.028 : 0.02, 12, 12]} />
                <meshBasicMaterial color={isActive ? '#4dd2ff' : color} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
                <ringGeometry args={[0.032, isActive ? 0.055 : 0.044, 24]} />
                <meshBasicMaterial color={isActive ? '#4dd2ff' : color} side={THREE.DoubleSide} transparent opacity={0.85} />
              </mesh>
            </group>

            {/* Interactive HTML Marker Badge */}
            <Html position={pinPos} center zIndexRange={[20, 0]} occlude={[globeRef]}>
              <button
                type="button"
                className={`g3d-pin ${open ? '' : 'locked'} ${isActive ? 'active' : ''}`}
                disabled={!open}
                onPointerEnter={() => onHover(m.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onHover(m.id);
                  if (open) onPick(m);
                }}
              >
                <span className="p-num">{m.num}</span>
                <span className="p-emoji">{open ? m.emoji : '🔒'}</span>
                <span className="p-title">{t(m.title)}</span>
                <span className="p-stars">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={i < nStars ? 'on' : ''}>★</span>
                  ))}
                </span>
              </button>
            </Html>
          </group>
        );
      })}
    </>
  );
}

export interface Career3DProps {
  stars?: Record<string, number>;
  openAll?: boolean;
  onOpenAll?: () => void;
  onPick(m: Mission): void;
}

export function Career3D({ stars: starsProp, openAll: openAllProp, onOpenAll, onPick }: Career3DProps) {
  const { t } = useT();
  const [localStars] = useState<Record<string, number>>(loadSavedStars);
  const [localOpenAll, setLocalOpenAll] = useState(() => location.search.includes('all'));

  const stars = starsProp ?? localStars;
  const openAll = openAllProp ?? localOpenAll;
  const handleOpenAll = () => {
    setLocalOpenAll(true);
    onOpenAll?.();
  };

  const unlocked = (m: Mission) => openAll || m.num === 1 || (stars[MISSIONS[m.num - 2].id] ?? 0) > 0;
  const total = MISSIONS.reduce((s, m) => s + (stars[m.id] ?? 0), 0);

  // Default focused mission: highest unlocked mission without stars, or mission 1
  const initialMission = useMemo(() => {
    const nextUnfinished = MISSIONS.find((m) => unlocked(m) && (stars[m.id] ?? 0) === 0);
    return (nextUnfinished ?? MISSIONS[0]).id;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeId, setActiveId] = useState<string>(initialMission);
  const [flyTargetId, setFlyTargetId] = useState<string | null>(initialMission);

  const activeMission = useMemo(
    () => MISSIONS.find((m) => m.id === activeId) ?? MISSIONS[0],
    [activeId],
  );
  const activeOpen = unlocked(activeMission);
  const activeStars = stars[activeMission.id] ?? 0;

  return (
    <div className="g3d-career">
      <div className="g3d-career-canvas">
        <Canvas camera={{ position: [0, 0.8, 2.3], fov: 45 }} dpr={[1, 1.5]}>
          <Suspense fallback={null}>
            <CareerGlobe
              stars={stars}
              unlocked={unlocked}
              activeId={activeId}
              flyTargetId={flyTargetId}
              onHover={(id) => setActiveId(id)}
              onPick={onPick}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Top Header */}
      <div className="g3d-career-header">
        <h1>{t('Choose a mission')}</h1>
        <p>
          {t('Each customer needs a different satellite. Earn at least 1 ★ to unlock the next mission.')}{' '}
          <b>★ {total} / {MISSIONS.length * 3}</b>
        </p>
        {!openAll && (
          <div className="g3d-open-btn">
            <button type="button" className="g2d-ghost small" onClick={handleOpenAll}>
              {t('🔓 Open all missions')}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Dock: Mission Card + Quick Selector Bar */}
      <div className="g3d-career-dock">
        <div className="g3d-preview-card">
          <div className="emoji">{activeOpen ? activeMission.emoji : '🔒'}</div>
          <div className="info">
            <div className="info-top">
              <b>{activeMission.num}. {t(activeMission.title)}</b>
              <span className="lvl">{t(activeMission.level)}</span>
              <span className="mstars">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i < activeStars ? 'on' : ''}>★</span>
                ))}
              </span>
            </div>
            <small>{t(activeMission.learn)}</small>
          </div>
          <button
            type="button"
            className="r-btn"
            disabled={!activeOpen}
            onClick={() => {
              if (activeOpen) onPick(activeMission);
            }}
          >
            {activeOpen ? '▶' : '🔒'}
          </button>
        </div>

        <div className="g3d-mission-strip">
          {MISSIONS.map((m) => {
            const open = unlocked(m);
            const n = stars[m.id] ?? 0;
            return (
              <button
                key={m.id}
                type="button"
                className={`g3d-mstrip-btn ${open ? '' : 'locked'} ${activeId === m.id ? 'active' : ''}`}
                disabled={!open}
                onPointerEnter={() => {
                  setActiveId(m.id);
                  setFlyTargetId(m.id);
                }}
                onClick={() => {
                  setActiveId(m.id);
                  setFlyTargetId(m.id);
                  if (open) onPick(m);
                }}
              >
                <span className="s-top">{open ? m.emoji : '🔒'}</span>
                <span className="s-title">{m.num}. {t(m.title)}</span>
                <span className="s-stars">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={i < n ? 'on' : ''}>★</span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
