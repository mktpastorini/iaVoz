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
  isMobile: boolean;
}

export const AIScene: React.FC<AISceneProps> = ({ audioIntensity, isMobile }) => {
  // Otimizações para mobile
  const particleCount = isMobile ? 1000 : 2000;
  const energyLinesCount = isMobile ? 3 : 6;
  const nebulaWispsCount = isMobile ? 150 : 400;
  const starfieldFactor = isMobile ? 0.3 : 1;

  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <color attach="background" args={["#0B022D"]} />

      {/* Camadas de Fundo */}
      <Starfield factor={starfieldFactor} />
      <NebulaWisps count={nebulaWispsCount} />

      {/* Elemento Central */}
      <OrbCore />
      <ParticleOrb audioIntensity={audioIntensity} particleCount={particleCount} />
      <EnergyLines count={energyLinesCount} />

      <EffectComposer>
        <Bloom
          intensity={2.0}
          luminanceThreshold={0.02}
          luminanceSmoothing={0.1}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
};