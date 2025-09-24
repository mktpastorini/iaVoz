"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import Orb from "@/components/Orb";

const Index = () => {
  const { activateAssistant } = useVoiceAssistant();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#20053D] to-[#0B022D] text-white flex flex-col items-center justify-center p-4 select-text">
      <header className="text-center mb-12 z-10 relative">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
          Inteligência Artificial por Voz
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
          Automatize tarefas, interaja com sistemas e obtenha informações em tempo real, tudo através de comandos de voz simples e intuitivos.
        </p>
      </header>

      <main className="text-center z-10 relative">
        <div className="mb-12">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Button
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
              onClick={activateAssistant}
            >
              Abrir Assistente
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
            >
              Ver Documentação
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 select-text">
          <div className="bg-gray-800 bg-opacity-60 p-6 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold mb-2 text-cyan-400">Controle Total</h3>
            <p className="text-gray-300">
              Navegue, preencha formulários e execute ações complexas usando apenas a sua voz.
            </p>
          </div>
          <div className="bg-gray-800 bg-opacity-60 p-6 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold mb-2 text-magenta-400">Integração Fácil</h3>
            <p className="text-gray-300">
              Conecte-se a qualquer API ou sistema interno para criar fluxos de trabalho personalizados.
            </p>
          </div>
          <div className="bg-gray-800 bg-opacity-60 p-6 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold mb-2 text-white">Respostas Instantâneas</h3>
            <p className="text-gray-300">
              Obtenha dados e insights de suas ferramentas de negócios em tempo real, sem sair da tela.
            </p>
          </div>
        </div>
      </main>

      {/* Background scene behind UI */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <Orb audioIntensity={0} />
      </div>
    </div>
  );
};

export default Index;