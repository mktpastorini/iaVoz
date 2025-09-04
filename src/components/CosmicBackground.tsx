"use client";

import React, { useMemo, useRef } from "react";
import { useFrame, extend } from "@react-three/fiber";
import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";
import { LineSegments } from "three";

// Custom shader material for shooting star trails
const ShootingStarTrailMaterial = shaderMaterial(
  {
    uTime: 0,
    uOpacity: 0.8,
    uColor: new THREE.Color("#00FFFF"),
  },
  // vertex shader
  `
  uniform float uTime;
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
  // fragment shader
  `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    gl_FragColor = vec4(uColor, uOpacity * vAlpha * (1.0 - dist));
  }
  `
);

extend({ ShootingStarTrailMaterial });

export const CosmicBackground: React.FC = () => {
  // Layer 1: Star Dust (slow moving, subtle)
  const starDustPositions = useMemo(() => {
    const count = 1000;
    const radius = 30;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, []);

  const starDustRef = useRef<THREE.Points>(null);

  // Layer 2: Shooting Stars (comets) with trails
  const shootingStarCount = 30;
  const shootingStars = useMemo(() => {
    const stars = [];
    for (let i = 0; i < shootingStarCount; i++) {
      stars.push({
        position: new THREE.Vector3(
          -20 - Math.random() * 10,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40
        ),
        velocity: new THREE.Vector3(
          0.3 + Math.random() * 0.5,
          0,
          0
        ),
        life: 0,
        maxLife: 3 + Math.random() * 2,
      });
    }
    return stars;
  }, []);

  const shootingStarsRef = useRef(shootingStars);

  // Positions and alphas for shooting stars and their trails
  const positions = useMemo(() => new Float32Array(shootingStarCount * 3), []);
  const trailPositions = useMemo(() => new Float32Array(shootingStarCount * 6), []);
  const alphas = useMemo(() => new Float32Array(shootingStarCount), []);

  useFrame(() => {
    // Rotate star dust slowly
    if (starDustRef.current) {
      starDustRef.current.rotation.y += 0.0001;
    }

    // Update shooting stars
    shootingStarsRef.current.forEach((star, i) => {
      star.position.add(star.velocity);
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
        star.velocity.set(0.3 + Math.random() * 0.5, 0, 0);
        alphas[i] = 1;
      }

      // Current position
      positions[i * 3] = star.position.x;
      positions[i * 3 + 1] = star.position.y;
      positions[i * 3 + 2] = star.position.z;

      // Trail from previous position (position - velocity * trailLength)
      const trailLength = 0.5;
      trailPositions[i * 6] = star.position.x - star.velocity.x * trailLength;
      trailPositions[i * 6 + 1] = star.position.y - star.velocity.y * trailLength;
      trailPositions[i * 6 + 2] = star.position.z - star.velocity.z * trailLength;

      trailPositions[i * 6 + 3] = star.position.x;
      trailPositions[i * 6 + 4] = star.position.y;
      trailPositions[i * 6 + 5] = star.position.z;
    });

    if (starDustRef.current) {
      starDustRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      <points ref={starDustRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={starDustPositions.length / 3}
            array={starDustPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.02}
          color="#ccffff"
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </points>

      {/* Shooting stars points */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={shootingStarCount}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-alpha"
            count={shootingStarCount}
            array={alphas}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={3}
          color="#00FFFF"
          transparent
          vertexColors={false}
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Shooting stars trails */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={shootingStarCount * 2}
            array={trailPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#00FFFF"
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
};