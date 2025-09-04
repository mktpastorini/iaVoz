"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ParticleOrb } from "./ParticleOrb";
import { CosmicBackground } from "./CosmicBackground";
import { EnergyLines } from "./EnergyLines";

export const AIScene: React.FC = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <color attach="background" args={["#0B022D"]} />

      <CosmicBackground />

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