"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Mic } from "lucide-react";
import AudioWaveform from "./AudioWaveform";

const OrbParticles = () => {
  const particlesRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const particleCount = 5000;
    const radius = 2.5;
    const pos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    return pos;
  }, []);

  useFrame((state) => {
    const { clock } = state;
    if (particlesRef.current) {
      particlesRef.current.rotation.y = clock.getElapsedTime() * 0.05;
      particlesRef.current.rotation.x = clock.getElapsedTime() * 0.03;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry attach="geometry">
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        attach="material"
        size={0.01}
        color="#87CEEB"
        sizeAttenuation
        transparent
        opacity={0.9}
      />
    </points>
  );
};

export const ModalVoiceAssistant = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-[#0a192f] via-[#130f40] to-[#3c1053]">
      <div className="absolute inset-0 backdrop-blur-[2px] bg-black/30 pointer-events-none" />
      
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} color="#5D3FD3" intensity={2} />
          <pointLight position={[-10, -10, -10]} color="#00BFFF" intensity={2} />
          <OrbParticles />
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.1}
              luminanceSmoothing={0.9}
              height={400}
              intensity={1.2}
            />
          </EffectComposer>
        </Canvas>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center select-none w-full h-full gap-8">
        <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-xl py-4 px-8 shadow-lg">
          <h1 className="text-white text-3xl font-medium font-sans drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
            Olá! Como posso te ajudar?
          </h1>
        </div>

        <div className="flex items-center justify-center gap-4">
          <AudioWaveform />
          <AudioWaveform />
        </div>

        <div className="mt-4">
          <Mic className="h-8 w-8 text-white drop-shadow-[0_0_10px_white] animate-pulse" />
        </div>
      </div>
    </div>
  );
};