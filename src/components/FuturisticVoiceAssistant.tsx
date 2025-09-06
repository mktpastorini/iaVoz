"use client";

import React, { useRef, Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { useAssistantAudio } from '@/hooks/useAssistantAudio';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTypewriter } from '@/hooks/useTypewriter';
import CosmicBackground from './assistant-scene/CosmicBackground';
import AiOrb from './assistant-scene/AiOrb';
import Postprocessing from './assistant-scene/Postprocessing';
import AssistantUI from './AssistantUI';

const FuturisticVoiceAssistant = () => {
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const { audioIntensity, isSpeaking } = useAssistantAudio({ audioElementRef });
  const isMobile = useIsMobile();
  const quality = isMobile ? 'mobile' : 'desktop';

  // Mock state for UI development
  const [isListening, setIsListening] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("Olá! Como posso ajudar hoje?");
  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Mock conversation flow for testing
  useEffect(() => {
    if (isSpeaking) {
      setTranscript(""); // Clear transcript when AI starts speaking
    }
  }, [isSpeaking]);

  const handleToggleMic = () => {
    setIsListening(prev => !prev);
    if (!isListening) {
      setTranscript("Ouvindo sua pergunta...");
      // Simulate AI response after a delay
      setTimeout(() => {
        setTranscript("Ok, entendi!");
        setAiResponse("Estou processando sua solicitação para encontrar a galáxia mais próxima...");
        if (audioElementRef.current) {
          audioElementRef.current.play();
        }
      }, 2500);
    } else {
      setTranscript("");
    }
  };

  return (
    <div className="w-full h-full relative bg-black">
      <Canvas camera={{ position: [0, 0, 2], fov: 75 }}>
        <Suspense fallback={null}>
          <CosmicBackground quality={quality} />
          <AiOrb audioIntensity={audioIntensity} isSpeaking={isSpeaking} quality={quality} />
          <Postprocessing quality={quality} />
        </Suspense>
      </Canvas>

      <AssistantUI
        audioIntensity={audioIntensity}
        isSpeaking={isSpeaking}
        isListening={isListening}
        transcript={transcript}
        aiResponse={displayedAiResponse}
        onToggleMic={handleToggleMic}
      />

      {/* Audio element is now hidden, controlled by the UI */}
      <audio 
        ref={audioElementRef} 
        src="https://ccrma.stanford.edu/~jos/mp3/pno-cs.mp3" 
        crossOrigin="anonymous"
        onEnded={() => setAiResponse("Encontrei. A galáxia de Andrômeda está a 2.537 milhões de anos-luz de distância.")}
      />
    </div>
  );
};

export default FuturisticVoiceAssistant;