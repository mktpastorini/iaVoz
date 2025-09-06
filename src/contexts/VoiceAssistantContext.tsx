"use client";

import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

interface VoiceAssistantContextType {
  activationTrigger: number;
  activateAssistant: () => void;
  isOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
}

const VoiceAssistantContext = createContext<VoiceAssistantContextType | undefined>(undefined);

export const VoiceAssistantProvider = ({ children }: { children: ReactNode }) => {
  const [activationTrigger, setActivationTrigger] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const activateAssistant = useCallback(() => {
    console.log("[VoiceAssistantContext] Ativando assistente via gatilho de contexto.");
    setActivationTrigger(c => c + 1);
    setIsOpen(true);
  }, []);

  const openAssistant = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <VoiceAssistantContext.Provider value={{ activationTrigger, activateAssistant, isOpen, openAssistant, closeAssistant }}>
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