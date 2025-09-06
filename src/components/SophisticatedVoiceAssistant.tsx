"use client";

import React, { useEffect } from "react";
import { useSession } from "@/contexts/SessionContext";
import { useSystem } from "@/contexts/SystemContext";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";

interface VoiceAssistantProps {
  settings: any | null;
  isLoading: boolean;
}

const SophisticatedVoiceAssistant: React.FC<VoiceAssistantProps> = ({ settings, isLoading }) => {
  const { session } = useSession();
  const { systemVariables } = useSystem();
  const { activationTrigger } = useVoiceAssistant();

  useEffect(() => {
    if (!isLoading && settings) {
      console.log("[VA] Assistente ativado com configurações:", settings);
      console.log("[VA] Variáveis do sistema:", systemVariables);
      console.log("[VA] Trigger de ativação:", activationTrigger);
    }
  }, [isLoading, settings, systemVariables, activationTrigger]);

  if (isLoading) {
    return <div className="fixed bottom-4 right-4 p-4 bg-gray-800 text-white rounded">Carregando assistente...</div>;
  }

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-cyan-600 text-white rounded shadow-lg">
      Assistente de Voz Simplificado Ativo
    </div>
  );
};

export default SophisticatedVoiceAssistant;