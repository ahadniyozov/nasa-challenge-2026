// The globe under the satellite: NASA Blue Marble by day (8K on computers), Black Marble city lights by night,
// a drifting cloud layer with its shadows, sun glint on the oceans, a warm terminator and the atmosphere's haze. It spins so the ground runs under the satellite.
import { useFrame, useLoader, useThree } from '@react-three/fiber';
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
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
// Day: Blue Marble with sunlight, ocean sun glint (water mask) and the shadows of the cloud layer above.
// Night: Black Marble city lights, dimmed under clouds. Between them a warm terminator, and blue haze towards the limb.
const earthFragment = /* glsl */ `
  uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D cloudMap; uniform sampler2D waterMap;
  uniform vec3 sunDir; uniform float storm; uniform float cloudShift;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float l = dot(N, sunDir);
    float dayF = smoothstep(-0.08, 0.14, l);
    vec3 albedo = texture2D(dayMap, vUv).rgb;
    float water = texture2D(waterMap, vUv).r;
    vec2 cuv = vUv + vec2(cloudShift, 0.0);
    float cloud = smoothstep(0.15, 0.9, texture2D(cloudMap, cuv).r);
    float shade = smoothstep(0.15, 0.9, texture2D(cloudMap, cuv + vec2(0.0012, 0.0008)).r);

    vec3 dayC = albedo * (0.05 + 1.1 * max(l, 0.0)) * (1.0 - 0.4 * shade);
    vec3 H = normalize(sunDir + V);
    float glint = pow(max(dot(N, H), 0.0), 70.0) * water * (1.0 - cloud);
    dayC += vec3(1.0, 0.93, 0.8) * glint * 0.9 * step(0.0, l);
    dayC += water * vec3(0.0, 0.015, 0.04) * max(l, 0.0);

    vec3 lights = texture2D(nightMap, vUv).rgb;
    lights = pow(lights, vec3(1.6)) * vec3(1.9, 1.35, 0.85) * 2.2 * (1.0 - 0.75 * cloud);
    vec3 nightC = lights + albedo * 0.012;

    vec3 c = mix(nightC, dayC, dayF);
    c += vec3(0.5, 0.2, 0.06) * exp(-pow(l / 0.09, 2.0)) * 0.18;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 haze = vec3(0.3, 0.55, 1.0) * smoothstep(-0.25, 0.45, l);
    c = mix(c, haze, rim * 0.22) + haze * 0.02;
    c = mix(c, c * vec3(1.25, 0.85, 0.6), storm * 0.5);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;
// The cloud layer: a thin shell just above the ground, lit by the Sun, faintly visible at night.
const cloudFragment = /* glsl */ `
  uniform sampler2D cloudMap; uniform vec3 sunDir; uniform float cloudShift;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    float l = dot(N, sunDir);
    float a = smoothstep(0.15, 0.9, texture2D(cloudMap, vUv + vec2(cloudShift, 0.0)).r);
    float lit = 0.03 + 1.05 * smoothstep(-0.12, 0.6, l);
    vec3 c = vec3(1.0, 0.99, 0.97) * lit;
    c = mix(c, vec3(1.0, 0.72, 0.5) * lit, exp(-pow(l / 0.12, 2.0)) * 0.6);
    gl_FragColor = vec4(c, a * 0.92);
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
    float rim = pow(1.0 - abs(dot(vN, vV)), 6.0);
    float lit = smoothstep(-0.3, 0.4, dot(vN, sunDir));
    vec3 col = mix(vec3(0.95, 0.5, 0.25), vec3(0.32, 0.6, 1.0), smoothstep(-0.05, 0.3, dot(vN, sunDir)));
    gl_FragColor = vec4(col * rim * (0.05 + 0.7 * lit), 1.0);
  }`;

/** phones get the 4K day map (8K textures are slow or refused on many mobile GPUs) */
const PHONE = typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700);
const TEX = (f: string) => `${import.meta.env.BASE_URL}textures/${f}`;

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
  const [day, night, clouds, water] = useLoader(THREE.TextureLoader, [
    TEX(PHONE ? 'earth-day-4k.webp' : 'earth-day-8k.webp'), TEX('earth-night-4k.webp'), TEX('earth-clouds-4k.webp'), TEX('earth-water-2k.webp'),
  ]);
  const gl = useThree((st) => st.gl);
  day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
  for (const t of [day, night, clouds, water]) { t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy()); t.wrapS = THREE.RepeatWrapping; }
  const spin = useRef<THREE.Group>(null);
  const o = useMemo(() => orientation(s.m, s.p, tr.geo), [s, tr]);
  const meshQ = useMemo(() => o.align.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.beta)), [o]);
  const sun = useMemo(() => new THREE.Vector3(), []);
  const earthU = useMemo(() => ({
    dayMap: { value: day }, nightMap: { value: night }, cloudMap: { value: clouds }, waterMap: { value: water },
    sunDir: { value: sun }, storm: { value: 0 }, cloudShift: { value: 0 },
  }), [day, night, clouds, water, sun]);
  const cloudU = useMemo(() => ({ cloudMap: { value: clouds }, sunDir: { value: sun }, cloudShift: earthU.cloudShift }), [clouds, sun, earthU]);
  const atmoU = useMemo(() => ({ sunDir: { value: sun } }), [sun]);

  useFrame(() => {
    sunDir(s.p, s.t, sun);
    if (spin.current) spin.current.rotation.x = o.theta0 + s.t * tr.spin;
    earthU.storm.value += ((s.storm === 2 ? 1 : 0) - earthU.storm.value) * 0.05;
    earthU.cloudShift.value = s.t * 0.0004; // the weather drifts a little against the ground
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
        <mesh quaternion={meshQ} scale={1 + 0.1 / EARTH_R}>
          <sphereGeometry args={[EARTH_R, 160, 96]} />
          <shaderMaterial uniforms={cloudU} vertexShader={earthVertex} fragmentShader={cloudFragment} transparent depthWrite={false} />
        </mesh>
      </group>
      <mesh scale={1.01}>
        <sphereGeometry args={[EARTH_R, 96, 48]} />
        <shaderMaterial uniforms={atmoU} vertexShader={atmoVertex} fragmentShader={atmoFragment} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}
