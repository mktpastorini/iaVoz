"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ParticleOrb } from "./ParticleOrb";
import { CosmicBackground } from "./CosmicBackground";

export const AIScene: React.FC = () => {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      {/* Background deep purple to night blue gradient */}
      <color attach="background" args={["#0B022D"]} />

      {/* Cosmic background with star dust and shooting stars */}
      <CosmicBackground />

      {/* Main particle orb with cyan-magenta gradient */}
      <ParticleOrb />

      {/* Bloom effect for intense glowing energy */}
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