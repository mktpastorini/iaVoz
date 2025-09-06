"use client";

import React from 'react';
import { Canvas } from '@react-three/fiber';
import CosmicBackground from './assistant-scene/CosmicBackground';
import AiOrb from './assistant-scene/AiOrb';
import Postprocessing from './assistant-scene/Postprocessing';

interface FuturisticVoiceAssistantSceneProps {
  audioIntensity: number;
  isSpeaking: boolean;
  quality: 'desktop' | 'mobile';
}

const FuturisticVoiceAssistantScene: React.FC<FuturisticVoiceAssistantSceneProps> = ({ audioIntensity, isSpeaking, quality }) => {
  return (
    <Canvas
      className="absolute inset-0 z-0"
      camera={{ position: [0, 0, 3], fov: 45 }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <CosmicBackground quality={quality} />
      <AiOrb audioIntensity={audioIntensity} isSpeaking={isSpeaking} quality={quality} />
      <Postprocessing quality={quality} />
    </Canvas>
  );
};

export default FuturisticVoiceAssistantScene;