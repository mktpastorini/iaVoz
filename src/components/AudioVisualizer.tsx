"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  isSpeaking: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isSpeaking }) => {
  const barClasses = "w-2 h-2 mx-1 bg-white rounded-full transition-all duration-300 ease-in-out";

  return (
    <div className="flex justify-center items-center h-16">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={cn(
            barClasses,
            isSpeaking ? 'animate-wave' : 'scale-y-25 opacity-50',
          )}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
};