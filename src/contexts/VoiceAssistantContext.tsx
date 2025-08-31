"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface VoiceAssistantContextType {
  activationTrigger: number;
  activateAssistant: () => void;
}

const VoiceAssistantContext = createContext<VoiceAssistantContextType | undefined>(undefined);

export const VoiceAssistantProvider = ({ children }: { children: ReactNode }) => {
  const [activationTrigger, setActivationTrigger] = useState(0);

  const activateAssistant = useCallback(() => {
    console.log("[VoiceAssistantContext] Ativando assistente via gatilho de contexto.");
    setActivationTrigger(c => c + 1);
  }, []);

  return (
    <VoiceAssistantContext.Provider value={{ activationTrigger, activateAssistant }}>
      {children}
    </VoiceAssistantContext.Provider>
  );
};

export const useVoiceAssistant = () => {
  const context = useContext(VoiceAssistantContext);
  if (context === undefined) {
    throw new Error('useVoiceAssistant deve ser usado dentro de um VoiceAssistantProvider');
  }
  return context;
};