"use client";

import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { AiOrb } from '@/components/scene/AiOrb';
import { CosmicBackground } from '@/components/scene/CosmicBackground';
import { EnergyLines } from '@/components/scene/EnergyLines';
import { AssistantUI } from '@/components/ui/AssistantUI';
import { Leva } from 'leva';

const CosmicAssistant: React.FC = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [transcript, setTranscript] = useState("");

  // Simulate assistant speaking and audio levels
  useEffect(() => {
    let speakingTimeout: NodeJS.Timeout;
    let intensityInterval: NodeJS.Timeout;

    const simulateConversation = () => {
      setTranscript("Olá! Como posso te ajudar?");
      speakingTimeout = setTimeout(() => {
        setIsSpeaking(true);
        setTranscript("Estou analisando os dados cósmicos para você...");
        intensityInterval = setInterval(() => {
          setAudioIntensity(Math.random() * 0.8 + 0.2);
        }, 100);

        speakingTimeout = setTimeout(() => {
          setIsSpeaking(false);
          setTranscript("Análise completa. O universo é vasto e cheio de maravilhas.");
          clearInterval(intensityInterval);
          setAudioIntensity(0);

          speakingTimeout = setTimeout(simulateConversation, 5000); // Loop
        }, 4000);
      }, 3000);
    };

    simulateConversation();

    return () => {
      clearTimeout(speakingTimeout);
      clearInterval(intensityInterval);
    };
  }, []);

  return (
    <div className="w-screen h-screen" style={{ background: 'rgba(11, 2, 45, 1.0)' }}>
      <Suspense fallback={null}>
        <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
          <CosmicBackground />
          <AiOrb isSpeaking={isSpeaking} audioIntensity={audioIntensity} />
          <EnergyLines />
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
      <AssistantUI transcript={transcript} audioIntensity={audioIntensity} />
      <Leva collapsed />
    </div>
  );
};

export default CosmicAssistant;