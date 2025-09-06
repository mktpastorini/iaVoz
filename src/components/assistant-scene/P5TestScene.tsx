"use client";

import React from "react";
import Sketch from "react-p5";
import p5Types from "p5";

const P5TestScene = () => {
  const setup = (p5: p5Types, canvasParentRef: Element) => {
    p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef);
  };

  const draw = (p5: p5Types) => {
    p5.background(5, 5, 15);
    p5.noFill();
    p5.stroke(0, 255, 255);
    p5.strokeWeight(2);

    // Animate the circle based on time
    const diameter = 100 + Math.sin(p5.frameCount * 0.05) * 50;
    p5.ellipse(p5.width / 2, p5.height / 2, diameter, diameter);
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

export default P5TestScene;