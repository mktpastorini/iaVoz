import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

const vertexShader = `
  uniform float uTime;
  uniform float uPulseIntensity;
  uniform float uAudioIntensity;
  attribute float aScale;
  varying float vMixValue;

  // Classic Perlin 3D Noise by Stefan Gustavson
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

  float cnoise(vec3 P){
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec3 ix = vec3(Pi0.x, Pi1.x, Pi0.x);
    vec3 iy = vec3(Pi0.y, Pi0.y, Pi1.y);
    vec3 iz0 = Pi0.z;
    vec3 iz1 = Pi1.z;
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = ixy + iz0;
    vec4 ixy1 = ixy + iz1;
    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
    vec3 w0 = fade(Pf0);
    vec3 w1 = fade(Pf1);
    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.y, Pf0.z));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.x, Pf1.y, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.x, Pf0.y, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.y, Pf1.z));
    float n111 = dot(g111, Pf1);
    float n00 = mix(n000, n100, w0.x);
    float n10 = mix(n010, n110, w0.x);
    float n01 = mix(n001, n101, w0.x);
    float n11 = mix(n011, n111, w0.x);
    float n0 = mix(n00, n10, w0.y);
    float n1 = mix(n01, n11, w0.y);
    return 2.2 * mix(n0, n1, w0.z);
  }

  void main() {
    vec3 pos = position;
    float noise = cnoise(pos * 2.5 + uTime * 0.2);
    pos += normal * (noise * 0.1 * (1.0 + uAudioIntensity * 5.0) + uPulseIntensity);

    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;
    gl_PointSize = aScale * 2.0 * (1.0 / -viewPosition.z);

    vMixValue = smoothstep(-1.0, 1.0, pos.y);
  }
`;

const fragmentShader = `
  varying float vMixValue;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    vec3 color1 = vec3(0.0, 1.0, 1.0); // Cyan
    vec3 color2 = vec3(1.0, 0.0, 1.0); // Magenta
    vec3 finalColor = mix(color1, color2, vMixValue);

    gl_FragColor = vec4(finalColor, (1.0 - dist * 2.0) * 0.8);
  }
`;

const ParticleOrbMaterial = shaderMaterial(
  { uTime: 0, uPulseIntensity: 0, uAudioIntensity: 0 },
  vertexShader,
  fragmentShader
);
extend({ ParticleOrbMaterial });

const ParticleOrb = ({ isSpeaking }: { isSpeaking: boolean }) => {
  const materialRef = useRef<any>();
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const count = 50000;
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
      const phi = Math.acos(THREE.MathUtils.randFloat(-1, 1));
      const r = THREE.MathUtils.randFloat(0.8, 1.2);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      scales[i] = THREE.MathUtils.randFloat(0.5, 1.5);
    }
    return { positions, scales };
  }, []);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.elapsedTime;
      materialRef.current.uPulseIntensity = 0.05 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      materialRef.current.uAudioIntensity = THREE.MathUtils.damp(
        materialRef.current.uAudioIntensity,
        isSpeaking ? 1 : 0,
        4,
        delta
      );
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particles.positions.length / 3} array={particles.positions} itemSize={3} />
        <bufferAttribute attach="attributes-aScale" count={particles.scales.length} array={particles.scales} itemSize={1} />
      </bufferGeometry>
      <particleOrbMaterial
        ref={materialRef}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent={true}
      />
    </points>
  );
};

export const AiOrb = ({ isSpeaking }: { isSpeaking: boolean }) => {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial color="white" toneMapped={false} />
      </mesh>
      <pointLight color="white" intensity={3.0} distance={5} />
      <ParticleOrb isSpeaking={isSpeaking} />
    </group>
  );
};