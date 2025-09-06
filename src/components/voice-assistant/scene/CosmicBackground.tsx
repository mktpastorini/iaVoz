import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const Starfield = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 5000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.randFloatSpread(20);
      pos[i * 3 + 1] = THREE.MathUtils.randFloatSpread(20);
      pos[i * 3 + 2] = THREE.MathUtils.randFloatSpread(20);
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.005;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.01} color="#ffffff" />
    </points>
  );
};

const NebulaWisps = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 1000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.randFloatSpread(15);
      pos[i * 3 + 1] = THREE.MathUtils.randFloatSpread(15);
      pos[i * 3 + 2] = THREE.MathUtils.randFloatSpread(15);
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#ff00ff" transparent opacity={0.4} blending={THREE.AdditiveBlending} />
    </points>
  );
};

export const CosmicBackground = () => {
  return (
    <>
      <Starfield />
      <NebulaWisps />
    </>
  );
};