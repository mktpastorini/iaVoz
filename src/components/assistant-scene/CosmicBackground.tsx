"use client";

import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CosmicBackgroundProps {
  quality: 'desktop' | 'mobile';
}

const Starfield = ({ count }: { count: number }) => {
  const pointsRef = React.useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.015} color="#ffffff" transparent opacity={0.8} />
    </points>
  );
};

const NebulaWisps = ({ count }: { count: number }) => {
    const pointsRef = React.useRef<THREE.Points>(null!);
  
    const positions = useMemo(() => {
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 8;
        const y = (Math.random() - 0.5) * 4;
        const z = (Math.random() - 0.5) * 8 - 4;
        arr.set([x, y, z], i * 3);
      }
      return arr;
    }, [count]);
  
    useFrame((_, delta) => {
      if (pointsRef.current) {
        pointsRef.current.rotation.y += delta * 0.03;
      }
    });
  
    return (
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.2} color="#8A2BE2" transparent opacity={0.05} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    );
  };

const CosmicBackground: React.FC<CosmicBackgroundProps> = ({ quality }) => {
  const starCount = quality === 'desktop' ? 5000 : 1200;
  const nebulaCount = quality === 'desktop' ? 1000 : 300;

  return (
    <>
      <Starfield count={starCount} />
      <NebulaWisps count={nebulaCount} />
    </>
  );
};

export default CosmicBackground;