"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COMET_COUNT = 7;
const TAIL_LENGTH = 15;
const TOTAL_PARTICLES = COMET_COUNT * TAIL_LENGTH;

class Comet {
  head: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  tail: { position: THREE.Vector3; alpha: number }[];

  constructor() {
    this.reset();
  }

  reset() {
    const spawnRadius = 25;
    this.head = new THREE.Vector3(
      -spawnRadius,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30
    );
    this.velocity = new THREE.Vector3(
      0.1 + Math.random() * 0.15,
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02
    );
    const colorOptions = [
      new THREE.Color("#7B2FF7"), // Roxo
      new THREE.Color("#FF00FF"), // Magenta
      new THREE.Color("#00FFFF"), // Ciano
    ];
    this.color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
    this.tail = [];
  }

  update() {
    // Add current head position to tail
    this.tail.unshift({ position: this.head.clone(), alpha: 1.0 });
    if (this.tail.length > TAIL_LENGTH) {
      this.tail.pop();
    }

    // Update tail alphas
    this.tail.forEach((particle, i) => {
      particle.alpha = 1.0 - i / TAIL_LENGTH;
    });

    // Update head position
    this.head.add(this.velocity);

    // Reset if off-screen
    if (this.head.x > 25) {
      this.reset();
    }
  }
}

export const Comets: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const comets = useRef<Comet[]>(Array.from({ length: COMET_COUNT }, () => new Comet()));

  const positions = useMemo(() => new Float32Array(TOTAL_PARTICLES * 3), []);
  const colors = useMemo(() => new Float32Array(TOTAL_PARTICLES * 3), []);
  const alphas = useMemo(() => new Float32Array(TOTAL_PARTICLES), []);

  useFrame(() => {
    let particleIndex = 0;
    comets.current.forEach(comet => {
      comet.update();
      comet.tail.forEach(particle => {
        if (particleIndex < TOTAL_PARTICLES) {
          positions[particleIndex * 3] = particle.position.x;
          positions[particleIndex * 3 + 1] = particle.position.y;
          positions[particleIndex * 3 + 2] = particle.position.z;
          colors[particleIndex * 3] = comet.color.r;
          colors[particleIndex * 3 + 1] = comet.color.g;
          colors[particleIndex * 3 + 2] = comet.color.b;
          alphas[particleIndex] = particle.alpha;
          particleIndex++;
        }
      });
    });

    // Fill remaining buffer with invisible particles
    for (let i = particleIndex; i < TOTAL_PARTICLES; i++) {
      alphas[i] = 0;
    }

    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
      pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={TOTAL_PARTICLES} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={TOTAL_PARTICLES} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-alpha" count={TOTAL_PARTICLES} array={alphas} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={`
          attribute float alpha;
          varying float vAlpha;
          void main() {
            vAlpha = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 2.0 * alpha;
          }
        `}
        fragmentShader={`
          varying float vAlpha;
          varying vec3 vColor;
          void main() {
            if (vAlpha < 0.01) discard;
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            gl_FragColor = vec4(vColor, vAlpha * (1.0 - dist));
          }
        `}
        uniforms={{}}
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};