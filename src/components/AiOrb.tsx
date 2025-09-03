"use client";

import React, { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { backgroundConfig, orbConfig } from "@/config/orbConfig";

export const AiOrb: React.FC = () => {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  if (init) {
    return (
      <div className="absolute inset-0 flex items-center justify-center w-full h-full">
        <Particles id="tsparticles-bg" options={backgroundConfig} />
        <Particles id="tsparticles-orb" options={orbConfig} />
      </div>
    );
  }

  return null;
};