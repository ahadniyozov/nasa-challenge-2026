// Launch pad -> liftoff -> ascent. Rocket size follows the chosen launcher; failure is shown honestly.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

const SIZE: Record<string, number> = { rideshare: 1.6, small: 0.8, medium: 1.3, heavy: 1.8 };
const N_SMOKE = 60;

export function LaunchScene({ launcherId, failed, onDone }: { launcherId: string; failed: boolean; onDone: () => void }) {
  const s = SIZE[launcherId] ?? 1;
  const rocket = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const boom = useRef<THREE.Mesh>(null);
  const t = useRef(-2.5); // countdown seconds before ignition
  const finished = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => Array.from({ length: N_SMOKE }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()]), []);

  useFrame(({ camera }, dt) => {
    t.current += dt;
    const time = t.current;
    const ignited = time > 0;
    const y = ignited ? 0.5 * 1.6 * time * time : 0; // constant acceleration
    const failAt = 3.2;
    const exploded = failed && time > failAt;

    if (rocket.current) {
      rocket.current.position.y = exploded ? 0.5 * 1.6 * failAt * failAt : y;
      rocket.current.rotation.z = ignited && !exploded ? -Math.min(0.5, time * 0.05) : 0; // gravity turn
      rocket.current.visible = !exploded;
    }
    if (flame.current) {
      flame.current.visible = ignited && !exploded;
      flame.current.scale.y = 1 + Math.sin(time * 40) * 0.15;
    }
    if (light.current) light.current.intensity = ignited && !exploded ? 30 : 0;
    if (boom.current) {
      boom.current.visible = exploded;
      const k = Math.min(1, (time - failAt) * 1.5);
      boom.current.scale.setScalar(0.2 + k * 3);
      (boom.current.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      boom.current.position.y = 0.5 * 1.6 * failAt * failAt;
    }
    if (smoke.current) {
      seeds.forEach(([sx, sz, sp], i) => {
        const age = ignited ? ((time * 0.6 + sp) % 1) : 0;
        dummy.position.set(sx * age * 3, 0.2 + age * 0.4, sz * age * 3);
        dummy.scale.setScalar(ignited ? 0.3 + age * 1.2 : 0.0001);
        dummy.updateMatrix();
        smoke.current!.setMatrixAt(i, dummy.matrix);
      });
      smoke.current.instanceMatrix.needsUpdate = true;
    }
    // camera follows
    const followY = rocket.current ? rocket.current.position.y : 0;
    camera.position.set(11, 3 + followY * 0.85, 16);
    camera.lookAt(0, 1.5 * s + followY, 0);

    if (!finished.current && (time > 8 || (exploded && time > failAt + 2.5))) {
      finished.current = true;
      onDone();
    }
  });

  const skyColor = '#0a1630';
  return (
    <>
      <color attach="background" args={[skyColor]} />
      <fog attach="fog" args={[skyColor, 20, 120]} />
      <Stars radius={100} depth={40} count={2500} factor={4} fade />
      <hemisphereLight args={['#88aaff', '#202020', 0.6]} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />

      {/* ground + pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1c2a1c" />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[2, 2.2, 0.2, 32]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      <mesh position={[1.2 * s, 2.2 * s, 0]}>
        <boxGeometry args={[0.35, 4.4 * s, 0.35]} />
        <meshStandardMaterial color="#8b1e1e" wireframe />
      </mesh>

      <group ref={rocket} position={[0, 0, 0]}>
        <group position={[0, 0.2, 0]}>
          <mesh position={[0, 2 * s, 0]}>
            <cylinderGeometry args={[0.3 * s, 0.3 * s, 4 * s, 24]} />
            <meshStandardMaterial color="#f1f1f1" metalness={0.2} roughness={0.5} />
          </mesh>
          <mesh position={[0, 4.4 * s, 0]}>
            <coneGeometry args={[0.32 * s, 0.9 * s, 24]} />
            <meshStandardMaterial color="#e8e8e8" />
          </mesh>
          <mesh position={[0, 1.2 * s, 0]}>
            <cylinderGeometry args={[0.305 * s, 0.305 * s, 0.15 * s, 24]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * 0.35 * s, 0.3 * s, Math.sin((k * Math.PI) / 2) * 0.35 * s]} rotation={[0, (-k * Math.PI) / 2, 0]}>
              <boxGeometry args={[0.25 * s, 0.6 * s, 0.03]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          ))}
          <mesh ref={flame} position={[0, -0.6 * s, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.25 * s, 1.6 * s, 16, 1, true]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.9} />
          </mesh>
          <pointLight ref={light} position={[0, -0.8, 0]} color="#ff9a3c" distance={25} intensity={0} />
        </group>
      </group>

      <instancedMesh ref={smoke} args={[undefined, undefined, N_SMOKE]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#bbbbbb" transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>

      <mesh ref={boom} visible={false}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color="#ff7a1a" transparent opacity={1} />
      </mesh>
    </>
  );
}
