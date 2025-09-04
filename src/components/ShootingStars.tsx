"use client";

import React, { useMemo, useRef } from "react";
import { useFrame, extend } from "@react-three/fiber";
import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

const TrailMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color("#00FFFF"),
  },
  // vertex shader
  `
  uniform float uTime;
  varying float vAlpha;
  attribute float alpha;
  void main() {
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  // fragment shader
  `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    gl_FragColor = vec4(uColor, vAlpha * (1.0 - dist));
  }
  `
);

extend({ TrailMaterial });

export const ShootingStars: React.FC = () => {
  const count = 40;
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const alphas = useMemo(() => new Float32Array(count), [count]);
  const velocities = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(0.3 + Math.random() * 0.5);
    }
    return arr;
  }, [count]);

  const stars = useRef(
    Array.from({ length: count }, () => ({
      position: new THREE.Vector3(
        -20 - Math.random() * 10,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
      ),
      life: 0,
      maxLife: 3 + Math.random() * 2,
    }))
  );

  useFrame(() => {
    stars.current.forEach((star, i) => {
      star.position.x += velocities[i];
      star.life += 0.02;
      alphas[i] = 1 - star.life / star.maxLife;

      if (star.life > star.maxLife) {
        star.position.set(
          -20 - Math.random() * 10,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40
        );
        star.life = 0;
        star.maxLife = 3 + Math.random() * 2;
      }

      positions[i * 3] = star.position.x;
      positions[i * 3 + 1] = star.position.y;
      positions[i * 3 + 2] = star.position.z;
    });
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-alpha"
          count={count}
          array={alphas}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={3}
        color="#00FFFF"
        transparent
        vertexColors={false}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};