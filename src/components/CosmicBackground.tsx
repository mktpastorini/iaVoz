"use client";

import React from "react";
import { ShootingStars } from "./ShootingStars";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const CosmicBackground: React.FC = () => {
  // Star dust layer
  const starDustPositions = useMemo(() => {
    const count = 1000;
    const radius = 30;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, []);

  const starDustRef = useRef<THREE.Points>(null);

  useFrame(() => {
    if (starDustRef.current) {
      starDustRef.current.rotation.y += 0.0001;
    }
  });

  return (
    <>
      <points ref={starDustRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={starDustPositions.length / 3}
            array={starDustPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.02}
          color="#ccffff"
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </points>
      <ShootingStars />
    </>
  );
};