"use client";

import React from "react";
import Sketch from "react-p5";
import p5Types from "p5";

interface P5AssistantSceneProps {
  isSpeaking: boolean;
  isListening: boolean;
}

class Particle {
  p5: p5Types;
  pos: p5Types.Vector;
  vel: p5Types.Vector;
  acc: p5Types.Vector;
  maxSpeed: number;
  color: p5Types.Color;
  history: p5Types.Vector[];

  constructor(p5: p5Types, x: number, y: number, z: number) {
    this.p5 = p5;
    this.pos = p5.createVector(x, y, z);
    this.vel = p5.createVector();
    this.acc = p5.createVector();
    this.maxSpeed = 4;
    this.color = p5.color(150, 220, 255, 150);
    this.history = [];
  }

  update(isSpeaking: boolean) {
    const noiseFactor = isSpeaking ? 0.02 : 0.005;
    const noiseStrength = isSpeaking ? 0.5 : 0.1;

    const angle = this.p5.noise(this.pos.x * noiseFactor, this.pos.y * noiseFactor) * this.p5.TWO_PI * 4;
    const noiseVec = p5Types.Vector.fromAngle(angle);
    noiseVec.mult(noiseStrength);
    this.acc.add(noiseVec);

    // Add a force pulling back to the center
    const center = this.p5.createVector(0, 0, 0);
    const returnForce = p5Types.Vector.sub(center, this.pos);
    returnForce.mult(0.001);
    this.acc.add(returnForce);

    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0); // Reset acceleration

    this.history.push(this.pos.copy());
    if (this.history.length > 25) {
      this.history.splice(0, 1);
    }
  }

  show() {
    this.p5.noFill();
    this.p5.stroke(this.color);
    this.p5.strokeWeight(1.5);
    this.p5.point(this.pos.x, this.pos.y, this.pos.z);
  }
}

const P5AssistantScene: React.FC<P5AssistantSceneProps> = ({ isSpeaking }) => {
  let particles: Particle[] = [];
  let stars: { x: number; y: number; z: number }[] = [];

  const setup = (p5: p5Types, canvasParentRef: Element) => {
    p5.createCanvas(p5.windowWidth, p5.windowHeight, p5.WEBGL).parent(canvasParentRef);
    
    // Create orb particles
    const particleCount = 500;
    const radius = p5.min(p5.width, p5.height) * 0.2;
    for (let i = 0; i < particleCount; i++) {
      const phi = p5.acos(-1 + (2 * i) / particleCount);
      const theta = p5.sqrt(particleCount * p5.PI) * phi;
      const x = radius * p5.cos(theta) * p5.sin(phi);
      const y = radius * p5.sin(theta) * p5.sin(phi);
      const z = radius * p5.cos(phi);
      particles.push(new Particle(p5, x, y, z));
    }

    // Create starfield
    const starCount = 1000;
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: p5.random(-p5.width * 2, p5.width * 2),
        y: p5.random(-p5.height * 2, p5.height * 2),
        z: p5.random(-1000, 1000),
      });
    }
  };

  const draw = (p5: p5Types) => {
    p5.background(5, 5, 15);
    p5.orbitControl(1, 1, 0); // Allows mouse rotation for debugging

    // Draw stars
    p5.stroke(255);
    p5.strokeWeight(2);
    for (const star of stars) {
      p5.point(star.x, star.y, star.z);
    }

    // Update and draw particles
    for (const p of particles) {
      p.update(isSpeaking);
      p.show();
    }
  };

  const windowResized = (p5: p5Types) => {
    p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
  };

  return (
    <div className="absolute inset-0 z-0">
      <Sketch setup={setup} draw={draw} windowResized={windowResized} />
    </div>
  );
};

export default P5AssistantScene;