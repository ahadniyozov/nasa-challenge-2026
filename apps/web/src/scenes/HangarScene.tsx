import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { ContactShadows, Grid, OrbitControls, Stars } from '@react-three/drei';
import type { Bus, Component } from '@mission/engine';
import { Spacecraft } from './Spacecraft';

export function HangarScene({ bus, parts }: { bus: Bus; parts: Component[] }) {
  const big = bus.id === 'medium-bus' ? 1.6 : 1;
  const camera = useThree((s) => s.camera);
  const dist = bus.id.startsWith('cubesat') ? 3.2 : bus.id === 'smallsat' ? 6.5 : 9;
  useEffect(() => {
    camera.position.set(dist * 0.6, dist * 0.35, dist * 0.75);
    camera.lookAt(0, 0, 0);
  }, [camera, dist]);
  return (
    <>
      <color attach="background" args={['#070b14']} />
      <Stars radius={80} depth={30} count={1500} factor={3} fade />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#bcd4ff', '#1a1208', 0.8]} />
      <directionalLight position={[4, 6, 3]} intensity={2} castShadow />
      <directionalLight position={[-5, 2, -4]} intensity={0.6} color="#7aa2ff" />
      <OrbitControls enablePan={false} minDistance={1.5 * big} maxDistance={9 * big} target={[0, 0, 0]} />
      <group position={[0, 0.3, 0]}>
        <Spacecraft bus={bus} parts={parts} />
      </group>
      <Grid position={[0, -1.6 * big, 0]} args={[20, 20]} cellColor="#1e3a5f" sectionColor="#2f6fb5" fadeDistance={18} infiniteGrid />
      <ContactShadows position={[0, -1.59 * big, 0]} opacity={0.5} scale={8} blur={2.5} far={4} />
    </>
  );
}
