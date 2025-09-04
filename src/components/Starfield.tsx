"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const StarLayer = ({ count, radius, size, color, rotationSpeed }: { count: number, radius: number, size: number, color: string, rotationSpeed: number }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * (0.8 + Math.random() * 0.2);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [count, radius]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += rotationSpeed;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color={color}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export const Starfield: React.FC = () => {
  const layers = [
    { count: 2000, radius: 30, size: 0.02, color: '#557799', rotationSpeed: 0.0001 },
    { count: 300, radius: 25, size: 0.04, color: '#FFFFFF', rotationSpeed: 0.0002 },
    { count: 20, radius: 20, size: 0.08, color: '#FFFFDD', rotationSpeed: 0.0004 },
  ];

  return (
    <group>
      {layers.map((layer, i) => (
        <StarLayer key={i} {...layer} />
      ))}
    </group>
  );
};