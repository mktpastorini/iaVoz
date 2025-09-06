"use client";

import React from "react";

interface VoiceAssistantProps {
  settings: any | null;
  isLoading: boolean;
}

const FuturisticVoiceAssistant: React.FC<VoiceAssistantProps> = ({ settings, isLoading }) => {
  if (isLoading) {
    return <div>Carregando assistente...</div>;
  }

  if (!settings) {
    return <div>Configurações não encontradas.</div>;
  }

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-cyan-600 text-white rounded-lg shadow-lg">
      Assistente Futurista Ativo!
    </div>
  );
};

export default FuturisticVoiceAssistant;