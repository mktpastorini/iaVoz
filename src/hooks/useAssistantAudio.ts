"use client";

import { useEffect, useRef, useState, RefObject } from 'react';

interface UseAssistantAudioProps {
  audioElementRef: RefObject<HTMLAudioElement>;
  smoothing?: number;
}

export function useAssistantAudio({ audioElementRef, smoothing = 0.9 }: UseAssistantAudioProps) {
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const rafRef = useRef<number>();
  const audioStuffRef = useRef<{
    audioCtx: AudioContext,
    analyser: AnalyserNode,
    source: MediaElementAudioSourceNode
  } | null>(null);

  useEffect(() => {
    if (!audioElementRef.current) return;

    const audioEl = audioElementRef.current;

    const setupAudio = () => {
      // Prevent re-initialization
      if (audioStuffRef.current) return;

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.error("Web Audio API is not supported in this browser.");
        return;
      }

      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      audioStuffRef.current = { audioCtx, analyser, source };

      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;

      const update = () => {
        if (!audioStuffRef.current) return;
        audioStuffRef.current.analyser.getByteFrequencyData(data);
        
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 255;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        
        const smooth = smoothing * last + (1 - smoothing) * rms;
        last = smooth;
        
        setAudioIntensity(smooth);
        setIsSpeaking(smooth > 0.02); // Threshold to determine if speaking
        
        rafRef.current = requestAnimationFrame(update);
      };
      
      rafRef.current = requestAnimationFrame(update);
    };

    // AudioContext must be resumed by a user gesture
    const resumeAudioContext = () => {
      if (audioStuffRef.current && audioStuffRef.current.audioCtx.state === 'suspended') {
        audioStuffRef.current.audioCtx.resume();
      }
      // Setup audio graph on first play
      setupAudio();
    };
    
    audioEl.addEventListener('play', resumeAudioContext, { once: true });

    return () => {
      audioEl.removeEventListener('play', resumeAudioContext);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      // Full cleanup on component unmount
      if (audioStuffRef.current) {
        audioStuffRef.current.source.disconnect();
        audioStuffRef.current.analyser.disconnect();
        audioStuffRef.current.audioCtx.close().catch(e => console.error("Error closing AudioContext:", e));
        audioStuffRef.current = null;
      }
    };
  }, [audioElementRef, smoothing]);

  return { audioIntensity, isSpeaking };
}