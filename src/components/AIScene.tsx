"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

import { ParticleOrb } from "./ParticleOrb";
import { EnergyLines } from "./EnergyLines";
import { NebulaWisps } from "./NebulaWisps";
import { Starfield } from "./Starfield";

export const AIScene: React.FC = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <color attach="background" args={["#0B022D"]} />

      {/* Camadas de Fundo */}
      <Starfield />
      <NebulaWisps />

      {/* Elemento Central */}
      <ParticleOrb />
      <EnergyLines />

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