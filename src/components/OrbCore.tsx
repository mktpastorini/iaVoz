"use client";

import React from "react";
import * as THREE from "three";

export const OrbCore: React.FC = () => {
  return (
    <>
      <mesh>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial
          color={new THREE.Color("#FFFFFF")}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        color={new THREE.Color("#00FFFF")}
        intensity={150} // High intensity light
        distance={5}
        decay={2}
      />
    </>
  );
};