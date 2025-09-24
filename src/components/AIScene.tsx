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
  const particleCount = isMobile ? 2500 : 20000;
  const energyLinesCount = isMobile ? 5 : 12;
  const nebulaWispsCount = isMobile ? 100 : 200;
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
          intensity={2.8}
          luminanceThreshold={0.05}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
};