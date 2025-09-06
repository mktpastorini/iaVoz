import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { Tube } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

const EnergyLine = () => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const curve = useMemo(() => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      points.push(new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(5),
        THREE.MathUtils.randFloatSpread(5),
        THREE.MathUtils.randFloatSpread(5)
      ));
    }
    return new THREE.CatmullRomCurve3(points, true);
  }, []);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity = 0.2 + Math.sin(clock.elapsedTime * 0.5 + curve.points.length) * 0.2;
    }
  });

  return (
    <Tube args={[curve, 64, 0.005, 8, false]}>
      <meshBasicMaterial
        ref={materialRef}
        color="#00ffff"
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        transparent
      />
    </Tube>
  );
};

export const EnergyLines = () => {
  const lines = useMemo(() => Array.from({ length: 20 }, (_, i) => <EnergyLine key={i} />), []);
  return <>{lines}</>;
};