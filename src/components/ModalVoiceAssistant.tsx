"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { cn } from "@/lib/utils";

const PARTICLE_COUNT = 2000;
const LINE_COUNT = 1500;

function OrbParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  // Generate particles positions in a spherical shell with some noise
  const particlesData = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spherical coordinates with radius ~1 + noise
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 0.9 + Math.random() * 0.2; // shell thickness 0.2

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Color gradient: blue cyan, electric purple, white
      const t = Math.random();
      if (t < 0.4) {
        // cyan blue
        colors[i * 3] = 0.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
      } else if (t < 0.8) {
        // electric purple
        colors[i * 3] = 0.6;
        colors[i * 3 + 1] = 0.0;
        colors[i * 3 + 2] = 1.0;
      } else {
        // white
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
      }
    }
    return { positions, colors };
  }, []);

  // Generate random pairs of indices for lines connecting particles
  const linesData = useMemo(() => {
    const positions = new Float32Array(LINE_COUNT * 2 * 3);
    const colors = new Float32Array(LINE_COUNT * 2 * 3);
    for (let i = 0; i < LINE_COUNT; i++) {
      const idx1 = Math.floor(Math.random() * PARTICLE_COUNT);
      const idx2 = Math.floor(Math.random() * PARTICLE_COUNT);

      // Positions for line start
      positions[i * 6] = particlesData.positions[idx1 * 3];
      positions[i * 6 + 1] = particlesData.positions[idx1 * 3 + 1];
      positions[i * 6 + 2] = particlesData.positions[idx1 * 3 + 2];

      // Positions for line end
      positions[i * 6 + 3] = particlesData.positions[idx2 * 3];
      positions[i * 6 + 4] = particlesData.positions[idx2 * 3 + 1];
      positions[i * 6 + 5] = particlesData.positions[idx2 * 3 + 2];

      // Colors for line start and end (white with some transparency)
      colors[i * 6] = 0.7;
      colors[i * 6 + 1] = 0.7;
      colors[i * 6 + 2] = 1.0;
      colors[i * 6 + 3] = 0.7;
      colors[i * 6 + 4] = 0.7;
      colors[i * 6 + 5] = 1.0;
    }
    return { positions, colors };
  }, [particlesData.positions]);

  // Animate particles with subtle pulsation and rotation
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (pointsRef.current) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        // Pulsate radius slightly
        const baseX = particlesData.positions[ix];
        const baseY = particlesData.positions[ix + 1];
        const baseZ = particlesData.positions[ix + 2];
        const r = Math.sqrt(baseX * baseX + baseY * baseY + baseZ * baseZ);
        const pulse = 0.05 * Math.sin(time * 2 + i);
        const scale = (r + pulse) / r;
        positions[ix] = baseX * scale;
        positions[ix + 1] = baseY * scale;
        positions[ix + 2] = baseZ * scale;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.rotation.y = time * 0.1;
      pointsRef.current.rotation.x = time * 0.07;
    }

    if (linesRef.current) {
      linesRef.current.rotation.y = time * 0.1;
      linesRef.current.rotation.x = time * 0.07;
    }
  });

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={particlesData.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={PARTICLE_COUNT}
            array={particlesData.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={0.015}
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={LINE_COUNT * 2}
            array={linesData.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={LINE_COUNT * 2}
            array={linesData.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}

const OrbGlow = () => {
  // A subtle glowing sphere with emissive color for internal glow and halo
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshBasicMaterial
        color="#6f42c1"
        transparent
        opacity={0.1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};

const Orb = () => {
  return (
    <>
      <OrbGlow />
      <OrbParticles />
    </>
  );
};

export const ModalVoiceAssistant = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-purple-800">
      {/* Blurred background layer */}
      <div className="absolute inset-0 backdrop-blur-[10px] bg-black/60 pointer-events-none" />
      {/* Content container */}
      <div className="relative z-10 flex flex-col items-center justify-center select-none">
        <div className="w-[320px] h-[320px]">
          <Canvas
            camera={{ position: [0, 0, 3], fov: 50 }}
            gl={{ antialias: true, alpha: true }}
            style={{ width: "100%", height: "100%" }}
          >
            <ambientLight intensity={0.3} />
            <pointLight position={[5, 5, 5]} intensity={1} />
            <Orb />
            <EffectComposer>
              <Bloom
                luminanceThreshold={0.1}
                luminanceSmoothing={0.9}
                height={300}
                intensity={1.5}
                radius={0.8}
              />
            </EffectComposer>
          </Canvas>
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