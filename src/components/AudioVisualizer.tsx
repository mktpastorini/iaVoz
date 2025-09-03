"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  isSpeaking: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isSpeaking }) => {
  const barCount = 32;

  return (
    <div className="w-full max-w-sm h-20 flex justify-center items-center gap-1 bg-black/20 backdrop-blur-md rounded-xl border border-white/20 p-4">
      {[...Array(barCount)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1 bg-cyan-300/70 rounded-full transition-all duration-300 ease-in-out",
            isSpeaking ? 'animate-wave' : 'h-1 opacity-50',
          )}
          style={{ 
            animationDelay: `${i * 50}ms`,
            height: isSpeaking ? undefined : `${Math.random() * 25 + 5}%`
          }}
        />
      ))}
    </div>
  );
};