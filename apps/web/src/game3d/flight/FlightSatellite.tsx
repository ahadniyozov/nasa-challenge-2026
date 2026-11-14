// The satellite in the 3D flight: moves across the lanes (SimState.laneY), banks while turning,
// blinks after a hit, and wears rings for safe mode (yellow), a debris shield (cyan) and contact (green).
// The model itself is a child, so developer 2's <SatelliteModel build={...} /> drops straight in.
import { useFrame } from '@react-three/fiber';
import { useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Build } from '../../game2d/config';
import type { SimState } from '../../game2d/sim';
import { SatelliteModel } from '../SatelliteModel';
import { glowTexture } from './Targets';
import { GAP, SAT_ALT } from './track';

/** The player's satellite (developer 2's SatelliteModel). Re-renders only when asleep / safe / shadow flip, not per frame. */
export function FlightModel({ s, build }: { s: SimState; build: Build }) {
  const [st, setSt] = useState({ asleep: false, safe: false, shadow: false });
  useFrame(() => {
    if (s.asleep !== st.asleep || s.safe !== st.safe || s.shadow !== st.shadow) setSt({ asleep: s.asleep, safe: s.safe, shadow: s.shadow });
  });
  return (
    <group scale={0.62}>
      <SatelliteModel build={build} mission={s.m} asleep={st.asleep} safe={st.safe} shadow={st.shadow} />
    </group>
  );
}

/** Simple stand-in (kept for tests and as a fallback):  is ready: a gold box, wings sized by the chosen panels, a camera looking down. */
export function SatelliteStandIn({ asleep, build }: { asleep: React.MutableRefObject<boolean>; build: Build }) {
  const wing = build.panels === 'solar-deploy-l' ? 1.25 : build.panels === 'solar-deploy-s' ? 0.85 : 0.45;
  const body = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => { body.current?.color.set(asleep.current ? '#7a6630' : '#f1b93a'); });
  return (
    <group scale={0.55}>
      <mesh>
        <boxGeometry args={[0.8, 0.8, 1]} />
        <meshStandardMaterial ref={body} color="#f1b93a" metalness={0.5} roughness={0.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (0.5 + wing * 0.95), 0, 0]} scale={[wing, 1, 1]}>
          <mesh>
            <boxGeometry args={[1.9, 0.04, 0.8]} />
            <meshStandardMaterial color="#2b56c9" metalness={0.3} roughness={0.3} emissive="#0b1f66" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[-side * 0.55, 0, 0]}><boxGeometry args={[0.2, 0.05, 0.05]} /><meshStandardMaterial color="#cfd6e6" /></mesh>
        </group>
      ))}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.25, 12]} />
        <meshStandardMaterial color="#333a48" />
      </mesh>
      <mesh position={[0, 0.55, -0.2]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.25, 0.2, 16, 1, true]} />
        <meshStandardMaterial color="#e8edf5" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function FlightSatellite({ s, pos, photoAt, children }: { s: SimState; pos: THREE.Vector3; photoAt: React.MutableRefObject<number>; children: ReactNode }) {
  const root = useRef<THREE.Group>(null);
  const model = useRef<THREE.Group>(null);
  const safe = useRef<THREE.Mesh>(null);
  const shield = useRef<THREE.Mesh>(null);
  const contact = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Sprite>(null);

  useFrame(() => {
    pos.set((s.laneY - 1) * GAP, SAT_ALT, 0);
    const g = root.current;
    if (!g) return;
    g.position.copy(pos);
    // bank into the turn
    g.rotation.z = (s.laneY - s.lane) * 0.45;
    g.rotation.x = Math.sin(s.t * 1.3) * 0.03;
    if (model.current) model.current.visible = !(s.invulnerable && Math.floor(s.t * 12) % 2 === 0);
    if (safe.current) { safe.current.visible = s.safe; safe.current.rotation.z = s.t * 2; }
    if (shield.current) shield.current.visible = s.p.hearts > 3 && s.hearts > 3;
    if (contact.current) {
      contact.current.visible = s.contact && !s.p.alwaysInContact;
      const k = 1 + ((s.t * 2) % 1) * 0.8;
      contact.current.scale.setScalar(k);
      (contact.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1.8 - k);
    }
    if (flash.current) {
      const u = (s.t - photoAt.current) / 0.35;
      flash.current.visible = u >= 0 && u < 1;
      flash.current.scale.setScalar(0.6 + u * 2.4);
      (flash.current.material as THREE.SpriteMaterial).opacity = 1 - u;
    }
  });

  return (
    <group ref={root}>
      <group ref={model}>{children}</group>
      <mesh ref={safe} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[1.25, 0.05, 8, 48]} />
        <meshBasicMaterial color="#ffd23f" />
      </mesh>
      <mesh ref={shield} visible={false}>
        <sphereGeometry args={[1.05, 24, 16]} />
        <meshBasicMaterial color="#4dd2ff" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh ref={contact} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[0.95, 0.03, 6, 40]} />
        <meshBasicMaterial color="#3ddc84" transparent />
      </mesh>
      <sprite ref={flash} position={[0, -0.6, 0]} visible={false}>
        <spriteMaterial map={glowTexture()} color="#ffffff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}
