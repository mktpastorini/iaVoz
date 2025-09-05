"use client";

import React, { useMemo, useRef } from "react";
import { Tube } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Função para gerar pontos suavemente curvados ao redor do centro
function generateSmoothCurvePoints(radius: number, segments: number, phase: number, isInternal: boolean) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    // Ângulo base para a curva (espiral ou círculo)
    const angle = phase + t * Math.PI * 2 * (isInternal ? 1 : 1.5);
    // Para linhas internas, mantenha mais próximo do centro
    const r = isInternal
      ? radius * (0.3 + 0.2 * Math.sin(phase + t * Math.PI * 2))
      : radius * (1 + 0.5 * Math.sin(phase + t * Math.PI * 2));
    // Adiciona pequenas variações para dar movimento orgânico
    const x = Math.cos(angle) * r + Math.sin(angle * 2) * 0.2 * radius;
    const y = Math.sin(angle) * r + Math.cos(angle * 3) * 0.2 * radius;
    const z = Math.sin(angle * 1.5) * r * 0.2 + Math.cos(angle * 2.5) * 0.1 * radius;
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

const EnergyLine = ({ curve, speed, birth, thickness }: { curve: THREE.CatmullRomCurve3, speed: number, birth: number, thickness: number }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity = (Math.sin(clock.elapsedTime * speed + birth) + 1) / 2 * 0.5 + 0.5;
    }
  });

  return (
    <Tube args={[curve, 128, thickness, 16, false]}>
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

export const EnergyLines: React.FC<{ count?: number; radius?: number }> = ({ count = 4, radius = 1.5 }) => {
  // Gera linhas com curvas suaves e trajetórias orgânicas
  const lines = useMemo(() => {
    return Array.from({ length: count }, (_, index) => {
      const isInternal = index < count / 2;
      const phase = Math.random() * Math.PI * 2;
      const segments = isInternal ? 12 : 24;
      const points = generateSmoothCurvePoints(radius, segments, phase, isInternal);
      return {
        curve: new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5),
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