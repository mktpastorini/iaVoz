"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const StarLayer = ({ count, radius, size, color, isCometLayer }: { count: number, radius: number, size: number, color: string, isCometLayer?: boolean }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * (0.8 + Math.random() * 0.2);
      const position = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      const speed = isCometLayer ? 0.05 + Math.random() * 0.1 : 0.002 + Math.random() * 0.003;
      return { position, speed };
    });
  }, [count, radius, isCometLayer]);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    particles.forEach((p, i) => p.position.toArray(pos, i * 3));
    return pos;
  }, [count, particles]);

  useFrame(() => {
    particles.forEach((particle, i) => {
      particle.position.z += particle.speed;
      if (particle.position.z > radius) {
        particle.position.z = -radius;
      }
      particle.position.toArray(positions, i * 3);
    });
    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
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
    { count: 2000, radius: 30, size: 0.02, color: '#557799' },
    { count: 300, radius: 25, size: 0.04, color: '#FFFFFF' },
    { count: 20, radius: 20, size: 0.08, color: '#FFFFDD', isCometLayer: true },
  ];

  return (
    <group>
      {layers.map((layer, i) => (
        <StarLayer key={i} {...layer} />
      ))}
    </group>
  );
};