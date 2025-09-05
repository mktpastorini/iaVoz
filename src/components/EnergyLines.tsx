"use client";

import React, { useMemo, useRef } from "react";
import { Tube } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const EnergyLine = ({ curve, speed, birth, thickness }: { curve: THREE.CatmullRomCurve3, speed: number, birth: number, thickness: number }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      // Opacity pulsates between 0.05 and 0.25
      const baseOpacity = (Math.sin(clock.elapsedTime * speed + birth) + 1) / 2 * 0.2 + 0.05;

      // Additional subtle "running light" effect using a sine wave offset by position along curve
      // We'll simulate this by modulating opacity with a slow moving wave
      const time = clock.elapsedTime;
      const pulseSpeed = 0.5; // slow pulse speed
      const pulse = (Math.sin(time * pulseSpeed + birth * 5) + 1) / 2 * 0.3; // 0 to 0.3

      materialRef.current.opacity = THREE.MathUtils.clamp(baseOpacity + pulse, 0, 0.5);
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

export const EnergyLines: React.FC<{ count?: number; radius?: number }> = ({ count = 12, radius = 2.5 }) => {
  const lines = useMemo(() => {
    return Array.from({ length: count }, () => {
      const points = [];
      const numPoints = 20;
      
      const startPoint = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(radius * 2),
        THREE.MathUtils.randFloatSpread(radius * 2),
        THREE.MathUtils.randFloatSpread(radius * 2)
      ).normalize().multiplyScalar(radius * 0.5 + Math.random() * radius);

      const endPoint = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(radius * 2),
        THREE.MathUtils.randFloatSpread(radius * 2),
        THREE.MathUtils.randFloatSpread(radius * 2)
      ).normalize().multiplyScalar(radius * 0.5 + Math.random() * radius);

      const controlPoint1 = new THREE.Vector3().lerpVectors(startPoint, endPoint, 0.25).add(
        new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(radius),
          THREE.MathUtils.randFloatSpread(radius),
          THREE.MathUtils.randFloatSpread(radius)
        )
      );
      const controlPoint2 = new THREE.Vector3().lerpVectors(startPoint, endPoint, 0.75).add(
        new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(radius),
          THREE.MathUtils.randFloatSpread(radius),
          THREE.MathUtils.randFloatSpread(radius)
        )
      );

      const curve = new THREE.CubicBezierCurve3(startPoint, controlPoint1, controlPoint2, endPoint);
      
      return {
        curve: curve,
        speed: Math.random() * 0.5 + 0.2,
        birth: Math.random() * 10,
        thickness: 0.0015 + Math.random() * 0.002,
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