import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { AiOrb } from './scene/AiOrb';
import { CosmicBackground } from './scene/CosmicBackground';
import { EnergyLines } from './scene/EnergyLines';
import { AssistantUI } from './AssistantUI';
import { cn } from '@/lib/utils';

interface CosmicVoiceAssistantProps {
  isOpen: boolean;
  isSpeaking: boolean;
  displayedAiResponse: string;
  transcript: string;
}

export const CosmicVoiceAssistant: React.FC<CosmicVoiceAssistantProps> = ({
  isOpen,
  isSpeaking,
  displayedAiResponse,
  transcript,
}) => {
  return (
    <div className={cn(
      "fixed inset-0 z-50 transition-opacity duration-500",
      isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
    )}>
      <Suspense fallback={null}>
        <Canvas camera={{ position: [0, 0, 3], fov: 75 }}>
          <color attach="background" args={['#0b022d']} />
          <ambientLight intensity={0.2} />
          <CosmicBackground />
          <EnergyLines />
          <AiOrb isSpeaking={isSpeaking} />
          <EffectComposer>
            <Bloom
              intensity={2.8}
              luminanceThreshold={0.05}
              luminanceSmoothing={0.2}
              mipmapBlur
            />
          </EffectComposer>
        </Canvas>
      </Suspense>
      <AssistantUI
        isSpeaking={isSpeaking}
        displayedAiResponse={displayedAiResponse}
        transcript={transcript}
      />
    </div>
  );
};