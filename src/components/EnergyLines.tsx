"use client";

import React, { useMemo, useRef } from "react";
import { Tube } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const EnergyLine = ({ curve, speed, birth, thickness }: { curve: THREE.CatmullRomCurve3, speed: number, birth: number, thickness: number }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dashOffsetRef = useRef(0);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      // Opacidade reduzida para sutileza
      materialRef.current.opacity = (Math.sin(clock.elapsedTime * speed + birth) + 1) / 2 * 0.2 + 0.05;

      // Animação de luz correndo (dash offset)
      dashOffsetRef.current -= 0.002 * speed; // velocidade lenta e sutil
      materialRef.current.dashOffset = dashOffsetRef.current;
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
        // Para usar dashOffset, precisamos de material que suporte, mas meshBasicMaterial não suporta dash.
        // Alternativa: usar LineDashedMaterial com Line geometry, mas Tube não suporta diretamente.
        // Como alternativa, podemos animar a cor ou a opacidade para simular o efeito.
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