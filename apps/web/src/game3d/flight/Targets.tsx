// Mission targets on the ground, one look per Mission.targets.kind, built from simple meshes.
// A fixed pool of target groups is re-used every frame (no meshes are created while flying).
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { TargetKind } from '../../game2d/missions';
import type { SimState } from '../../game2d/sim';
import { GROUND_ALT, laneX, trackPos, trackTilt, type Track } from './track';

const POOL = 14;
const v = new THREE.Vector3();

/** A canvas texture of a two-armed hurricane spiral (drawn once). */
function spiralTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.translate(64, 64);
  const glow = g.createRadialGradient(0, 0, 4, 0, 0, 62);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)'); glow.addColorStop(0.5, 'rgba(220,235,255,0.45)'); glow.addColorStop(1, 'rgba(220,235,255,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 9; g.lineCap = 'round';
  for (let arm = 0; arm < 2; arm++) {
    g.beginPath();
    for (let i = 0; i <= 40; i++) { const a = arm * Math.PI + i * 0.13, r = 6 + i * 1.3; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.stroke();
  }
  g.fillStyle = '#4a7fd0'; g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
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

interface Look { group: THREE.Group; mats: THREE.Material[]; animate(t: number, seed: number): void }

/** Builds one target of the given kind (all parts centred on the ground point, y up). */
function buildLook(kind: TargetKind, spiral: THREE.Texture | null): Look {
  const group = new THREE.Group();
  const mats: THREE.Material[] = [];
  const std = (color: string, emissive = '#000000', ei = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.6, flatShading: true, transparent: true });
    mats.push(m); return m;
  };
  const glow = (color: string, size: number, y = 0.2) => {
    const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    mats.push(m);
    const sp = new THREE.Sprite(m); sp.scale.setScalar(size); sp.position.y = y; group.add(sp); return sp;
  };
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };

  if (kind === 'fire') {
    glow('#ff8a1f', 2.2, 0.35);
    const flames = [[0, 0, 0, 0.9], [0.32, 0, 0.15, 0.6], [-0.3, 0, -0.1, 0.65], [0.05, 0, -0.32, 0.5]].map(([x, , z, h]) =>
      add(new THREE.ConeGeometry(0.2 * (h + 0.3), h, 6), std('#ff5a1f', '#ff3d00', 1.6), x, h / 2, z));
    const cores = flames.map((f) => add(new THREE.ConeGeometry(0.1, (f.geometry as THREE.ConeGeometry).parameters.height * 0.6, 5), std('#ffd23f', '#ffb300', 2), f.position.x, f.position.y * 0.7, f.position.z));
    return { group, mats, animate: (t, k) => flames.forEach((f, i) => { const s = 1 + Math.sin(t * 15 + i * 2 + k) * 0.15; f.scale.set(1, s, 1); cores[i].scale.set(1, s * 1.1, 1); }) };
  }
  if (kind === 'star') {
    glow('#ffe066', 1.8, 0.7);
    const star = add(new THREE.OctahedronGeometry(0.42, 0), std('#ffe066', '#ffcc00', 1.4), 0, 0.7, 0);
    star.scale.set(1, 1.4, 1);
    return { group, mats, animate: (t, k) => { star.rotation.y = t * 2 + k; } };
  }
  if (kind === 'ice') {
    glow('#5fe3ff', 1.8, 0.3);
    const geo = new THREE.IcosahedronGeometry(0.55, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(0, pos.getY(i)) * 1.5); // flat bottom, tall top
    geo.computeVertexNormals();
    const berg = add(geo, std('#7fe9ff', '#2fbfe0', 0.35));
    add(new THREE.ConeGeometry(0.22, 0.5, 4), std('#ffffff', '#bff6ff', 0.4), 0.15, 0.85, 0.05);
    return { group, mats, animate: (t, k) => { berg.rotation.y = k; group.position.y += Math.sin(t * 2 + k) * 0.002; } };
  }
  if (kind === 'storm') {
    const m = new THREE.MeshBasicMaterial({ map: spiral, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    mats.push(m);
    const disc = add(new THREE.CircleGeometry(1.1, 32), m, 0, 0.12, 0);
    disc.rotation.x = -Math.PI / 2;
    return { group, mats, animate: (t, k) => { disc.rotation.z = t * 3 + k; } };
  }
  if (kind === 'particle') {
    glow('#b878ff', 2.4, 0.6);
    add(new THREE.IcosahedronGeometry(0.28, 1), std('#d9b8ff', '#9a55ff', 1.5), 0, 0.6, 0);
    const dots = Array.from({ length: 7 }, () => add(new THREE.SphereGeometry(0.07, 6, 4), std('#f1e4ff', '#c79bff', 2), 0, 0.6, 0));
    return {
      group, mats, animate: (t, k) => dots.forEach((d, i) => {
        const a = k + t * 2.2 + i * 0.9;
        d.position.set(Math.cos(a) * 0.55, 0.6 + Math.sin(a * 1.3) * 0.35, Math.sin(a) * 0.55);
      }),
    };
  }
  // city: a cluster of towers with lit windows
  glow('#ffd88a', 2.0, 0.2);
  const towers: [number, number, number][] = [[-0.35, 0.5, 0.1], [-0.05, 0.85, -0.1], [0.25, 0.45, 0.15], [0.45, 0.65, -0.2], [0.05, 0.35, 0.35], [-0.4, 0.3, -0.35]];
  const wall = std('#cfd6e6', '#ffcf66', 0.25);
  for (const [x, h, z] of towers) add(new THREE.BoxGeometry(0.22, h, 0.22), wall, x, h / 2, z);
  return { group, mats, animate: () => undefined };
}

export function Targets({ s, tr }: { s: SimState; tr: Track }) {
  const kind = s.m.targets.kind;
  const pool = useMemo(() => {
    const spiral = kind === 'storm' ? spiralTexture() : null;
    return Array.from({ length: POOL }, () => buildLook(kind, spiral));
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
      for (const m of look.mats) m.opacity = opacity;
      look.animate(s.t, o.id * 1.7);
    }
    for (let i = n; i < POOL; i++) pool[i].group.visible = false;
  });

  return <group ref={root}>{pool.map((l, i) => <primitive key={i} object={l.group} />)}</group>;
}
