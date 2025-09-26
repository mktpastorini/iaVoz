"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";

const Index = () => {
  const { activateAssistant } = useVoiceAssistant();

  const features = [
    {
      title: "Controle Total",
      description:
        "Navegue, preencha formulários e execute ações complexas usando apenas a sua voz.",
    },
    {
      title: "Integração Fácil",
      description:
        "Conecte-se a qualquer API ou sistema interno para criar fluxos de trabalho personalizados.",
    },
    {
      title: "Respostas Instantâneas",
      description:
        "Obtenha dados e insights de suas ferramentas de negócios em tempo real, sem sair da tela.",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0B022D] to-[#20053D] text-white flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-violet-400 bg-clip-text text-transparent pb-4">
          Inteligência Artificial por Voz
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
          Automatize tarefas, interaja com sistemas e obtenha informações em
          tempo real, tudo através de comandos de voz simples e intuitivos.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={activateAssistant}
            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold px-8 py-6 text-lg rounded-full transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Abrir Assistente
          </Button>
          <Button
            variant="outline"
            className="border-2 border-purple-400 text-purple-300 hover:bg-purple-400/10 hover:text-white font-semibold px-8 py-6 text-lg rounded-full transition-all duration-300"
          >
            Ver Documentação
          </Button>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
        {features.map((feature) => (
          <Card
            key={feature.title}
            className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl shadow-lg"
          >
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-cyan-300">
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Index;