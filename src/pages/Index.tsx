"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import FuturisticVoiceAssistant from "@/components/FuturisticVoiceAssistant";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { activateAssistant } = useVoiceAssistant();
  const [settings, setSettings] = useState(null);
  const [powers, setPowers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      // Busca as configurações do primeiro workspace (ou o público)
      const { data: settingsData } = await supabase
        .from("settings")
        .select("*")
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      setSettings(settingsData);

      // Busca todos os poderes disponíveis para o mesmo workspace
      if (settingsData?.workspace_id) {
        const { data: powersData } = await supabase
          .from("powers")
          .select("*")
          .eq("workspace_id", settingsData.workspace_id);
        setPowers(powersData || []);
      }
      
      setIsLoading(false);
    };

    fetchInitialData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B022D] to-[#20053D] text-white flex flex-col items-center justify-center p-4 select-text relative overflow-hidden">
      <header className="text-center mb-12 z-10 relative">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-600">
          Inteligência Artificial por Voz
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
          Automatize tarefas, interaja com sistemas e obtenha informações em tempo real, tudo através de comandos de voz.
        </p>
      </header>

      <main className="text-center z-10 relative">
        <div className="mb-12">
          <Button
            size="lg"
            className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
            onClick={activateAssistant}
          >
            Ativar Assistente
          </Button>
        </div>
      </main>

      <FuturisticVoiceAssistant settings={settings} isLoading={isLoading} powers={powers} />
    </div>
  );
};

export default Index;