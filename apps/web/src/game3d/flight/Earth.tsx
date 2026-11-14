// The globe under the satellite: NASA Blue Marble by day, Black Marble city lights by night,
// a soft terminator and a thin glowing atmosphere. It spins so the ground runs under the satellite.
import { useFrame, useLoader } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { FlightParams } from '../../game2d/config';
import type { Mission } from '../../game2d/missions';
import type { SimState } from '../../game2d/sim';
import { EARTH_R, sunDir, type Track } from './track';

const D = Math.PI / 180;
/** longitude the flight starts over, so each mission begins above its own part of the world */
const START_LON: Record<string, number> = { first: 20, wildfire: 95, ice: -42, weather: -55, spaceweather: 0, mapping: 8 };

const earthVertex = /* glsl */ `
  varying vec2 vUv; varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const earthFragment = /* glsl */ `
  uniform sampler2D dayMap; uniform sampler2D nightMap; uniform vec3 sunDir; uniform float storm;
  varying vec2 vUv; varying vec3 vNormalW;
  void main() {
    float l = dot(normalize(vNormalW), sunDir);
    float dayF = smoothstep(-0.06, 0.1, l);
    vec3 dayC = texture2D(dayMap, vUv).rgb * (0.35 + 0.9 * max(l, 0.0));
    vec3 lights = texture2D(nightMap, vUv).rgb;
    vec3 nightC = lights * 1.6 + lights * lights * 2.5 + texture2D(dayMap, vUv).rgb * 0.06;
    vec3 c = mix(nightC, dayC, dayF);
    c = mix(c, c * vec3(1.25, 0.85, 0.6), storm * 0.5);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;
const atmoVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const atmoFragment = /* glsl */ `
  uniform vec3 sunDir; varying vec3 vN; varying vec3 vV;
  void main() {
    float rim = pow(1.0 - abs(dot(vN, vV)), 2.5);
    float lit = smoothstep(-0.25, 0.35, dot(vN, sunDir));
    gl_FragColor = vec4(vec3(0.35, 0.65, 1.0) * rim * (0.15 + 0.85 * lit), 1.0);
  }`;

const lonOf = (d: THREE.Vector3) => {
  // three's SphereGeometry: u = phi / 2π with x = −cos(phi), z = sin(phi); the map starts at 180° W
  let phi = Math.atan2(d.z, -d.x);
  if (phi < 0) phi += Math.PI * 2;
  return (phi / (Math.PI * 2)) * 360 - 180;
};
const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * Orientation of the globe: its pole is tilted so the track (a great circle) reaches the orbit's latitude,
 * and it starts over the mission's region. Low orbits that cannot reach the far north get 52° (the ISS-like tilt).
 */
function orientation(m: Mission, p: FlightParams, geo: boolean) {
  const [north, south] = m.targets.band;
  const maxLat = geo ? 0 : p.reachesTargets ? Math.min(85, Math.max(30, north - 3)) : 52;
  const pole = new THREE.Vector3(-Math.cos(maxLat * D), Math.sin(maxLat * D), 0).normalize();
  const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pole);
  const startLat = Math.min(maxLat - 2, Math.max(-maxLat + 2, (north + south) / 2));
  const theta0 = geo ? 0 : Math.acos(Math.min(1, Math.max(-1, Math.sin(startLat * D) / Math.sin(maxLat * D))));
  // where the satellite is over the texture at t = 0, then turn the globe about its pole to the wanted longitude
  const under = new THREE.Vector3(0, 1, 0)
    .applyAxisAngle(new THREE.Vector3(1, 0, 0), -theta0)
    .applyQuaternion(align.clone().invert());
  const lonAt = (beta: number) => lonOf(under.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -beta));
  const slope = Math.sign(wrap180(lonAt(0.01) - lonAt(0))) || 1;
  const beta = (wrap180((START_LON[m.id] ?? 0) - lonAt(0)) * D) / slope;
  return { align, theta0, beta };
}

export function Earth({ s, tr }: { s: SimState; tr: Track }) {
  // BASE_URL: the game may live in a sub-folder (GitHub Pages)
  const [day, night] = useLoader(THREE.TextureLoader, [`${import.meta.env.BASE_URL}textures/earth-day.webp`, `${import.meta.env.BASE_URL}textures/earth-night.webp`]);
  day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
  day.anisotropy = 4;
  const spin = useRef<THREE.Group>(null);
  const o = useMemo(() => orientation(s.m, s.p, tr.geo), [s, tr]);
  const meshQ = useMemo(() => o.align.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.beta)), [o]);
  const sun = useMemo(() => new THREE.Vector3(), []);
  const earthU = useMemo(() => ({ dayMap: { value: day }, nightMap: { value: night }, sunDir: { value: sun }, storm: { value: 0 } }), [day, night, sun]);
  const atmoU = useMemo(() => ({ sunDir: { value: sun } }), [sun]);

  useFrame(() => {
    sunDir(s.p, s.t, sun);
    if (spin.current) spin.current.rotation.x = o.theta0 + s.t * tr.spin;
    earthU.storm.value += ((s.storm === 2 ? 1 : 0) - earthU.storm.value) * 0.05;
  });

  // low orbit: the globe right under the satellite; geostationary: a whole globe far below
  const centre: [number, number, number] = tr.geo ? [0, -64, -118] : [0, -EARTH_R, 0];
  return (
    <group position={centre}>
      <group ref={spin}>
        <mesh quaternion={meshQ}>
          <sphereGeometry args={[EARTH_R, 160, 96]} />
          <shaderMaterial uniforms={earthU} vertexShader={earthVertex} fragmentShader={earthFragment} />
        </mesh>
      </group>
      <mesh scale={1.035}>
        <sphereGeometry args={[EARTH_R, 96, 48]} />
        <shaderMaterial uniforms={atmoU} vertexShader={atmoVertex} fragmentShader={atmoFragment} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}
