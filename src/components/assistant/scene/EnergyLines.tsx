"use client";

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Tube } from '@react-three/drei';

// Componente para uma única linha de energia animada
const EnergyLine = ({ curve }: { curve: THREE.CatmullRomCurve3 }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!);

  // Anima a opacidade para criar um efeito de pulsação suave
  useFrame(({ clock }) => {
    if (materialRef.current) {
      const elapsedTime = clock.getElapsedTime();
      // Usa uma função seno para variar a opacidade entre 0.1 e 0.4
      materialRef.current.opacity = (Math.sin(elapsedTime + curve.points.length) + 1) / 2 * 0.3 + 0.1;
    }
  });

  return (
    <Tube args={[curve, 64, 0.005, 8, false]}>
      <meshBasicMaterial
        ref={materialRef}
        color="#00FFFF"
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </Tube>
  );
};

// Componente principal que gera múltiplas linhas
export const EnergyLines: React.FC = () => {
  const curves = useMemo(() => {
    const lineCount = 20;
    const pointCount = 8;
    const radius = 5;

    return Array.from({ length: lineCount }, () => {
      const points = Array.from({ length: pointCount }, () => {
        return new THREE.Vector3(
          (Math.random() - 0.5) * radius * 2,
          (Math.random() - 0.5) * radius * 2,
          (Math.random() - 0.5) * radius * 2
        );
      });
      return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
    });
  }, []);

  return (
    <group>
      {curves.map((curve, index) => (
        <EnergyLine key={index} curve={curve} />
      ))}
    </group>
  );
};