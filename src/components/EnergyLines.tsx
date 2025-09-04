"use client";

import React, { useMemo, useRef } from "react";
import { Tube } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const EnergyLine = ({ curve, speed, birth, thickness }: { curve: THREE.CatmullRomCurve3, speed: number, birth: number, thickness: number }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      // Opacity oscillates to simulate flickering energy
      materialRef.current.opacity = (Math.sin(clock.elapsedTime * speed + birth) + 1) / 2 * 0.5 + 0.5;
    }
  });

  return (
    <Tube args={[curve, 64, thickness, 8, false]}>
      <meshBasicMaterial
        ref={materialRef}
        color="#00FFFF"
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </Tube>
  );
};

export const EnergyLines: React.FC<{ count?: number; radius?: number }> = ({ count = 5, radius = 1.5 }) => {
  const lines = useMemo(() => {
    return Array.from({ length: count }, () => {
      // Generate points that start inside orb and expand far outside
      const points = Array.from({ length: 15 }, (_, i) => {
        const direction = new THREE.Vector3(
          (Math.random() - 0.5),
          (Math.random() - 0.5),
          (Math.random() - 0.5)
        ).normalize();
        // First half points inside orb, second half extend far outside (up to 4x radius)
        const scalar = i < 7 ? radius * (0.2 + Math.random() * 0.8) : radius * (2 + Math.random() * 2);
        return direction.multiplyScalar(scalar);
      });
      return {
        curve: new THREE.CatmullRomCurve3(points),
        speed: Math.random() * 0.5 + 0.2,
        birth: Math.random() * 10,
        thickness: 0.001 + Math.random() * 0.005,
      };
    });
  }, [count, radius]);

  return (
    <group>
      {lines.map((line, i) => (
        <EnergyLine key={i} {...line} />
      ))}
    </group>
  );
};