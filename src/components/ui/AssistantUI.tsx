"use client";

import React from 'react';
import { Mic } from 'lucide-react';
import { AudioVisualizerBars } from './AudioVisualizerBars';
import './AssistantUI.css';

interface AssistantUIProps {
  transcript: string;
  audioIntensity: number;
}

export const AssistantUI: React.FC<AssistantUIProps> = ({ transcript, audioIntensity }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between p-8 pointer-events-none">
      <div className="glassmorphism-card">
        <p>{transcript || "Olá! Como posso te ajudar?"}</p>
      </div>

      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="glassmorphism-card w-full flex items-center justify-center p-4">
          <AudioVisualizerBars audioIntensity={audioIntensity} />
          <div className="mx-4 p-3 bg-white/20 rounded-full">
            <Mic size={24} color="white" />
          </div>
          <AudioVisualizerBars audioIntensity={audioIntensity} />
        </div>
      </div>
    </div>
  );
};