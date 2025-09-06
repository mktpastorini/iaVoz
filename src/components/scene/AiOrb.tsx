"use client";

import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { particleVertexShader, particleFragmentShader } from '@/lib/shaders';

interface AiOrbProps {
  isSpeaking: boolean;
  audioIntensity: number;
}

const OrbCore: React.FC = () => (
  <>
    <mesh>
      <sphereGeometry args={[0.1, 32, 32]} />
      <meshBasicMaterial color="white" toneMapped={false} />
    </mesh>
    <pointLight color="white" intensity={3.0} distance={5} />
  </>
);

const ParticleOrb: React.FC<AiOrbProps> = ({ isSpeaking, audioIntensity }) => {
  const pointsRef = useRef<THREE.Points>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const [positions, colors, scales] = useMemo(() => {
    const numParticles = 50000;
    const positions = new Float32Array(numParticles * 3);
    const colors = new Float32Array(numParticles * 3);
    const scales = new Float32Array(numParticles);
    const colorCyan = new THREE.Color('#00FFFF');
    const colorMagenta = new THREE.Color('#FF00FF');

    for (let i = 0; i < numParticles; i++) {
      const i3 = i * 3;
      const radius = 1.5;
      const { x, y, z } = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(radius * Math.random());
      
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      const gradientColor = colorCyan.clone().lerp(colorMagenta, (y + radius) / (2 * radius));
      colors[i3] = gradientColor.r;
      colors[i3 + 1] = gradientColor.g;
      colors[i3 + 2] = gradientColor.b;

      scales[i] = Math.random() * 0.5 + 0.5;
    }
    return [positions, colors, scales];
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPulseIntensity: { value: 0 },
    uAudioIntensity: { value: 0 },
  }), []);

  useFrame((state) => {
    const { clock } = state;
    materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    materialRef.current.uniforms.uPulseIntensity.value = 0.05 + Math.sin(clock.getElapsedTime() * 0.5) * 0.05;
    
    // Smoothly transition audio intensity
    const currentAudioIntensity = materialRef.current.uniforms.uAudioIntensity.value;
    const targetIntensity = isSpeaking ? audioIntensity : 0;
    materialRef.current.uniforms.uAudioIntensity.value = THREE.MathUtils.lerp(currentAudioIntensity, targetIntensity, 0.1);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-aScale" count={scales.length} array={scales} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent={true}
        vertexColors
      />
    </points>
  );
};

export const AiOrb: React.FC<AiOrbProps> = (props) => {
  return (
    <group>
      <OrbCore />
      <ParticleOrb {...props} />
    </group>
  );
};