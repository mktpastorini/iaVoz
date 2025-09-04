"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { cn } from "@/lib/utils";

const OrbParticles = () => {
  const particlesRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const [positions, connections] = useMemo(() => {
    const particleCount = 3000;
    const radius = 2.5;
    const pos = new Float32Array(particleCount * 3);
    const con: number[] = [];

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

    for (let i = 0; i < particleCount; i++) {
      for (let j = i + 1; j < particleCount; j++) {
        const p1 = new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        const p2 = new THREE.Vector3(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
        if (p1.distanceTo(p2) < 0.2) {
          con.push(i, j);
        }
      }
    }

    return [pos, con];
  }, []);

  useFrame((state) => {
    const { clock } = state;
    if (particlesRef.current) {
      particlesRef.current.rotation.y = clock.getElapsedTime() * 0.1;
      particlesRef.current.rotation.x = clock.getElapsedTime() * 0.05;
    }
    if (linesRef.current) {
      linesRef.current.rotation.y = clock.getElapsedTime() * 0.1;
      linesRef.current.rotation.x = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <>
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
          size={0.008}
          color="#87CEEB"
          sizeAttenuation
          transparent
          opacity={0.8}
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="index"
            count={connections.length}
            array={new Uint16Array(connections)}
            itemSize={1}
          />
        </bufferGeometry>
        <lineBasicMaterial
          attach="material"
          color="#FFFFFF"
          transparent
          opacity={0.05}
        />
      </lineSegments>
    </>
  );
};

export const ModalVoiceAssistant = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-purple-800">
      <div className="absolute inset-0 backdrop-blur-[10px] bg-black/60 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center justify-center select-none w-full h-full">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 75 }}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <OrbParticles />
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.1}
              luminanceSmoothing={0.9}
              height={300}
              intensity={1.5}
            />
          </EffectComposer>
        </Canvas>
        <div className="relative z-20 mt-8 text-center max-w-xs">
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