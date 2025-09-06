import React from 'react';
import { Mic } from 'lucide-react';
import './AssistantUI.css';
import { cn } from '@/lib/utils';

interface AssistantUIProps {
  isSpeaking: boolean;
  displayedAiResponse: string;
  transcript: string;
}

const Equalizer = ({ isSpeaking }: { isSpeaking: boolean }) => (
  <div className="equalizer">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className={cn('equalizer-bar', { speaking: isSpeaking })}
        style={{ animationDelay: `${i * 100}ms` }}
      />
    ))}
  </div>
);

export const AssistantUI: React.FC<AssistantUIProps> = ({ isSpeaking, displayedAiResponse, transcript }) => {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-between p-8 pointer-events-none">
      <div className="glass-container">
        <p className="holographic-text">
          {displayedAiResponse || "Olá! Como posso te ajudar?"}
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <p className="text-gray-400 text-lg h-8">{transcript}</p>
        <div className="glass-container mic-control-container">
          <Equalizer isSpeaking={isSpeaking} />
          <div className="mic-icon-container">
            <div className={cn("mic-glow", !isSpeaking && "opacity-0")} />
            <Mic size={32} color="white" />
          </div>
          <Equalizer isSpeaking={isSpeaking} />
        </div>
      </div>
    </div>
  );
};