"use client";

import React from "react";
import { SparklesCore } from "@/components/ui/sparkles";

const Index = () => {
  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden">
      <div className="w-full absolute inset-0 h-screen">
        <SparklesCore
          id="tsparticles"
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={1200}
          className="w-full h-full"
          particleColor="#FFFFFF"
        />
      </div>
      <div className="relative z-20 text-center p-4">
        <h1 className="md:text-7xl text-5xl lg:text-8xl font-bold text-white">
          Jarbes
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mt-4">
          A solução que você precisa em um só lugar.
        </p>
      </div>
    </div>
  );
};

export default Index;