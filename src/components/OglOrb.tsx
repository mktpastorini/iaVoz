"use client";

import React, { useEffect, useRef } from 'react';
// @ts-ignore
import { Renderer, Camera, Transform, Program, Mesh, Sphere } from 'ogl';

const vertexShader = `
  attribute vec3 position;
  attribute vec3 normal;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;

  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uAudioIntensity;

  varying vec3 vNormal;

  // Simplex 2D noise
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec3 normal = normalize(vNormal);
    float intensity = dot(normal, vec3(0.0, 0.0, 1.0));
    
    float noise = snoise(normal.xy * 4.0 + uTime * 0.5) * 0.5 + 0.5;
    float audioEffect = uAudioIntensity * (snoise(normal.xy * 8.0 - uTime) * 0.5 + 0.5);

    vec3 color1 = vec3(0.1, 0.2, 0.8); // Deep Blue
    vec3 color2 = vec3(0.5, 0.2, 1.0); // Purple
    vec3 color3 = vec3(0.2, 0.8, 1.0); // Cyan

    vec3 baseColor = mix(color1, color2, smoothstep(0.0, 0.8, intensity));
    baseColor = mix(baseColor, color3, noise * 0.5);
    baseColor += color3 * audioEffect * 2.0;

    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

interface OglOrbProps {
  audioIntensity: number;
}

export const OglOrb: React.FC<OglOrbProps> = ({ audioIntensity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const programRef = useRef<any>();
  const smoothedAudioIntensity = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new Renderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const camera = new Camera(gl, { fov: 35 });
    camera.position.set(0, 0, 4);

    const resize = () => {
      if (!canvasRef.current?.parentElement) return;
      const { clientWidth, clientHeight } = canvasRef.current.parentElement;
      renderer.setSize(clientWidth, clientHeight);
      camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
    };
    window.addEventListener('resize', resize, false);
    resize();

    const scene = new Transform();
    const geometry = new Sphere(gl, { radius: 1, widthSegments: 128, heightSegments: 128 });

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

    let animationFrameId: number;
    const update = (t: number) => {
      animationFrameId = requestAnimationFrame(update);
      program.uniforms.uTime.value = t * 0.0002;
      mesh.rotation.y += 0.002;
      renderer.render({ scene, camera });
    };
    animationFrameId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (programRef.current) {
      // Smooth the audio intensity value for a nicer visual effect
      smoothedAudioIntensity.current += (audioIntensity - smoothedAudioIntensity.current) * 0.1;
      programRef.current.uniforms.uAudioIntensity.value = smoothedAudioIntensity.current;
    }
  }, [audioIntensity]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />;
};