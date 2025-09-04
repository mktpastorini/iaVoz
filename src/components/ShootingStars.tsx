"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const ShootingStars: React.FC = () => {
  const count = 20; // Reduzido para um efeito mais sutil e performático
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
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * spawnRadius * 2, // Começa em qualquer lugar no eixo X
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
      );

      const velocity = new THREE.Vector3(
        0.05 + Math.random() * 0.1, // Velocidade mais lenta e constante para a direita
        (Math.random() - 0.5) * 0.01, // Leve desvio vertical
        (Math.random() - 0.5) * 0.01  // Leve desvio de profundidade
      );

      return {
        position: pos,
        velocity,
      };
    })
  );

  useFrame(({ clock }) => {
    stars.current.forEach((star, i) => {
      star.position.add(star.velocity);
      
      // Efeito de piscar sutil baseado na posição e no tempo
      alphas[i] = 0.5 + 0.5 * Math.sin(star.position.y * 0.5 + clock.elapsedTime);

      // Reinicia a partícula quando ela sai da tela pela direita
      if (star.position.x > 25) {
        star.position.x = -25;
        star.position.y = (Math.random() - 0.5) * 40;
        star.position.z = (Math.random() - 0.5) * 40;
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
        size={3} // Tamanho um pouco menor
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};