"use client";

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

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
        {/* Os elementos da cena 3D (orbe, estrelas, etc.) serão adicionados aqui nos próximos passos. */}
        
        <EffectComposer>
          <Bloom
            intensity={2.8}
            luminanceThreshold={0.05}
            luminanceSmoothing={0.2}
            mipmapBlur
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
};