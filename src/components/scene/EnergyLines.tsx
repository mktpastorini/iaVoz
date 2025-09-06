"use client";

import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Tube } from '@react-three/drei';

const EnergyLine: React.FC = () => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);
  
  const curve = useMemo(() => {
    const points = [];
    const startRadius = 1.8 + Math.random() * 0.5;
    const endRadius = 1.8 + Math.random() * 0.5;
    const startAngle = Math.random() * Math.PI * 2;
    const endAngle = startAngle + Math.PI + Math.random() * Math.PI;

    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const angle = THREE.MathUtils.lerp(startAngle, endAngle, t);
      const radius = THREE.MathUtils.lerp(startRadius, endRadius, t);
      const y = (Math.random() - 0.5) * 2 * t * (1 - t) * 4; // Arching effect
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
    return new THREE.CatmullRomCurve3(points);
  }, []);

  const randomFactor = useMemo(() => Math.random() * 2 + 1, []);

  useFrame(({ clock }) => {
    materialRef.current.opacity = (Math.sin(clock.getElapsedTime() * randomFactor) + 1) / 2 * 0.5 + 0.1;
  });

  return (
    <Tube args={[curve, 64, 0.005, 8, false]}>
      <meshBasicMaterial ref={materialRef} color="#00FFFF" toneMapped={false} blending={THREE.AdditiveBlending} transparent />
    </Tube>
  );
};

export const EnergyLines: React.FC = () => {
  const numLines = 20;
  return (
    <group>
      {Array.from({ length: numLines }).map((_, i) => (
        <EnergyLine key={i} />
      ))}
    </group>
  );
};