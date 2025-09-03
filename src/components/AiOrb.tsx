"use client";

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

type OrbState = 'idle' | 'listening' | 'processing' | 'speaking';

interface ParticleOrbProps {
  state: OrbState;
}

const ParticleOrb: React.FC<ParticleOrbProps> = ({ state }) => {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const { positions, colors, linePositions } = useMemo(() => {
    const particleCount = 10000; // Increased particle count
    const radius = 1.5;
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const linePos = [];

    const colorIdle = [new THREE.Color('#8A2BE2'), new THREE.Color('#00BFFF'), new THREE.Color('#FFFFFF')];
    const colorListening = [new THREE.Color('#00BFFF'), new THREE.Color('#00F5FF'), new THREE.Color('#E0FFFF')];
    const colorProcessing = [new THREE.Color('#BA55D3'), new THREE.Color('#FF00FF'), new THREE.Color('#DA70D6')];
    const colorSpeaking = [new THREE.Color('#00FF7F'), new THREE.Color('#7FFFD4'), new THREE.Color('#FFFFFF')];

    let stateColors = colorIdle;
    if (state === 'listening') stateColors = colorListening;
    if (state === 'processing') stateColors = colorProcessing;
    if (state === 'speaking') stateColors = colorSpeaking;

    for (let i = 0; i < particleCount; i++) {
      const theta = THREE.MathUtils.randFloatSpread(360);
      const phi = THREE.MathUtils.randFloatSpread(360);
      const r = Math.pow(Math.random(), 0.75) * radius;

      pos[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      pos[i * 3 + 2] = r * Math.cos(theta);

      const color = stateColors[Math.floor(Math.random() * stateColors.length)];
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }

    for (let i = 0; i < 150; i++) { // Increased line count
      const start = Math.floor(Math.random() * particleCount);
      const end = Math.floor(Math.random() * particleCount);
      linePos.push(pos[start * 3], pos[start * 3 + 1], pos[start * 3 + 2]);
      linePos.push(pos[end * 3], pos[end * 3 + 1], pos[end * 3 + 2]);
    }

    return { positions: pos, colors: col, linePositions: new Float32Array(linePos) };
  }, [state]);

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.getElapsedTime();
      groupRef.current.rotation.y = t * 0.1;
      groupRef.current.rotation.x = t * 0.05;
      groupRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.05);
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.012} vertexColors transparent opacity={0.9} sizeAttenuation />
      </points>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={linePositions.length / 3} array={linePositions} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="white" transparent opacity={0.1} />
      </lineSegments>
    </group>
  );
};

export const AiOrb: React.FC<{ state: OrbState }> = ({ state }) => {
  return (
    <Canvas camera={{ position: [0, 0, 3.5] }}>
      <ambientLight intensity={0.5} />
      <ParticleOrb state={state} />
      <EffectComposer>
        <Bloom luminanceThreshold={0} luminanceSmoothing={0.9} height={400} intensity={1.5} />
      </EffectComposer>
    </Canvas>
  );
};