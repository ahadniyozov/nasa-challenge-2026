// Mission targets, one look per Mission.targets.kind, as a camera in orbit would see them (no toy shapes).
// A fixed pool of target groups is re-used every frame (no meshes are created while flying).
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { TargetKind } from '../../game2d/missions';
import type { SimState } from '../../game2d/sim';
import { GROUND_ALT, laneX, trackPos, trackTilt, type Track } from './track';

const POOL = 14;
const CALM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const v = new THREE.Vector3();

/** A hurricane seen from orbit: hundreds of soft cloud puffs along spiral bands, a clear eye in the middle (drawn once). */
function hurricaneTexture() {
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.translate(N / 2, N / 2);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const puff = (x: number, y: number, r: number, a: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  // dense central dense overcast, then four spiral rain bands (counter-clockwise, as in the northern hemisphere)
  for (let i = 0; i < 260; i++) { const a = rnd() * Math.PI * 2, r = 14 + Math.sqrt(rnd()) * 46; puff(Math.cos(a) * r, Math.sin(a) * r, 10 + rnd() * 12, 0.16); }
  for (let arm = 0; arm < 4; arm++) {
    for (let i = 0; i < 120; i++) {
      const u = i / 120, a = arm * (Math.PI / 2) - u * 5.2, r = 30 + u * 92;
      const j = (rnd() - 0.5) * (8 + u * 26);
      puff(Math.cos(a) * (r + j), Math.sin(a) * (r + j), 5 + rnd() * 9 * (1 - u * 0.5), 0.13 * (1 - u * 0.7));
    }
  }
  // the eye
  g.globalCompositeOperation = 'destination-out';
  const eye = g.createRadialGradient(0, 0, 0, 0, 0, 13);
  eye.addColorStop(0, 'rgba(0,0,0,1)'); eye.addColorStop(0.6, 'rgba(0,0,0,0.8)'); eye.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = eye; g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft round glow sprite texture, shared by all glows. */
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/**
 * Frees the GPU memory of objects built by hand (r3f only disposes what it creates itself).
 * The shared glow texture stays: every flight uses it.
 */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      const map = (mat as THREE.MeshBasicMaterial).map;
      if (map && map !== glowTex) map.dispose();
      mat.dispose();
    }
  });
}

/** fixed: materials whose opacity is base × fade; animate() drives the rest (and gets the same fade). */
interface Look { group: THREE.Group; fixed: [THREE.Material, number][]; animate(t: number, seed: number, fade: number): void; blink?: THREE.Material }

/**
 * Builds one target of the given kind, centred on its ground point (y up). The look is what a camera in orbit
 * would see: an imaging footprint (corner brackets) over the site, and the phenomenon itself, kept small and soft.
 */
