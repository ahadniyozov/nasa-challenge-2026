// Earth, the chosen orbit, Earth's shadow and ground-station links - the trade-offs, visible.
import { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { physics, type GroundStation, type Orbit } from '@mission/engine';

const R = 1; // Earth radius in scene units
const KM = 1 / physics.EARTH_RADIUS_KM;
export const SUN = new THREE.Vector3(1, 0, 0);
const DEG = Math.PI / 180;
const MIN_ELEV = Math.sin(10 * DEG);

export function latLonToVec(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/** Position on a circular orbit: argument of latitude u, inclination i, RAAN raan. */
export function orbitPos(r: number, u: number, inc: number, raan: number, out = new THREE.Vector3()) {
  const x = r * Math.cos(u);
  const z0 = r * Math.sin(u);
  out.set(x, -z0 * Math.sin(inc), z0 * Math.cos(inc));
  return out.applyAxisAngle(new THREE.Vector3(0, 1, 0), raan);
}

export function inShadow(p: THREE.Vector3) {
  const along = p.dot(SUN);
  if (along > 0) return false;
  const perp = p.clone().sub(SUN.clone().multiplyScalar(along));
  return perp.length() < R;
}

const earthShader = {
  vertex: /* glsl */ `
    varying vec2 vUv; varying vec3 vNormalW;
    void main() {
      vUv = uv;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragment: /* glsl */ `
    uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunDir;
    varying vec2 vUv; varying vec3 vNormalW;
    void main() {
      float l = dot(normalize(vNormalW), normalize(sunDir));
      float mixF = smoothstep(-0.15, 0.2, l);
      vec3 day = texture2D(dayMap, vUv).rgb * (0.25 + 0.95 * max(l, 0.0));
      vec3 night = texture2D(nightMap, vUv).rgb * 1.4 + texture2D(dayMap, vUv).rgb * 0.3;
      gl_FragColor = vec4(mix(night, day, mixF), 1.0);
    }`,
};

export function Earth({ rotation }: { rotation: React.MutableRefObject<number> }) {
  const [day, night] = useLoader(THREE.TextureLoader, ['/textures/earth-day.webp', '/textures/earth-night.webp']);
  day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
  const ref = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ dayMap: { value: day }, nightMap: { value: night }, sunDir: { value: SUN } }), [day, night]);
  useFrame(() => { if (ref.current) ref.current.rotation.y = rotation.current; });
  return (
    <>
      <mesh ref={ref}>
        <sphereGeometry args={[R, 96, 64]} />
        <shaderMaterial uniforms={uniforms} vertexShader={earthShader.vertex} fragmentShader={earthShader.fragment} />
      </mesh>
      {/* atmosphere glow */}
      <mesh scale={1.025}>
        <sphereGeometry args={[R, 64, 32]} />
        <meshBasicMaterial color="#5fa8ff" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
    </>
  );
}

/** Long dark cylinder behind Earth = the shadow the satellite must survive on batteries. */
function ShadowVolume({ length }: { length: number }) {
  return (
    <mesh position={[-length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[R, R, length, 48, 1, true]} />
      <meshBasicMaterial color="#000814" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

export interface OrbitSceneProps {
  orbit: Orbit;
  stations: GroundStation[];
  /** simulated seconds per real second */
  timeScale?: number;
  alert?: 'storm' | null;
  onTelemetry?: (t: { inShadow: boolean; linkTo: string | null }) => void;
}

export function OrbitScene({ orbit, stations, timeScale = 300, alert = null, onTelemetry }: OrbitSceneProps) {
  const r = R + orbit.altitudeKm * KM;
  const inc = orbit.inclinationDeg * DEG;
  const raan = orbit.kind === 'SSO' ? 35 * DEG : 15 * DEG;
  const period = physics.periodMin(orbit.altitudeKm) * 60;
  const isGeo = orbit.kind === 'GEO';

  const earthRot = useRef(0);
  const t = useRef(0);
  const sat = useRef<THREE.Group>(null);
  const satMat = useRef<THREE.MeshStandardMaterial>(null);
  const linkGeom = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), []);
  const linkObj = useMemo(() => new THREE.Line(linkGeom, new THREE.LineBasicMaterial({ color: '#22c55e' })), [linkGeom]);
  const linkLine = useRef<THREE.Line>(linkObj);
  const lastTele = useRef('');

  const ring = useMemo(() => Array.from({ length: 181 }, (_, k) => orbitPos(r, (k / 180) * Math.PI * 2, inc, raan)), [r, inc, raan]);
  const stationVecs = useMemo(() => stations.map((s) => ({ s, local: latLonToVec(s.lat, s.lon, R * 1.003) })), [stations]);

  useFrame((_, dt) => {
    t.current += dt * timeScale;
    earthRot.current = (t.current / 86164) * Math.PI * 2;
    // GEO co-rotates with Earth; everyone else flies their own period
    const u = isGeo ? earthRot.current + Math.PI / 3 : (t.current / period) * Math.PI * 2;
    const p = orbitPos(r, u, inc, raan);
    if (sat.current) {
      sat.current.position.copy(p);
      sat.current.lookAt(0, 0, 0);
    }
    const shadow = inShadow(p);
    if (satMat.current) satMat.current.emissiveIntensity = shadow ? 0.05 : 1.2;

    let best: { from: THREE.Vector3; to: THREE.Vector3; id: string } | null = null;
    for (const { s, local } of stationVecs) {
      const g = local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), earthRot.current);
      const v = p.clone().sub(g);
      if (v.dot(g.clone().normalize()) / v.length() > MIN_ELEV) { best = { from: g, to: p.clone(), id: s.name }; break; }
    }
    if (linkLine.current) {
      linkLine.current.visible = !!best;
      if (best) {
        linkGeom.setFromPoints([best.from, best.to]);
      }
    }
    const key = `${shadow}|${best?.id ?? ''}`;
    if (onTelemetry && key !== lastTele.current) {
      lastTele.current = key;
      onTelemetry({ inShadow: shadow, linkTo: best?.id ?? null });
    }
  });

  const camDist = Math.max(3.2, r * 2.6);

  return (
    <>
      <color attach="background" args={['#02040a']} />
      <Stars radius={120} depth={60} count={4000} factor={4} fade />
      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 0, 0]} intensity={alert === 'storm' ? 4 : 2.2} color={alert === 'storm' ? '#ffb070' : '#ffffff'} />
      <OrbitControls enablePan={false} minDistance={1.6} maxDistance={camDist * 3} />
      <PerspectiveCam distance={camDist} />

      <Earth rotation={earthRot} />
      <ShadowVolume length={Math.max(r * 3, 4)} />

      <Line points={ring} color={orbit.kind === 'SSO' ? '#7dd3fc' : '#a5b4fc'} lineWidth={1.2} transparent opacity={0.7} />

      <EarthFixed rotation={earthRot}>
        {stationVecs.map(({ s, local }) => (
          <mesh key={s.id} position={local}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
        ))}
      </EarthFixed>

      <primitive object={linkObj} />

      <group ref={sat}>
        <mesh>
          <boxGeometry args={[0.035, 0.035, 0.035]} />
          <meshStandardMaterial ref={satMat} color="#ffd36b" emissive="#ffb300" emissiveIntensity={1.2} />
        </mesh>
        <mesh position={[0.05, 0, 0]}><boxGeometry args={[0.06, 0.002, 0.03]} /><meshStandardMaterial color="#2c4fa3" /></mesh>
        <mesh position={[-0.05, 0, 0]}><boxGeometry args={[0.06, 0.002, 0.03]} /><meshStandardMaterial color="#2c4fa3" /></mesh>
      </group>

      {/* Sun marker */}
      <mesh position={[40, 0, 0]}>
        <sphereGeometry args={[1.2, 24, 24]} />
        <meshBasicMaterial color={alert === 'storm' ? '#ff9a3c' : '#fff3c4'} />
      </mesh>
    </>
  );
}

export function EarthFixed({ rotation, children }: { rotation: React.MutableRefObject<number>; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => { if (g.current) g.current.rotation.y = rotation.current; });
  return <group ref={g}>{children}</group>;
}

function PerspectiveCam({ distance }: { distance: number }) {
  const done = useRef<number | null>(null);
  useFrame(({ camera }) => {
    if (done.current === distance) return;
    camera.position.set(distance * 0.75, distance * 0.4, distance * 0.55);
    camera.lookAt(0, 0, 0);
    done.current = distance;
  });
  return null;
}
