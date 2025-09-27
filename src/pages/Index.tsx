"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import Orb from "@/components/Orb";
import { ShieldCheck, Cog, MessageCircleReply } from "lucide-react";

const Index = () => {
  const { activateAssistant } = useVoiceAssistant();

  return (
    <div className="min-h-screen bg-[#0B022D] text-white flex flex-col items-center justify-center p-4 select-text overflow-hidden relative">
      <div className="absolute inset-0 z-0 opacity-50">
        <Orb audioIntensity={0} />
      </div>
      
      <div className="z-10 flex flex-col items-center justify-center w-full h-full">
        <header className="text-center mb-8">
          <h1 className="text-8xl md:text-9xl font-bold mb-4 text-white" style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.5), 0 0 30px rgba(255, 255, 255, 0.3)' }}>
            Jarbes
          </h1>
          <h2 className="text-2xl md:text-3xl text-cyan-400 font-semibold mb-4">
            a solução que você precisa em um só lugar
          </h2>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            Automatize tarefas, interaja com sistemas e obtenha informações em tempo real, tudo através de comandos de voz simples e intuitivos.
          </p>
        </header>

        <main className="text-center">
          <div className="my-12">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
                onClick={activateAssistant}
              >
                Abrir Assistente
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
              >
                Ver Documentação
              </Button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 select-text">
            <div className="bg-gray-900 bg-opacity-50 p-6 rounded-lg shadow-lg border border-cyan-400/50 backdrop-blur-sm text-center">
              <ShieldCheck className="h-8 w-8 mx-auto mb-4 text-cyan-400" />
              <h3 className="text-2xl font-bold mb-2 text-white">Controle Total</h3>
              <p className="text-gray-300">
                Navegue, preencha formulários e execute ações complexas usando apenas a sua voz.
              </p>
            </div>
            <div className="bg-gray-900 bg-opacity-50 p-6 rounded-lg shadow-lg border border-cyan-400/50 backdrop-blur-sm text-center">
              <Cog className="h-8 w-8 mx-auto mb-4 text-cyan-400" />
              <h3 className="text-2xl font-bold mb-2 text-white">Integração Fácil</h3>
              <p className="text-gray-300">
                Conecte-se a qualquer API ou sistema interno para criar fluxos de trabalho personalizados.
              </p>
            </div>
            <div className="bg-gray-900 bg-opacity-50 p-6 rounded-lg shadow-lg border border-cyan-400/50 backdrop-blur-sm text-center">
              <MessageCircleReply className="h-8 w-8 mx-auto mb-4 text-cyan-400" />
              <h3 className="text-2xl font-bold mb-2 text-white">Respostas Instantâneas</h3>
              <p className="text-gray-300">
                Obtenha dados e insights de suas ferramentas de negócios em tempo real, sem sair da tela.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;