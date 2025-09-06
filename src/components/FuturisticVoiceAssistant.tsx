"use client";

import React, { useRef } from 'react';
import { useAssistantAudio } from '@/hooks/useAssistantAudio';

const FuturisticVoiceAssistant = () => {
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const { audioIntensity, isSpeaking } = useAssistantAudio({ audioElementRef });

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white bg-black p-4">
      <div className="absolute top-4 left-4 text-left font-mono text-xs bg-gray-900/50 p-4 rounded-lg">
        <h2 className="text-lg font-bold mb-2 text-white">AudioHook Test Panel</h2>
        <p>Audio Intensity: <span className="text-cyan-400 font-bold">{audioIntensity.toFixed(4)}</span></p>
        <p>Is Speaking: <span className={isSpeaking ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{isSpeaking ? 'Yes' : 'No'}</span></p>
        <p className="mt-2 text-gray-400">Clique em "Play" no player de áudio abaixo para testar a reatividade.</p>
      </div>
      
      <h1 className="text-2xl font-bold mb-8">Futuristic Voice Assistant - Dev Environment</h1>
      
      {/* O Canvas 3D e a UI 2D serão construídos aqui */}

      <audio 
        ref={audioElementRef} 
        src="https://ccrma.stanford.edu/~jos/mp3/pno-cs.mp3" 
        controls 
        loop
        crossOrigin="anonymous"
        className="absolute bottom-4"
      />
    </div>
  );
};

export default FuturisticVoiceAssistant;