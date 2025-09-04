"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

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
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40
        ),
        velocity: new THREE.Vector3(
          0.1 + Math.random() * 0.3,
          0,
          0
        ),
        life: Math.random() * 2 + 1,
        maxLife: 3 + Math.random() * 2,
      });
    }
    return stars;
  }, []);

  const shootingStarsRef = useRef(shootingStars);

  // Geometry and material for shooting stars trail
  const trailGeometry = useMemo(() => new THREE.BufferGeometry(), []);
  const trailMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: new THREE.Color("#00FFFF"),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  // Update shooting stars positions and trails
  useFrame(() => {
    // Rotate star dust slowly
    if (starDustRef.current) {
      starDustRef.current.rotation.y += 0.0001;
    }

    // Update shooting stars
    shootingStarsRef.current.forEach((star) => {
      star.position.add(star.velocity);
      star.life += 0.02;
      if (star.life > star.maxLife) {
        // Reset star
        star.position.set(
          -20 - Math.random() * 10,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40
        );
        star.life = 0;
        star.maxLife = 3 + Math.random() * 2;
        star.velocity.set(0.1 + Math.random() * 0.3, 0, 0);
      }
    });
  });

  // Shooting stars component
  const ShootingStars = () => {
    const pointsRef = useRef<THREE.Points>(null);

    // Positions for points and trails
    const positions = useMemo(() => new Float32Array(shootingStarCount * 3), []);
    const trailPositions = useMemo(() => new Float32Array(shootingStarCount * 6), []); // line from current to previous pos

    useFrame(() => {
      shootingStarsRef.current.forEach((star, i) => {
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

      if (pointsRef.current) {
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
      }
    });

    return (
      <>
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={shootingStarCount}
              array={positions}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={3}
            color="#00FFFF"
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        <lineSegments geometry={trailGeometry} material={trailMaterial}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={shootingStarCount * 2}
              array={trailPositions}
              itemSize={3}
            />
          </bufferGeometry>
        </lineSegments>
      </>
    );
  };

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
      <ShootingStars />
    </>
  );
};