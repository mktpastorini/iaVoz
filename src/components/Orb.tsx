"use client";

import React, { useRef, useEffect } from 'react';
import { OrbAnimator } from '@/lib/OrbAnimator';

interface OrbProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
}

const Orb: React.FC<OrbProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animatorRef = useRef<OrbAnimator | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      animatorRef.current = new OrbAnimator(canvasRef.current);
      animatorRef.current.start();
    }

    return () => {
      animatorRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const animator = animatorRef.current;
    if (!animator) return;

    switch (state) {
      case 'listening':
        animator.setListeningState();
        break;
      case 'processing':
        animator.setProcessingState();
        break;
      case 'speaking':
        animator.setSpeakingState();
        break;
      case 'idle':
      default:
        animator.setIdleState();
        break;
    }
  }, [state]);

  return <canvas ref={canvasRef} id="ai-orb-canvas"></canvas>;
};

export default Orb;