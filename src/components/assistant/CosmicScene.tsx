"use client";

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { CosmicBackground } from './scene/CosmicBackground';
import { EnergyLines } from './scene/EnergyLines';
import { AIOrb } from './scene/AIOrb';

export const CosmicScene: React.FC = () => {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 75 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(11, 2, 45, 1.0)',
      }}
    >
      <Suspense fallback={null}>
        <CosmicBackground />
        <EnergyLines />
        <AIOrb />
      </Suspense>
      
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