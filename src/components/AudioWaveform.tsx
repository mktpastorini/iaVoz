"use client";

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const AudioWaveform = () => {
  const [bars, setBars] = useState<number[]>([]);

  useEffect(() => {
    const generateBars = () => {
      const newBars = Array.from({ length: 30 }, () => Math.random());
      setBars(newBars);
    };
    generateBars();
  }, []);

  return (
    <div className="w-48 h-24 bg-black/10 backdrop-blur-sm border border-white/10 rounded-lg flex items-end justify-center gap-px p-2">
      {bars.map((height, index) => (
        <div
          key={index}
          className="w-1 bg-white/50 rounded-full"
          style={{ height: `${height * 80 + 5}%` }}
        />
      ))}
    </div>
  );
};

export default AudioWaveform;