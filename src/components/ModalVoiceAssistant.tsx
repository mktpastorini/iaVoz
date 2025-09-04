"use client";

import React from "react";
import { cn } from "@/lib/utils";

export const ModalVoiceAssistant = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-purple-800">
      {/* Blurred background layer */}
      <div className="absolute inset-0 backdrop-blur-[10px] bg-black/60 pointer-events-none" />
      {/* Content container */}
      <div className="relative z-10 flex flex-col items-center justify-center select-none">
        {/* Placeholder for the 3D Orb */}
        <div className="w-[320px] h-[320px] flex items-center justify-center">
          <div className="w-64 h-64 rounded-full bg-purple-500/20 animate-pulse flex items-center justify-center shadow-[0_0_100px_rgba(128,0,128,0.5)]">
            <div className="w-48 h-48 rounded-full bg-cyan-500/20 animate-pulse shadow-[0_0_80px_rgba(0,255,255,0.4)]"></div>
          </div>
        </div>
        <div className="mt-8 text-center max-w-xs">
          <p className="text-purple-400 text-sm opacity-70 mb-1 font-mono tracking-wide">
            Inteligência Artificial por Voz
          </p>
          <h1 className={cn(
            "text-white text-3xl font-extrabold font-sans",
            "drop-shadow-[0_0_10px_rgba(100,200,255,0.8)]"
          )}>
            Olá! Como posso te ajudar?
          </h1>
          <p className="text-white text-opacity-60 mt-2 font-medium font-sans">
            Ouvindo...
          </p>
        </div>
      </div>
    </div>
  );
};