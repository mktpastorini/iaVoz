"use client";

import React, { useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useAssistantAudio } from '@/hooks/useAssistantAudio';
import { useIsMobile } from '@/hooks/use-mobile';
import CosmicBackground from './assistant-scene/CosmicBackground';
import AiOrb from './assistant-scene/AiOrb';
import Postprocessing from './assistant-scene/Postprocessing';

const FuturisticVoiceAssistant = () => {
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const { audioIntensity, isSpeaking } = useAssistantAudio({ audioElementRef });
  const isMobile = useIsMobile();
  const quality = isMobile ? 'mobile' : 'desktop';

  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 0, 2], fov: 75 }}>
        <Suspense fallback={null}>
          <CosmicBackground quality={quality} />
          <AiOrb audioIntensity={audioIntensity} isSpeaking={isSpeaking} quality={quality} />
          <Postprocessing quality={quality} />
        </Suspense>
      </Canvas>

      {/* Painel de teste temporário */}
      <div className="absolute top-4 left-4 text-left font-mono text-xs bg-gray-900/50 p-4 rounded-lg text-white">
        <h2 className="text-lg font-bold mb-2 text-white">AudioHook Test Panel</h2>
        <p>Audio Intensity: <span className="text-cyan-400 font-bold">{audioIntensity.toFixed(4)}</span></p>
        <p>Is Speaking: <span className={isSpeaking ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{isSpeaking ? 'Yes' : 'No'}</span></p>
        <p>Quality: <span className="text-yellow-400">{quality}</span></p>
      </div>

      <audio 
        ref={audioElementRef} 
        src="https://ccrma.stanford.edu/~jos/mp3/pno-cs.mp3" 
        controls 
        loop
        crossOrigin="anonymous"
        className="absolute bottom-4 left-1/2 -translate-x-1/2"
      />
    </div>
  );
};

export default FuturisticVoiceAssistant;