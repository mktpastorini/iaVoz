"use client";

import React from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantUIProps {
  displayedAiResponse: string;
  transcript: string;
  isListening: boolean;
  isSpeaking: boolean;
}

// Um visualizador de áudio temporário que será aprimorado
const AudioEqualizer = ({ isSpeaking }: { isSpeaking: boolean }) => (
  <div className="flex items-center justify-center h-8 w-24">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className={cn(
          "w-1 h-1 mx-1 bg-cyan-400 rounded-full transition-all duration-300 ease-in-out",
          isSpeaking ? 'animate-wave' : 'scale-y-25 opacity-50',
        )}
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

export const AssistantUI: React.FC<AssistantUIProps> = ({
  displayedAiResponse,
  transcript,
  isSpeaking,
}) => {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-between p-8 text-center pointer-events-none">
      {/* Caixa de Diálogo Superior */}
      <div className="w-full max-w-2xl glass-container animate-fade-in pointer-events-auto">
        <p className="holographic-text text-2xl md:text-3xl font-bold leading-tight">
          {displayedAiResponse}
        </p>
      </div>

      {/* Controle de Microfone Inferior */}
      <div className="flex flex-col items-center space-y-4">
        <p className="text-gray-400 text-lg md:text-xl h-8">{transcript}</p>
        <div className="glass-container flex items-center justify-center p-4 rounded-full pointer-events-auto">
           <AudioEqualizer isSpeaking={isSpeaking} />
           <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-4">
              <Mic className="w-8 h-8 text-cyan-300" />
           </div>
           <AudioEqualizer isSpeaking={isSpeaking} />
        </div>
      </div>
    </div>
  );
};