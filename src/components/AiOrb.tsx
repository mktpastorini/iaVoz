"use client";

import React, { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "tsparticles-slim";
import { orbConfig } from "@/config/orbConfig";
import type { ISourceOptions } from "tsparticles-engine";

type OrbState = 'idle' | 'listening' | 'processing' | 'speaking';

interface AiOrbProps {
  state: OrbState;
}

export const AiOrb: React.FC<AiOrbProps> = ({ state }) => {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const options: ISourceOptions = useMemo(() => {
    let newColors: string[];
    switch (state) {
      case 'listening':
        newColors = ["#00BFFF", "#00F5FF", "#E0FFFF"]; // Cyan/Blue tones
        break;
      case 'processing':
        newColors = ["#BA55D3", "#FF00FF", "#DA70D6"]; // Violet/Magenta tones
        break;
      case 'speaking':
        newColors = ["#00FF7F", "#7FFFD4", "#FFFFFF"]; // Aqua-green tones
        break;
      case 'idle':
      default:
        newColors = ["#8A2BE2", "#00BFFF", "#FFFFFF"]; // Default colors
        break;
    }

    // Deep copy the config to avoid mutation issues
    const newConfig = JSON.parse(JSON.stringify(orbConfig));
    newConfig.particles.color.value = newColors;
    return newConfig;
  }, [state]);

  if (init) {
    return (
      <Particles
        id="tsparticles"
        options={options}
        className="absolute w-[400px] h-[400px] z-10"
      />
    );
  }

  return null;
};