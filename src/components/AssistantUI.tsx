"use client";

import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTypewriter } from '@/hooks/useTypewriter';

interface AssistantUIProps {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  aiResponse: string;
  onToggleMic: () => void;
}

const AssistantUI: React.FC<AssistantUIProps> = ({
  isListening,
  isSpeaking,
  transcript,
  aiResponse,
  onToggleMic,
}) => {
  const displayedResponse = useTypewriter(aiResponse, 30);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end p-4 md:p-8 pointer-events-none">
      <div className="w-full max-w-4xl glass-container p-6 pointer-events-auto">
        <div className="text-center min-h-[120px] flex flex-col justify-center">
          <p className="holographic-text text-2xl md:text-4xl font-bold transition-opacity duration-300 opacity-90">
            {displayedResponse}
          </p>
          <p className="text-cyan-200/70 text-lg mt-2 h-8">
            {transcript}
          </p>
        </div>

        <div className="flex items-center justify-center mt-4">
          <button
            onClick={onToggleMic}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg border-2",
              isListening ? "bg-cyan-500/50 border-cyan-300 shadow-cyan-500/50" : "bg-gray-600/50 border-gray-500",
              isSpeaking && "animate-pulse"
            )}
          >
            {isListening ? <Mic size={40} className="text-white" /> : <MicOff size={40} className="text-gray-300" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantUI;