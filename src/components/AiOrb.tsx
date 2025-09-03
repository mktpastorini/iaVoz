"use client";

import React from "react";
import { cn } from "@/lib/utils";

type OrbState = 'idle' | 'listening' | 'processing' | 'speaking';

interface AiOrbProps {
  state: OrbState;
}

export const AiOrb: React.FC<AiOrbProps> = ({ state }) => {
  const stateClasses = {
    idle: "ai-orb-idle",
    listening: "ai-orb-listening",
    processing: "ai-orb-processing",
    speaking: "ai-orb-speaking",
  };

  return (
    <div className={cn("ai-orb", stateClasses[state])}>
      <div className="orb-glow"></div>
      <div className="orb-core"></div>
      <div className="orb-texture"></div>
    </div>
  );
};