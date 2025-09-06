"use client";

import React from 'react';
import './AssistantUI.css';

interface AudioVisualizerBarsProps {
  audioIntensity: number;
}

const BAR_COUNT = 16;

export const AudioVisualizerBars: React.FC<AudioVisualizerBarsProps> = ({ audioIntensity }) => {
  const heights = React.useMemo(() => {
    const h = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const randomFactor = Math.sin(i * 0.5 + Date.now() * 0.01) * 0.5 + 0.5;
      h.push(Math.max(4, audioIntensity * 40 * randomFactor));
    }
    return h;
  }, [audioIntensity]);

  return (
    <div className="flex items-center justify-center h-10">
      {heights.map((height, i) => (
        <div
          key={i}
          className="visualizer-bar"
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
};