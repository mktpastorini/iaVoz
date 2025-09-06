"use client";

import React from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

interface PostprocessingProps {
  quality: 'desktop' | 'mobile';
}

const Postprocessing: React.FC<PostprocessingProps> = ({ quality }) => {
  const isDesktop = quality === 'desktop';

  return (
    <EffectComposer>
      <Bloom
        intensity={2.8}
        luminanceThreshold={0.05}
        luminanceSmoothing={0.2}
        mipmapBlur={isDesktop}
      />
    </EffectComposer>
  );
};

export default Postprocessing;