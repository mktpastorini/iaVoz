"use client";

import React from "react";
import * as THREE from "three";

export const OrbCore: React.FC = () => {
  return (
    <mesh>
      <sphereGeometry args={[0.1, 32, 32]} />
      <meshBasicMaterial
        color={new THREE.Color("#FFFFFF")}
        toneMapped={false} // Garante que o brilho não seja atenuado pelo tone mapping
      />
    </mesh>
  );
};