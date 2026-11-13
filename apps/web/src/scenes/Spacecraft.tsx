// Procedural spacecraft built from the current design: every component you add appears on the model.
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Bus, Component } from '@mission/engine';
import { useT } from '../i18n';

const BUS_SIZE: Record<string, [number, number, number]> = {
  'cubesat-3u': [0.35, 1.0, 0.35],
  'cubesat-12u': [0.7, 1.0, 0.7],
  smallsat: [1.1, 1.2, 1.1],
  'medium-bus': [1.8, 2.2, 1.8],
};

function cellTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b1f4a';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#5b7bd5';
  g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface PartProps { label: string; onHover: (s: string | null) => void; children: React.ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }
function Part({ label, onHover, children, position, rotation }: PartProps) {
  return (
    <group
      position={position}
      rotation={rotation}
      onPointerOver={(e) => { e.stopPropagation(); onHover(label); }}
      onPointerOut={() => onHover(null)}
    >
      {children}
    </group>
  );
}

export function Spacecraft({ bus, parts, spin = true, showLabels = true }: { bus: Bus; parts: Component[]; spin?: boolean; showLabels?: boolean }) {
  const { name } = useT();
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState<string | null>(null);
  const tex = useMemo(cellTexture, []);
  const [w, h, d] = BUS_SIZE[bus.id] ?? [1, 1, 1];
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.y += dt * 0.25; });

  const count = (cat: string) => parts.filter((p) => p.category === cat);
  const solar = count('solar');
  const instruments = count('instrument');
  const comms = count('comms');
  const props = count('propulsion');
  const batteries = count('battery');

  const foil = <meshStandardMaterial color="#e0a92a" metalness={0.45} roughness={0.35} emissive="#3a2600" emissiveIntensity={0.35} />;

  return (
    <group ref={ref}>
      {/* Bus body */}
      <Part label={`${name(bus.name)} — ${bus.dryMassKg} kg`} onHover={setHover}>
        <mesh castShadow>
          <boxGeometry args={[w, h, d]} />
          {foil}
        </mesh>
        <mesh>
          <boxGeometry args={[w * 1.002, h * 0.04, d * 1.002]} />
          <meshStandardMaterial color="#333" metalness={0.6} />
        </mesh>
      </Part>

      {/* Solar: body-mounted cells cover faces, deployables become wings */}
      {solar.map((s, i) => {
        if (s.category !== 'solar') return null;
        if (s.id === 'solar-body')
          return (
            <Part key={i} label={name(s.name)} onHover={setHover}>
              {[0, 1, 2, 3].map((f) => (
                <mesh key={f} rotation={[0, (f * Math.PI) / 2, 0]} position={[Math.sin((f * Math.PI) / 2) * (w / 2 + 0.003), 0, Math.cos((f * Math.PI) / 2) * (d / 2 + 0.003)]}>
                  <planeGeometry args={[w * 0.85, h * 0.85]} />
                  <meshStandardMaterial map={tex} metalness={0.3} roughness={0.4} side={THREE.DoubleSide} />
                </mesh>
              ))}
            </Part>
          );
        // a deployable array = two symmetric wings
        const span = Math.sqrt(s.areaM2 / 2) * (bus.id.startsWith('cubesat') ? 1.6 : 1.1);
        const tier = solar.slice(0, i).filter((x) => x.id !== 'solar-body').length;
        return (
          <Part key={i} label={`${name(s.name)} — ${s.areaM2} m²`} onHover={setHover} position={[0, tier * 0.3, 0]}>
            {[1, -1].map((side) => (
              <group key={side} position={[side * (w / 2 + span / 2 + 0.08), 0, 0]}>
                <mesh>
                  <boxGeometry args={[span, 0.02, span * 0.6]} />
                  <meshStandardMaterial map={tex} metalness={0.4} roughness={0.35} />
                </mesh>
                <mesh position={[-side * (span / 2 + 0.04), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.08]} />
                  <meshStandardMaterial color="#aaa" />
                </mesh>
              </group>
            ))}
          </Part>
        );
      })}

      {/* Instruments on the nadir (bottom) face */}
      {instruments.map((ins, i) => {
        const n = instruments.length;
        const x = (i - (n - 1) / 2) * (w / Math.max(n, 2));
        const big = ins.massKg > 5;
        const r = big ? Math.min(w, d) * 0.22 : Math.min(w, d) * 0.15;
        return (
          <Part key={i} label={`${name(ins.name)} — ${ins.massKg} kg, ${ins.powerW} W`} onHover={setHover} position={[x, -h / 2 - r * 0.6, 0]}>
            <mesh>
              <cylinderGeometry args={[r, r * 1.15, r * 1.4, 24]} />
              <meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.3} />
            </mesh>
            <mesh position={[0, -r * 0.71, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[r * 0.8, 24]} />
              <meshStandardMaterial color="#111" emissive="#1d3b7a" emissiveIntensity={0.6} />
            </mesh>
          </Part>
        );
      })}

      {/* Comms: whip antennas for UHF, patch for S, dish for X/Ka */}
      {comms.map((c, i) => {
        if (c.category !== 'comms') return null;
        if (c.band === 'UHF')
          return (
            <Part key={i} label={name(c.name)} onHover={setHover} position={[w / 2, h / 2, d / 2]}>
              <mesh rotation={[0, 0, -Math.PI / 4]} position={[0.15, 0.15, 0]}>
                <cylinderGeometry args={[0.005, 0.005, 0.45]} />
                <meshStandardMaterial color="#ccc" />
              </mesh>
            </Part>
          );
        const dish = c.band === 'X' || c.band === 'Ka';
        const r = dish ? Math.min(w, d) * (c.band === 'Ka' ? 0.35 : 0.22) : 0.08;
        return (
          <Part key={i} label={`${name(c.name)} — ${c.downlinkMbps} Mbps`} onHover={setHover} position={[(i - 0.5) * w * 0.4, h / 2 + 0.05, -d * 0.2]}>
            {dish ? (
              <>
                <mesh rotation={[Math.PI, 0, 0]} position={[0, r * 0.5, 0]}>
                  <sphereGeometry args={[r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 4]} />
                  <meshStandardMaterial color="#f2f2f2" side={THREE.DoubleSide} metalness={0.2} />
                </mesh>
                <mesh position={[0, r * 0.2, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, r * 0.5]} />
                  <meshStandardMaterial color="#888" />
                </mesh>
              </>
            ) : (
              <mesh>
                <boxGeometry args={[r * 2, 0.02, r * 2]} />
                <meshStandardMaterial color="#c9a96e" metalness={0.7} />
              </mesh>
            )}
          </Part>
        );
      })}

      {/* Thrusters at the back */}
      {props.map((p, i) => (
        <Part key={i} label={name(p.name)} onHover={setHover} position={[0, -h * 0.2 + i * 0.15, -d / 2 - 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <coneGeometry args={[Math.min(w, d) * 0.1, 0.15, 16, 1, true]} />
            <meshStandardMaterial color="#555" metalness={0.8} side={THREE.DoubleSide} />
          </mesh>
        </Part>
      ))}

      {/* Battery indicator stripes on the side */}
      {batteries.map((b, i) => (
        <Part key={i} label={name(b.name)} onHover={setHover} position={[0, h * 0.3 - i * 0.12, d / 2 + 0.01]}>
          <mesh>
            <boxGeometry args={[w * 0.5, 0.06, 0.02]} />
            <meshStandardMaterial color="#2e7d32" emissive="#2e7d32" emissiveIntensity={0.4} />
          </mesh>
        </Part>
      ))}

      {showLabels && hover && (
        <Html position={[0, h / 2 + 0.6, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="tooltip3d">{hover}</div>
        </Html>
      )}
    </group>
  );
}
