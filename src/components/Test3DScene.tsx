"use client";

import React from 'react';
import { Canvas } from '@react-three/fiber';

const Test3DScene = () => {
  return (
    <Canvas className="absolute inset-0 z-0" camera={{ position: [0, 0, 5] }}>
      <ambientLight />
      <mesh rotation={[10, 10, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    </Canvas>
  );
};

export default Test3DScene;