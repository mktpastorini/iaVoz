"use client";

import React from "react";
import { SparklesCore } from "@/components/ui/sparkles";

const Index = () => {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-black">
      {/* Efeito de Partículas no Fundo */}
      <div className="absolute inset-0 h-screen w-full">
        <SparklesCore
          id="tsparticles"
          background="transparent"
          minSize={0.4}
          maxSize={1.2}
          particleDensity={1000}
          className="h-full w-full"
          particleColor="#FFFFFF"
        />
      </div>

      {/* Conteúdo da Página */}
      <div className="relative z-20 flex flex-col items-center p-4 text-center">
        <img 
          src="/imagem.png" 
          alt="Logo" 
          className="mb-8 h-auto w-full max-w-sm" 
        />
        <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
          A solução que você precisa em um só lugar
        </h1>
      </div>
    </div>
  );
};

export default Index;