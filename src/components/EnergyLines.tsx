"use client";

import React, { useMemo, useRef } from "react";
import { Tube } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const EnergyLine = ({ curve, speed, birth, thickness }: { curve: THREE.CatmullRomCurve3, speed: number, birth: number, thickness: number }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      // Fade in and out effect
      materialRef.current.opacity = (Math.sin(clock.elapsedTime * speed + birth) + 1) / 2 * 0.4 + 0.1;
    }
  });

  return (
    <Tube args={[curve, 32, thickness, 8, false]}>
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

export const EnergyLines: React.FC<{ count?: number; radius?: number }> = ({ count = 6, radius = 2.5 }) => {
  const lines = useMemo(() => {
    return Array.from({ length: count }, () => {
      const points = [];
      const numPoints = 30;
      
      // Start near the core
      const startPoint = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      );
      points.push(startPoint);

      // Create a path that extends outwards
      let currentPoint = startPoint.clone();
      const direction = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
      ).normalize();

      for (let i = 1; i < numPoints; i++) {
        const stepLength = (radius / numPoints) * (1 + (i/numPoints)); // Accelerate outwards
        const wobble = new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5
        );
        direction.add(wobble).normalize();
        
        const nextPoint = currentPoint.clone().add(direction.clone().multiplyScalar(stepLength));
        points.push(nextPoint);
        currentPoint = nextPoint;
      }

      return {
        curve: new THREE.CatmullRomCurve3(points),
        speed: Math.random() * 0.5 + 0.2,
        birth: Math.random() * 10,
        thickness: 0.005 + Math.random() * 0.008,
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