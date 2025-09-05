"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

import { ParticleOrb } from "./ParticleOrb";
import { EnergyLines } from "./EnergyLines";
import { NebulaWisps } from "./NebulaWisps";
import { Starfield } from "./Starfield";
import { OrbCore } from "./OrbCore";

interface AISceneProps {
  audioIntensity: number;
  isMobile?: boolean;
}

export const AIScene: React.FC<AISceneProps> = ({ audioIntensity, isMobile }) => {
  // Reduz drasticamente partículas e linhas em mobile
  const orbParticles = isMobile ? 300 : 1000;
  const nebulaParticles = isMobile ? 80 : 300;
  const energyLines = isMobile ? 1 : 4;
  const starfieldLayers = isMobile ? [
    { count: 300, radius: 20, size: 0.02, color: '#557799' },
    { count: 40, radius: 15, size: 0.04, color: '#FFFFFF' },
  ] : [
    { count: 800, radius: 30, size: 0.02, color: '#557799' },
    { count: 120, radius: 25, size: 0.04, color: '#FFFFFF' },
    { count: 8, radius: 20, size: 0.08, color: '#FFFFDD', isCometLayer: true },
  ];

  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <color attach="background" args={["#0B022D"]} />

      {/* Camadas de Fundo */}
      <Starfield layers={starfieldLayers} />
      <NebulaWisps particleCount={nebulaParticles} />

      {/* Elemento Central */}
      <OrbCore />
      <ParticleOrb audioIntensity={audioIntensity} particleCount={orbParticles} />
      <EnergyLines count={energyLines} />

      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.04}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
};