"use client";

import React, { useRef } from 'react';
import { Engine, Scene, useBeforeRender } from '@babylonjs/react';
import { Vector3, Color4, ArcRotateCamera, HemisphericLight, Box } from '@babylonjs/core';

const RotatingBox = () => {
  const boxRef = useRef<Box>(null);

  // useBeforeRender é o equivalente do useFrame no react-three/fiber
  useBeforeRender((scene) => {
    if (boxRef.current) {
      const deltaTime = scene.getEngine().getDeltaTime() / 1000;
      boxRef.current.rotation.y += deltaTime;
    }
  });

  return (
    <box
      name="test-box"
      ref={boxRef}
      size={1}
      position={new Vector3(0, 0, 0)}
    />
  );
};

const BabylonTestScene = () => {
  return (
    <div className="absolute inset-0 z-0">
      <Engine antialias adaptToDeviceRatio canvasId="babylon-canvas">
        <Scene onSceneReady={(scene) => {
          // Define a cor de fundo da cena
          scene.clearColor = new Color4(0.05, 0.05, 0.1, 1);
        }}>
          <arcRotateCamera
            name="camera1"
            target={Vector3.Zero()}
            alpha={Math.PI / 2}
            beta={Math.PI / 2}
            radius={5}
          />
          <hemisphericLight
            name="light1"
            intensity={0.7}
            direction={Vector3.Up()}
          />
          <RotatingBox />
        </Scene>
      </Engine>
    </div>
  );
};

export default BabylonTestScene;