"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const ShootingStars: React.FC = () => {
  const count = 50; // Increased count for more activity
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const alphas = useMemo(() => new Float32Array(count), [count]);

  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const colorOptions = [
      new THREE.Color("#7B2FF7"), // Roxo
      new THREE.Color("#FF00FF"), // Magenta
      new THREE.Color("#00FFFF"), // Ciano
    ];
    for (let i = 0; i < count; i++) {
      const c = colorOptions[Math.floor(Math.random() * colorOptions.length)];
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [count]);

  const stars = useRef(
    Array.from({ length: count }, () => {
      const spawnRadius = 25;
      const side = Math.floor(Math.random() * 6);
      const pos = new THREE.Vector3();
      
      switch(side) {
        case 0: pos.set(-spawnRadius, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40); break;
        case 1: pos.set(spawnRadius, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40); break;
        case 2: pos.set((Math.random() - 0.5) * 40, -spawnRadius, (Math.random() - 0.5) * 40); break;
        case 3: pos.set((Math.random() - 0.5) * 40, spawnRadius, (Math.random() - 0.5) * 40); break;
        case 4: pos.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, -spawnRadius); break;
        case 5: pos.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, spawnRadius); break;
      }

      // Velocity towards a random point near the center
      const target = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      const velocity = new THREE.Vector3().subVectors(target, pos).normalize().multiplyScalar(0.1 + Math.random() * 0.2);

      return {
        position: pos,
        velocity,
        life: 0,
        maxLife: 5 + Math.random() * 5,
      };
    })
  );

  useFrame(() => {
    stars.current.forEach((star, i) => {
      star.position.add(star.velocity);
      star.life += 0.02;
      
      // Fade in and out smoothly
      alphas[i] = Math.sin(Math.PI * (star.life / star.maxLife));

      if (star.life > star.maxLife) {
        // Reset star
        const spawnRadius = 25;
        const side = Math.floor(Math.random() * 6);
        switch(side) {
          case 0: star.position.set(-spawnRadius, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40); break;
          case 1: star.position.set(spawnRadius, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40); break;
          case 2: star.position.set((Math.random() - 0.5) * 40, -spawnRadius, (Math.random() - 0.5) * 40); break;
          case 3: star.position.set((Math.random() - 0.5) * 40, spawnRadius, (Math.random() - 0.5) * 40); break;
          case 4: star.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, -spawnRadius); break;
          case 5: star.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, spawnRadius); break;
        }
        const target = new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        );
        star.velocity.subVectors(target, star.position).normalize().multiplyScalar(0.1 + Math.random() * 0.2);
        star.life = 0;
        star.maxLife = 5 + Math.random() * 5;
      }

      positions[i * 3] = star.position.x;
      positions[i * 3 + 1] = star.position.y;
      positions[i * 3 + 2] = star.position.z;
    });

    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
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
        <bufferAttribute
          attach="attributes-alpha"
          count={count}
          array={alphas}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={4} // Slightly larger size
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};