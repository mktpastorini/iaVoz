"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { SparklesCore } from "@/components/ui/sparkles";

const Index = () => {
  const { activateAssistant } = useVoiceAssistant();

  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden p-4 select-text">
      <header className="text-center mb-12 z-10 relative w-full">
        <div className="h-[20rem] w-full bg-black flex flex-col items-center justify-center overflow-hidden rounded-md">
          <h1 className="md:text-7xl text-3xl lg:text-9xl font-bold text-center text-white relative z-20">
            Jarbes
          </h1>
          <div className="w-[40rem] h-40 relative">
            {/* Gradients */}
            <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
            <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
            <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
            <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

            {/* Core component */}
            <SparklesCore
              background="transparent"
              minSize={0.4}
              maxSize={1}
              particleDensity={1200}
              className="w-full h-full"
              particleColor="#FFFFFF"
            />

            {/* Radial Gradient to prevent sharp edges */}
            <div className="absolute inset-0 w-full h-full bg-black [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]"></div>
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mt-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
          a soluçao que voce precisa em um so lugar
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mt-4">
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
    </div>
  );
};

export default Index;