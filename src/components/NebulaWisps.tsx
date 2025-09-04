"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const NebulaWisps: React.FC = () => {
  const particleCount = 1000;
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const colorOptions = [
      new THREE.Color("#7B2FF7"), // Roxo
      new THREE.Color("#FF00FF"), // Magenta
      new THREE.Color("#00FFFF"), // Ciano
    ];

    for (let i = 0; i < particleCount; i++) {
      // Distribute in a wide, flat-ish area
      pos[i * 3] = THREE.MathUtils.randFloatSpread(40);
      pos[i * 3 + 1] = THREE.MathUtils.randFloatSpread(20);
      pos[i * 3 + 2] = THREE.MathUtils.randFloatSpread(10) - 15; // Positioned behind the orb

      const c = colorOptions[Math.floor(Math.random() * colorOptions.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, [particleCount]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0002;
      pointsRef.current.rotation.x += 0.0001;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};