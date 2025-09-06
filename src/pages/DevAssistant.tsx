import React, { useState } from 'react';
import FuturisticVoiceAssistant from '@/components/FuturisticVoiceAssistant';

const mockSettings = {
  welcome_message: "Bem-vindo ao assistente de desenvolvimento!",
  openai_api_key: "YOUR_MOCK_OPENAI_KEY", // Substitua por uma chave real se precisar testar chamadas de IA
  system_prompt: "Você é um assistente de desenvolvimento.",
  assistant_prompt: "Como posso ajudar no seu desenvolvimento?",
  ai_model: "gpt-4o-mini",
  conversation_memory_length: 5,
  voice_model: "browser", // Use TTS do navegador para simplicidade no desenvolvimento
  openai_tts_voice: "alloy",
  activation_phrase: "ativar",
  continuation_phrase: "Pode falar.",
};

const DevAssistantPage = () => {
  const [isLoading, setIsLoading] = useState(false); // Assume que não está carregando para a página de desenvolvimento

  return (
    <div className="w-screen h-screen bg-black">
      <FuturisticVoiceAssistant
        settings={mockSettings}
        isLoading={isLoading}
      />
    </div>
  );
};

export default DevAssistantPage;