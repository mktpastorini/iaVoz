"use client";

import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const Starfield: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const numStars = 5000;
    const positions = new Float32Array(numStars * 3);
    for (let i = 0; i < numStars; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 20;
      positions[i3 + 1] = (Math.random() - 0.5) * 20;
      positions[i3 + 2] = (Math.random() - 0.5) * 20;
    }
    return positions;
  }, []);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0001;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.01} color="white" />
    </points>
  );
};

const NebulaWisps: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null!);

  const [positions, colors] = useMemo(() => {
    const numWisps = 1000;
    const positions = new Float32Array(numWisps * 3);
    const colors = new Float32Array(numWisps * 3);
    const colorCyan = new THREE.Color('#00FFFF');
    const colorMagenta = new THREE.Color('#FF00FF');

    for (let i = 0; i < numWisps; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 15;
      positions[i3 + 1] = (Math.random() - 0.5) * 15;
      positions[i3 + 2] = (Math.random() - 0.5) * 15;

      const randomColor = Math.random() > 0.5 ? colorCyan : colorMagenta;
      colors[i3] = randomColor.r;
      colors[i3 + 1] = randomColor.g;
      colors[i3 + 2] = randomColor.b;
    }
    return [positions, colors];
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0002;
      pointsRef.current.rotation.x += Math.sin(state.clock.getElapsedTime() * 0.1) * 0.0001;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} transparent opacity={0.3} vertexColors />
    </points>
  );
};

export const CosmicBackground: React.FC = () => (
  <>
    <Starfield />
    <NebulaWisps />
  </>
);