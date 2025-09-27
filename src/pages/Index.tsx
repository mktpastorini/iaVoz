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
        <h1 className="text-5xl md:text-8xl font-extrabold mb-4 text-white">
          Jarbes
        </h1>
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-cyan-400">
          a solução que você precisa em um só lugar
        </h2>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
          Automatize tarefas, interaja com sistemas e obtenha informações em tempo real, tudo através de comandos de voz simples e intuitivos.
        </p>
      </header>

      <main className="text-center z-10 relative">
        <div className="mb-12">
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
              className="bg-transparent border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
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
            <h3 className="text-2xl font-bold mb-2 text-cyan-400">Integração Fácil</h3>
            <p className="text-gray-300">
              Conecte-se a qualquer API ou sistema interno para criar fluxos de trabalho personalizados.
            </p>
          </div>
          <div className="bg-gray-800 bg-opacity-60 p-6 rounded-lg shadow-lg">
            <h3 className="text-2xl font-bold mb-2 text-cyan-400">Respostas Instantâneas</h3>
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