function buildLook(kind: TargetKind, hurricane: THREE.Texture | null): Look {
  const group = new THREE.Group();
  const fixed: [THREE.Material, number][] = [];
  const keep = <M extends THREE.Material>(m: M, base: number) => { fixed.push([m, base]); return m; };
  const add = (o: THREE.Object3D, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); group.add(o); return o; };
  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0.03, z = 0) => {
    const m = add(new THREE.Mesh(geo, mat), x, y, z) as THREE.Mesh; m.rotation.x = -Math.PI / 2; return m;
  };
  const basic = (color: string, base: number, additive = false) => keep(new THREE.MeshBasicMaterial({
    color, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }), base);
  const sprite = (color: string, base: number, size: number, y: number, additive = true) => {
    const m = keep(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }), base);
    const sp = new THREE.Sprite(m); sp.scale.setScalar(size); add(sp, 0, y, 0); return sp;
  };
  /** the imaging footprint: four thin corner brackets on the ground */
  let blink: THREE.Material | undefined;
  const footprint = (color: string, half = 0.8) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    blink = m;
    const arm = half * 0.38, w = 0.035;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      flat(new THREE.PlaneGeometry(arm, w), m, sx * (half - arm / 2), 0.03, sz * half);
      flat(new THREE.PlaneGeometry(w, arm), m, sx * half, 0.03, sz * (half - arm / 2));
    }
  };

  if (kind === 'star') {
    // the first photo: a plain site to image
    footprint('#e9edf1');
    const dot = sprite('#ffffff', 0.9, 0.35, 0.05);
    return { group, fixed, blink, animate: (t, k) => { dot.scale.setScalar(0.3 + Math.sin(t * 4 + k) * 0.06); } };
  }
  if (kind === 'fire') {
    // active fire: red-hot pixels on the ground and a smoke plume drifting downwind
    footprint('#ff7a45');
    const hot = Array.from({ length: 6 }, (_, i) => {
      const sp = sprite(i % 2 ? '#ff4a12' : '#ffb03a', 1, 0.3, 0.05);
      sp.position.set(Math.cos(i * 2.4) * 0.28 * (i % 3), 0.05, Math.sin(i * 2.4) * 0.22 * (i % 3));
      return sp;
    });
    const smoke = Array.from({ length: 9 }, () => {
      const m = new THREE.SpriteMaterial({ map: glowTexture(), color: '#8f8a84', transparent: true, depthWrite: false });
      return add(new THREE.Sprite(m)) as THREE.Sprite;
    });
    return {
      group, fixed, blink, animate: (t, k, fade) => {
        hot.forEach((h, i) => h.scale.setScalar(0.22 + Math.abs(Math.sin(t * 9 + i * 1.7 + k)) * 0.16));
        smoke.forEach((sp, i) => {
          const u = (t * 0.22 + i / smoke.length + k * 0.1) % 1;
          sp.position.set(0.1 + u * 1.1, 0.12 + u * 1.3, -u * 0.35);
          sp.scale.setScalar(0.35 + u * 1.5);
          (sp.material as THREE.SpriteMaterial).opacity = Math.sin(u * Math.PI) * 0.5 * fade;
        });
      },
    };
  }
  if (kind === 'ice') {
    // a glacier front: icebergs calved into the sea
    footprint('#9fe6ff');
    const iceMat = keep(new THREE.MeshStandardMaterial({ color: '#f2f9ff', emissive: '#9fd8ff', emissiveIntensity: 0.15, roughness: 0.35, transparent: true }), 1);
    const bergs = [[-0.25, 0.1, 0.34], [0.22, -0.2, 0.26], [0.05, 0.32, 0.18], [0.38, 0.22, 0.14]].map(([x, z, r], i) => {
      const shape = new THREE.Shape();
      for (let j = 0; j < 7; j++) { const a = (j / 7) * Math.PI * 2, rr = r * (0.75 + ((i * 7 + j * 3) % 5) / 10); j ? shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
      return flat(geo, iceMat, x, 0.02, z);
    });
    return { group, fixed, blink, animate: (t, k) => bergs.forEach((b, i) => { b.rotation.z = k + i + t * 0.05; }) };
  }
  if (kind === 'storm') {
    // a hurricane: a spiral of cloud with an eye, and its shadow on the sea
    const shadow = keep(new THREE.MeshBasicMaterial({ map: hurricane, color: '#000000', transparent: true, depthWrite: false }), 0.35);
    const cloud = keep(new THREE.MeshBasicMaterial({ map: hurricane, transparent: true, depthWrite: false }), 1);
    const sh = flat(new THREE.CircleGeometry(1.7, 48), shadow, 0.12, 0.04, 0.1);
    const disc = flat(new THREE.CircleGeometry(1.7, 48), cloud, 0, 0.32, 0);
    return { group, fixed, blink, animate: (t, k) => { disc.rotation.z = k + t * 0.6; sh.rotation.z = disc.rotation.z; } };
  }
  if (kind === 'particle') {
    // a cloud of charged particles at the satellite's height, faintly glowing like an aurora
    const n = 150, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.6) * 0.8, y = (Math.random() - 0.5) * 0.8;
      base[i * 3] = a; base[i * 3 + 1] = r; base[i * 3 + 2] = y;
      const green = Math.random() < 0.6;
      col.set(green ? [0.45, 1, 0.7] : [0.75, 0.55, 1], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pm = keep(new THREE.PointsMaterial({ size: 0.07, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0.9);
    const pts = add(new THREE.Points(geo, pm), 0, 1.2, 0) as THREE.Points;
    sprite('#9fffc8', 0.22, 2.2, 1.2);
    return {
      group, fixed, animate: (t) => {
        for (let i = 0; i < n; i++) {
          const a = base[i * 3] + t * (0.6 - base[i * 3 + 1] * 0.4), r = base[i * 3 + 1];
          pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = base[i * 3 + 2] + Math.sin(t * 1.3 + i) * 0.04; pos[i * 3 + 2] = Math.sin(a) * r * 0.7;
        }
        (pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      },
    };
  }
  // city: street lights on a grid, densest in the centre
  footprint('#ffd28a');
  const n = 110, pos = new Float32Array(n * 3);
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < n; i++) {
    const r = Math.pow(rnd(), 1.6) * 0.7, a = rnd() * Math.PI * 2;
    pos.set([Math.round(Math.cos(a) * r / 0.07) * 0.07, 0.05, Math.round(Math.sin(a) * r / 0.07) * 0.07], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  add(new THREE.Points(geo, keep(new THREE.PointsMaterial({ size: 0.075, map: glowTexture(), color: '#ffcf7a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 1)));
  sprite('#ffb85c', 0.3, 1.6, 0.05);
  return { group, fixed, blink, animate: () => undefined };
}

export function Targets({ s, tr }: { s: SimState; tr: Track }) {
  const kind = s.m.targets.kind;
  const pool = useMemo(() => {
    const hurricane = kind === 'storm' ? hurricaneTexture() : null;
    return Array.from({ length: POOL }, () => buildLook(kind, hurricane));
  }, [kind]);
  const root = useRef<THREE.Group>(null);
  useEffect(() => () => pool.forEach((l) => disposeTree(l.group)), [pool]);

  useFrame(() => {
    let n = 0;
    for (const o of s.objects) {
      if (o.kind !== 'target' || o.done || n >= POOL) continue;
      const look = pool[n++];
      const g = look.group;
      g.visible = true;
      trackPos(tr, o.ahead, laneX(o.lane), GROUND_ALT, v);
      g.position.copy(v);
      g.rotation.set(trackTilt(tr, o.ahead), 0, 0);
      // out of the orbit's reach: a faded ghost beyond the red line
      const opacity = o.lane < 0 ? 0.35 : Math.min(1, (2.0 - o.ahead) * 2.5); // fade in over the horizon
      for (const [m, base] of look.fixed) m.opacity = base * opacity;
      look.animate(s.t, o.id * 1.7, opacity);
      // the brackets blink to draw the eye; faster once the target is close and on the satellite's lane
      if (look.blink && CALM) look.blink.opacity = opacity * 0.85;
      else if (look.blink) {
        const close = o.lane === s.lane && o.ahead < 0.7;
        const w = 0.5 + 0.5 * Math.cos(s.t * Math.PI * 2 * (close ? 3 : 1.4) + o.id);
        look.blink.opacity = opacity * (0.2 + 0.8 * w);
      }
    }
    for (let i = n; i < POOL; i++) pool[i].group.visible = false;
  });

  return <group ref={root}>{pool.map((l, i) => <primitive key={i} object={l.group} />)}</group>;
}
