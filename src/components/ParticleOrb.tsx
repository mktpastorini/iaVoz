"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ParticleOrbProps {
  particleCount?: number;
  radius?: number;
  audioIntensity: number; // Nova propriedade para a intensidade do áudio
}

export const ParticleOrb: React.FC<ParticleOrbProps> = ({
  particleCount = 5000,
  radius = 1.5,
  audioIntensity = 0,
}) => {
  const shaderMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const smoothedAudioIntensity = useRef(0);

  const { positions, uvs } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const uv = new Float32Array(particleCount * 2);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.cbrt(Math.random()) * radius;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      uv[i * 2] = 0.5;
      uv[i * 2 + 1] = (y + radius) / (2 * radius);
    }

    return { positions: pos, uvs: uv };
  }, [particleCount, radius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulseIntensity: { value: 0 },
      uAudioIntensity: { value: 0 }, // Novo uniform para o áudio
      uColorA: { value: new THREE.Color("#99FFFF") },
      uColorB: { value: new THREE.Color("#FF00FF") },
    }),
    []
  );

  const vertexShader = `
    uniform float uTime;
    uniform float uPulseIntensity;
    uniform float uAudioIntensity; // Novo uniform
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec3 pos = position;

      float pulse = 0.3 + 0.7 * abs(sin(uTime * 1.5 + pos.x * 10.0 + pos.y * 10.0 + pos.z * 10.0));
      float displacement = pulse * uPulseIntensity * 0.5;
      
      // Adiciona o deslocamento do áudio
      displacement += uAudioIntensity * 1.5;

      pos += normalize(pos) * displacement;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = 2.0 + 2.0 * uPulseIntensity + 3.0 * uAudioIntensity;
    }
  `;

  const fragmentShader = `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying vec2 vUv;

    void main() {
      vec3 color = mix(uColorA, uColorB, vUv.y);
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      gl_FragColor = vec4(color, 1.0 - dist);
    }
  `;

  useFrame(({ clock }) => {
    if (shaderMaterialRef.current) {
      const time = clock.elapsedTime;
      shaderMaterialRef.current.uniforms.uTime.value = time;
      
      const pulse1 = 0.5 + 0.5 * Math.sin(time * 1.2);
      const pulse2 = 0.7 + 0.3 * Math.sin(time * 2.7);
      shaderMaterialRef.current.uniforms.uPulseIntensity.value = pulse1 * pulse2;

      // Suaviza a transição da intensidade do áudio para evitar "saltos"
      smoothedAudioIntensity.current = THREE.MathUtils.lerp(
        smoothedAudioIntensity.current,
        audioIntensity,
        0.1 // Fator de suavização
      );
      shaderMaterialRef.current.uniforms.uAudioIntensity.value = smoothedAudioIntensity.current;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-uv"
          count={particleCount}
          array={uvs}
          itemSize={2}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderMaterialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </points>
  );
};