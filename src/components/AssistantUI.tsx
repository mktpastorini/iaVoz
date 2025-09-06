"use client";

import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantUIProps {
  audioIntensity: number;
  isSpeaking: boolean;
  isListening: boolean;
  transcript: string;
  aiResponse: string;
  onToggleMic: () => void;
}

const VisualEqualizer = ({ audioIntensity }: { audioIntensity: number }) => {
  const barCount = 24;
  return (
    <div className="flex items-center justify-center h-12 space-x-1">
      {Array.from({ length: barCount }).map((_, index) => {
        const intensity = Math.max(0.05, audioIntensity * (1 + Math.sin(index * 0.5) * 0.5));
        return (
          <div
            key={index}
            className="w-1 bg-cyan-400 rounded-full transition-transform duration-100 ease-out"
            style={{
              height: `${intensity * 100}%`,
              transform: `scaleY(${intensity})`,
              opacity: 0.5 + intensity * 0.5,
            }}
          />
        );
      })}
    </div>
  );
};

const AssistantUI: React.FC<AssistantUIProps> = ({
  audioIntensity,
  isSpeaking,
  isListening,
  transcript,
  aiResponse,
  onToggleMic,
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end p-4 md:p-8 pointer-events-none">
      <div className="w-full max-w-4xl glass-container p-6 pointer-events-auto animate-fadeIn">
        <div className="text-center min-h-[120px] flex flex-col justify-center">
          <p className="holographic-text text-2xl md:text-4xl font-bold transition-opacity duration-300 opacity-90">
            {aiResponse}
          </p>
          <p className="text-cyan-200/70 text-lg mt-2 h-8">
            {transcript}
          </p>
        </div>

        <div className="flex items-center justify-center mt-4 space-x-6">
          <div className="flex-1">
            <VisualEqualizer audioIntensity={isSpeaking ? audioIntensity : 0} />
          </div>
          <button
            onClick={onToggleMic}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
              isListening ? "bg-cyan-500/50 shadow-cyan-500/50" : "bg-gray-600/50",
              isSpeaking && "animate-pulse"
            )}
          >
            {isListening ? <Mic size={40} className="text-white" /> : <MicOff size={40} className="text-gray-300" />}
          </button>
          <div className="flex-1">
            <VisualEqualizer audioIntensity={isSpeaking ? audioIntensity : 0} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantUI;