"use client";

import React, { useMemo, useRef } from "react";
import { Tube } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const EnergyLine = ({ curve, speed, birth, thickness }: { curve: THREE.CatmullRomCurve3, speed: number, birth: number, thickness: number }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity = (Math.sin(clock.elapsedTime * speed + birth) + 1) / 2 * 0.5 + 0.5;
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

export const EnergyLines: React.FC<{ count?: number; radius?: number }> = ({ count = 6, radius = 1.5 }) => {
  const lines = useMemo(() => {
    return Array.from({ length: count }, () => {
      const points = [];
      const numPoints = 20; // Mais pontos para uma curva mais suave
      
      // Começa perto do núcleo
      let currentPoint = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      );
      points.push(currentPoint.clone());

      // Cria um caminho "errante"
      let direction = new THREE.Vector3().subVectors(currentPoint, new THREE.Vector3(0,0,0)).normalize();
      
      for (let i = 1; i < numPoints; i++) {
        // Adiciona uma "oscilação" aleatória à direção
        const wobble = new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8
        );
        direction.add(wobble).normalize();

        // Move o próximo ponto ao longo da nova direção
        const stepLength = (radius * 2) / numPoints;
        const nextPoint = currentPoint.clone().add(direction.clone().multiplyScalar(stepLength));
        points.push(nextPoint);
        currentPoint = nextPoint;
      }

      return {
        curve: new THREE.CatmullRomCurve3(points),
        speed: Math.random() * 0.5 + 0.2,
        birth: Math.random() * 10,
        thickness: 0.002 + Math.random() * 0.006,
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