"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import { Renderer, Camera, Transform, Program, Mesh, Geometry, Texture } from 'ogl';
import * as THREE from 'three'; // Usado para a função de ruído

interface OrbSceneProps {
  audioIntensity: number;
}

export const OrbScene: React.FC<OrbSceneProps> = ({ audioIntensity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const programRef = useRef<Program | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const sceneRef = useRef<Transform | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const smoothedAudioIntensity = useRef(0);

  // Shaders GLSL embutidos
  const vertexShader = `
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec2 uv;

    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;
    uniform float uTime;
    uniform float uAudioIntensity;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vDisplacement;

    // Classic Perlin 3D Noise
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

    float cnoise(vec3 P) {
      vec3 Pi0 = floor(P); // Integer part for indexing
      vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
      Pi0 = mod(Pi0, 289.0);
      Pi1 = mod(Pi1, 289.0);
      vec3 Pf0 = fract(P); // Fractional part for interpolation
      vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz;
      vec4 iz1 = Pi1.zzzz;

      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);

      vec4 gx0 = ixy0 / 7.0;
      vec4 gy0 = fract(floor(gx0) / 3.0) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);

      vec4 gx1 = ixy1 / 7.0;
      vec4 gy1 = fract(floor(gx1) / 3.0) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);

      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
      vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.x,gy0.z,gz0.z);
      vec3 g110 = vec3(gx0.y,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
      vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.x,gy1.z,gz1.z);
      vec3 g111 = vec3(gx1.y,gy1.w,gz1.w);

      vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000), dot(g010,g010), dot(g100,g100), dot(g110,g110)));
      g000 *= norm0.x;
      g010 *= norm0.y;
      g100 *= norm0.z;
      g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001), dot(g011,g011), dot(g101,g101), dot(g111,g111)));
      g001 *= norm1.x;
      g011 *= norm1.y;
      g101 *= norm1.z;
      g111 *= norm1.w;

      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);

      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
      return 2.2 * n_xyz;
    }

    void main() {
      vNormal = normal;
      vUv = uv;

      float noise = cnoise(normal * 2.0 + uTime * 0.1);
      float displacement = noise * (0.1 + uAudioIntensity * 0.5); // Audio intensity drives displacement
      
      // Add a subtle, constant pulse
      displacement += sin(uTime * 2.0 + position.x * 5.0) * 0.05;

      vec3 displacedPosition = position + normal * displacement;
      vDisplacement = displacement; // Pass displacement to fragment shader

      gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(displacedPosition, 1.0);
    }
  `;

  const fragmentShader = `
    precision highp float;

    uniform float uTime;
    uniform float uAudioIntensity;
    uniform sampler2D tMap; // Para textura, se quisermos adicionar depois

    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vDisplacement;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 colorA = vec3(0.0, 1.0, 1.0); // Ciano
      vec3 colorB = vec3(1.0, 0.0, 1.0); // Magenta
      vec3 colorC = vec3(0.5, 0.0, 1.0); // Roxo

      // Mistura de cores baseada na posição vertical e no tempo
      vec3 baseColor = mix(colorA, colorB, vUv.y + sin(uTime * 0.5) * 0.1);
      baseColor = mix(baseColor, colorC, abs(sin(uTime * 0.3 + vUv.x * 2.0)) * 0.2);

      // Adiciona um brilho/glow baseado na intensidade do áudio e no deslocamento
      float glow = smoothstep(0.0, 0.5, vDisplacement) * (0.5 + uAudioIntensity * 1.5);
      vec3 finalColor = baseColor + glow * vec3(0.8, 0.8, 1.0); // Brilho azulado/branco

      // Efeito de fresnel para bordas brilhantes
      float fresnel = dot(normal, vec3(0.0, 0.0, 1.0)); // Olhando para a câmera
      fresnel = pow(1.0 - abs(fresnel), 3.0);
      finalColor += fresnel * vec3(0.5, 0.7, 1.0) * (0.5 + uAudioIntensity * 0.5); // Brilho nas bordas

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  const resize = useCallback(() => {
    if (rendererRef.current && cameraRef.current) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      rendererRef.current.setSize(width, height);
      cameraRef.current.perspective({ aspect: width / height });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false });
    if (!gl) {
      console.error("WebGL not supported.");
      return;
    }
    glRef.current = gl;

    const renderer = new Renderer({ gl, alpha: false });
    rendererRef.current = renderer;

    const camera = new Camera({ fov: 45 });
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const scene = new Transform();
    sceneRef.current = scene;

    const geometry = new Geometry(gl, {
      position: { size: 3, data: new Float32Array(THREE.SphereGeometry.prototype.attributes.position.array) },
      normal: { size: 3, data: new Float32Array(THREE.SphereGeometry.prototype.attributes.normal.array) },
      uv: { size: 2, data: new Float32Array(THREE.SphereGeometry.prototype.attributes.uv.array) },
      index: { size: 1, data: new Uint16Array(THREE.SphereGeometry.prototype.index.array) },
    });

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uAudioIntensity: { value: 0 },
      },
    });
    programRef.current = program;

    const mesh = new Mesh(gl, { geometry, program });
    mesh.setParent(scene);
    meshRef.current = mesh;

    resize();
    window.addEventListener('resize', resize);

    let lastTime = 0;
    const animate = (time: DOMHighResTimeStamp) => {
      const deltaTime = (time - lastTime) * 0.001; // Convert to seconds
      lastTime = time;

      if (meshRef.current && programRef.current && cameraRef.current && sceneRef.current) {
        meshRef.current.rotation.y += 0.05 * deltaTime;
        meshRef.current.rotation.x += 0.02 * deltaTime;

        programRef.current.uniforms.uTime.value += deltaTime;
        
        // Suaviza a intensidade do áudio para uma transição mais orgânica
        smoothedAudioIntensity.current = THREE.MathUtils.lerp(
          smoothedAudioIntensity.current,
          audioIntensity,
          0.1 // Fator de suavização
        );
        programRef.current.uniforms.uAudioIntensity.value = smoothedAudioIntensity.current;

        renderer.render({ scene: sceneRef.current, camera: cameraRef.current });
      }
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      // Limpeza de recursos OGL, se necessário (ogl geralmente gerencia isso com o contexto WebGL)
      // Para meshes e programas, eles são ligados ao contexto GL.
      // Quando o contexto é perdido ou o componente desmontado, o GC do JS e do navegador cuidam.
    };
  }, [resize]);

  // Atualiza a intensidade do áudio no loop de renderização
  useEffect(() => {
    // A atualização do uniform é feita no loop de animação,
    // mas este useEffect garante que o valor mais recente de audioIntensity
    // seja acessível pelo loop através do ref.
  }, [audioIntensity]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};