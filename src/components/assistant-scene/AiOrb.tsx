"use client";

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders/particleShader';

interface AiOrbProps {
  audioIntensity: number;
  isSpeaking: boolean;
  quality: 'desktop' | 'mobile';
}

const OrbCore = () => {
  return (
    <>
      <mesh>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial color="#00ffff" toneMapped={false} />
      </mesh>
      <pointLight color="#00ffff" intensity={10} distance={5} />
    </>
  );
};

const ParticleOrb = ({ audioIntensity, isSpeaking, count }: { audioIntensity: number; isSpeaking: boolean; count: number }) => {
  const pointsRef = useRef<THREE.Points>(null!);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPulseIntensity: { value: 0.12 },
    uAudioIntensity: { value: 0 },
    uBaseColorA: { value: new THREE.Color('#00FFFF') },
    uBaseColorB: { value: new THREE.Color('#FF00FF') }
  }), []);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.cbrt(Math.random()) * 0.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      arr.set([x, y, z], i * 3);
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    
    const pulse = 0.1 + Math.sin(t * 2.0) * 0.08 + (audioIntensity * 0.5);
    uniforms.uPulseIntensity.value = THREE.MathUtils.lerp(
      uniforms.uPulseIntensity.value,
      pulse,
      0.08
    );
    uniforms.uAudioIntensity.value = THREE.MathUtils.lerp(
      uniforms.uAudioIntensity.value,
      isSpeaking ? audioIntensity : 0,
      0.06
    );
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent={true}
      />
    </points>
  );
};

const AiOrb: React.FC<AiOrbProps> = ({ audioIntensity, isSpeaking, quality }) => {
  const particleCount = quality === 'desktop' ? 50000 : 6000;

  return (
    <group>
      <OrbCore />
      <ParticleOrb audioIntensity={audioIntensity} isSpeaking={isSpeaking} count={particleCount} />
    </group>
  );
};

export default AiOrb;