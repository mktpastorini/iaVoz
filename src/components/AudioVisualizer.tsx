"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  isSpeaking: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isSpeaking }) => {
  const barClasses = "w-1.5 bg-cyan-400/80 rounded-full transition-transform duration-300 ease-in-out";

  return (
    <div className="flex justify-center items-end h-12 gap-1.5">
      <div className={cn(barClasses, "h-6", isSpeaking ? 'animate-wave' : 'scale-y-[0.2]')} style={{ animationDelay: '0ms' }} />
      <div className={cn(barClasses, "h-10", isSpeaking ? 'animate-wave' : 'scale-y-[0.2]')} style={{ animationDelay: '150ms' }} />
      <div className={cn(barClasses, "h-8", isSpeaking ? 'animate-wave' : 'scale-y-[0.2]')} style={{ animationDelay: '300ms' }} />
      <div className={cn(barClasses, "h-10", isSpeaking ? 'animate-wave' : 'scale-y-[0.2]')} style={{ animationDelay: '150ms' }} />
      <div className={cn(barClasses, "h-6", isSpeaking ? 'animate-wave' : 'scale-y-[0.2]')} style={{ animationDelay: '0ms' }} />
    </div>
  );
};