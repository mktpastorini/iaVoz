"use client";

import React, { useMemo, useRef } from "react";
import { Tube } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const EnergyLine = ({ curve, speed, birth, thickness }: { curve: THREE.CatmullRomCurve3, speed: number, birth: number, thickness: number }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity = (Math.sin(clock.elapsedTime * speed + birth) + 1) / 2 * 0.7 + 0.3;
    }
  });

  return (
    <Tube args={[curve, 32, thickness, 8, false]}>
      <meshBasicMaterial
        ref={materialRef}
        color="#99FFFF"
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </Tube>
  );
};

export const EnergyLines: React.FC<{ count?: number; radius?: number }> = ({ count = 15, radius = 1.5 }) => {
  const lines = useMemo(() => {
    return Array.from({ length: count }, () => {
      const points = Array.from({ length: 10 }, () => {
        const direction = new THREE.Vector3(
          (Math.random() - 0.5),
          (Math.random() - 0.5),
          (Math.random() - 0.5)
        ).normalize();
        // Constrain the lines to be *inside* the orb
        const scalar = radius * (0.1 + Math.random() * 0.8);
        return direction.multiplyScalar(scalar);
      });
      return {
        curve: new THREE.CatmullRomCurve3(points),
        speed: Math.random() * 1.5 + 0.5,
        birth: Math.random() * 10,
        thickness: 0.002 + Math.random() * 0.003,
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