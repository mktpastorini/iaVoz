"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

import { ParticleOrb } from "./ParticleOrb";
import { EnergyLines } from "./EnergyLines";
import { NebulaWisps } from "./NebulaWisps";
import { Comets } from "./Comets";
import { Starfield } from "./Starfield"; // Importando o novo componente

export const AIScene: React.FC = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <color attach="background" args={["#0B022D"]} />

      {/* Camadas de Fundo */}
      <Starfield />
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