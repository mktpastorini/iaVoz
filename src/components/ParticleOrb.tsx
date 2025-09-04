"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ParticleOrbProps {
  particleCount?: number;
  radius?: number;
}

export const ParticleOrb: React.FC<ParticleOrbProps> = ({
  particleCount = 5000,
  radius = 1.5,
}) => {
  const shaderMaterialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate initial particle positions and UVs
  const { positions, uvs } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const uv = new Float32Array(particleCount * 2);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.cbrt(Math.random()) * radius; // cubic root for uniform sphere distribution

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // UV.y normalized vertical position for gradient interpolation
      uv[i * 2] = 0.5; // not used horizontally
      uv[i * 2 + 1] = (y + radius) / (2 * radius);
    }

    return { positions: pos, uvs: uv };
  }, [particleCount, radius]);

  // Uniforms for shader
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulseIntensity: { value: 0 },
      uColorA: { value: new THREE.Color("#00FFFF") }, // Cyan electric
      uColorB: { value: new THREE.Color("#FF00FF") }, // Magenta vibrant
    }),
    []
  );

  // Vertex shader: fluid motion with pulse, displacement along normal
  const vertexShader = `
    uniform float uTime;
    uniform float uPulseIntensity;
    varying vec2 vUv;

    // Simplex noise or similar can be added here if needed, but keeping simple sine wave for fluidity
    void main() {
      vUv = uv;
      vec3 pos = position;

      float pulse = 0.3 + 0.7 * abs(sin(uTime * 1.5 + pos.x * 10.0 + pos.y * 10.0 + pos.z * 10.0));
      float displacement = pulse * uPulseIntensity * 0.5;

      pos += normalize(pos) * displacement;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = 2.0 + 2.0 * uPulseIntensity;
    }
  `;

  // Fragment shader: vertical gradient mix between cyan and magenta
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
      shaderMaterialRef.current.uniforms.uTime.value = clock.elapsedTime;
      shaderMaterialRef.current.uniforms.uPulseIntensity.value =
        0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.2);
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