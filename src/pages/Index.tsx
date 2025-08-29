"use client";

import { Rodape } from "@/components/rodape";
import SophisticatedVoiceAssistant from "@/components/SophisticatedVoiceAssistant";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";

interface Settings {
  system_prompt: string;
  assistant_prompt: string;
  ai_model: string;
  voice_model: "browser" | "openai-tts" | "gemini-tts";
  openai_api_key: string | null;
  openai_tts_voice: string | null;
  conversation_memory_length: number;
  activation_phrase: string;
  welcome_message: string | null;
}

const Index = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    const fetchPublicSettings = async () => {
      const { data, error } = await supabase.from("settings").select("*").limit(1).single();
      if (error && error.code !== "PGRST116") {
        showError("Erro ao carregar configurações do assistente.");
        console.error("Error fetching settings:", error);
      }

      if (data) {
        setSettings({
          system_prompt: data.system_prompt || "Você é Intra, a IA da Intratégica.",
          assistant_prompt: data.assistant_prompt || "Você é um assistente amigável.",
          ai_model: data.ai_model || "gpt-4o-mini",
          voice_model: data.voice_model || "browser",
          openai_api_key: data.openai_api_key || "",
          openai_tts_voice: data.openai_tts_voice || "alloy",
          conversation_memory_length: data.conversation_memory_length ?? 5,
          activation_phrase: data.activation_phrase || "ativar",
          welcome_message: data.welcome_message || "Olá! Como posso ajudar?",
        });
      } else {
        setSettings({
          system_prompt: "Você é Intra, a IA da Intratégica.",
          assistant_prompt: "Você é um assistente amigável.",
          ai_model: "gpt-4o-mini",
          voice_model: "browser",
          openai_api_key: "",
          openai_tts_voice: "alloy",
          conversation_memory_length: 5,
          activation_phrase: "ativar",
          welcome_message: "Olá! Como posso ajudar?",
        });
      }
      setLoadingSettings(false);
    };
    fetchPublicSettings();
  }, []);

  if (loadingSettings) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!settings) {
    return <div className="min-h-screen flex items-center justify-center">Não foi possível carregar as configurações.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">Meu Site Incrível</h1>
      </header>
      <main className="flex-grow p-8 space-y-4">
        <h2 className="text-3xl font-semibold">Bem-vindo ao Futuro</h2>
        <p className="text-lg text-muted-foreground">
          Este é um exemplo de página onde o assistente de voz pode ser implementado.
          Diga "{settings.activation_phrase}" para começar a interagir.
        </p>
        <div className="space-x-4">
          <Button>Botão Principal</Button>
          <Button variant="secondary">Outra Ação</Button>
        </div>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero.
          Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.
          Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta.
          Mauris massa. Vestibulum lacinia arcu eget nulla.
        </p>
      </main>
      <Rodape />
      <SophisticatedVoiceAssistant
        welcomeMessage={settings.welcome_message || "Olá! Como posso ajudar?"}
        openAiApiKey={settings.openai_api_key || ""}
        systemPrompt={settings.system_prompt}
        assistantPrompt={settings.assistant_prompt}
        model={settings.ai_model}
        conversationMemoryLength={settings.conversation_memory_length}
        voiceModel={settings.voice_model}
        openaiTtsVoice={settings.openai_tts_voice || "alloy"}
        activationPhrase={settings.activation_phrase}
      />
    </div>
  );
};

export default Index;