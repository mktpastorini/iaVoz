"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

import { ParticleOrb } from "./ParticleOrb";
import { EnergyLines } from "./EnergyLines";
import { NebulaWisps } from "./NebulaWisps";
import { Comets } from "./Comets";

// Componente para as estrelas distantes (anteriormente em CosmicBackground)
const StarDust = () => {
  const starDustPositions = useMemo(() => {
    const count = 1000;
    const radius = 30;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, []);

  const starDustRef = useRef<THREE.Points>(null);

  useFrame(() => {
    if (starDustRef.current) {
      starDustRef.current.rotation.y += 0.0001;
    }
  });

  return (
    <points ref={starDustRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={starDustPositions.length / 3}
          array={starDustPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#ccffff"
        transparent
        opacity={0.15}
        depthWrite={false}
      />
    </points>
  );
};


export const AIScene: React.FC = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <color attach="background" args={["#0B022D"]} />

      {/* Camadas de Fundo */}
      <StarDust />
      <NebulaWisps />
      <Comets />

      {/* Elemento Central */}
      <ParticleOrb />
      <EnergyLines />

      <EffectComposer>
        <Bloom
          intensity={1.8}
          luminanceThreshold={0.02}
          luminanceSmoothing={0.1}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
};