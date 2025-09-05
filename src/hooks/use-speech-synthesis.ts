"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three'; // For lerp
import { showError } from '@/utils/toast';

const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";

interface SpeechSynthesisSettings {
  voice_model: string;
  openai_api_key: string | null;
  openai_tts_voice: string | null;
}

export const useSpeechSynthesis = (
  settings: SpeechSynthesisSettings | null,
  onSpeechEndCallback: () => void,
  stopListening: () => void,
  startListening: () => void,
  isAssistantOpen: boolean,
  stopPermanentlyRef: React.MutableRefObject<boolean>
) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [aiResponseText, setAiResponseText] = useState('');

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smoothedAudioIntensity = useRef(0);

  // Initialize AudioContext once
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    synthRef.current = window.speechSynthesis;
  }, []);

  const stopSpeakingInternal = useCallback(() => {
    if (synthRef.current?.speaking) synthRef.current.cancel();
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioIntensity(0);
    if (isSpeaking) { // Only update state if it was actually speaking
      setIsSpeaking(false);
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
  }, [isSpeaking]);

  const setupAudioAnalysis = useCallback(() => {
    if (!audioContextRef.current) return;
    if (audioRef.current && !sourceRef.current) {
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContextRef.current.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioContextRef.current.destination);
      analyserRef.current = analyser;
      sourceRef.current = source;
    }
  }, []);

  const runAudioAnalysis = useCallback(() => {
    if (analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const normalized = Math.min(average / 128, 1.0);
      
      smoothedAudioIntensity.current = THREE.MathUtils.lerp(
        smoothedAudioIntensity.current,
        normalized,
        0.1 // Smoothing factor
      );
      setAudioIntensity(smoothedAudioIntensity.current);
      animationFrameRef.current = requestAnimationFrame(runAudioAnalysis);
    }
  }, []);

  const speak = useCallback(async (text: string, onDone?: () => void) => {
    console.log("[useSpeechSynthesis] speak function called with text:", text);
    if (!text || !settings) {
      onDone?.();
      return;
    }

    // Handle audio context suspended state (browser autoplay policy)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      setAiResponseText("O áudio está bloqueado. Clique na tela para ativar o som e eu repetirei a mensagem.");
      const unlockAndRetry = async () => {
        await audioContextRef.current!.resume();
        window.removeEventListener('click', unlockAndRetry);
        window.removeEventListener('touchstart', unlockAndRetry);
        speak(text, onDone); // Retry speaking after context is resumed
      };
      window.addEventListener('click', unlockAndRetry, { once: true });
      window.addEventListener('touchstart', unlockAndRetry, { once: true });
      return;
    }

    const handleSpeechEnd = () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }

      if (isSpeaking) { // Only update state if it was actually speaking
        setIsSpeaking(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setAudioIntensity(0);
      } else {
        console.warn("[useSpeechSynthesis] handleSpeechEnd called but not in speaking state. UI state already reset.");
      }
      
      onDone?.(); // Call the specific callback for this speech instance
      onSpeechEndCallback(); // Call the global callback for the assistant
    };

    setIsSpeaking(true);
    stopListening(); // Stop recognition while speaking
    stopSpeakingInternal(); // Clear any previous speech and timeout
    setAiResponseText(text);

    // Set a fallback timeout to ensure handleSpeechEnd is called even if native events fail
    const estimatedSpeechTime = (text.length / 15) * 1000 + 3000; // ~15 chars/sec + 3s buffer
    speechTimeoutRef.current = setTimeout(handleSpeechEnd, estimatedSpeechTime);

    try {
      if (settings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = handleSpeechEnd;
        utterance.onerror = (e) => {
          console.error("SpeechSynthesis Error:", e);
          handleSpeechEnd();
        };
        synthRef.current.speak(utterance);
      } else if (settings.voice_model === "openai-tts" && settings.openai_api_key) {
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.openai_api_key}` },
          body: JSON.stringify({ model: "tts-1", voice: settings.openai_tts_voice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error("Falha na API OpenAI TTS");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        setupAudioAnalysis();
        audioRef.current.onended = () => { handleSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.onerror = () => { handleSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
        runAudioAnalysis();
      } else {
        console.warn("[useSpeechSynthesis] No valid voice model or OpenAI API key for speech. Falling back to onEndCallback.");
        handleSpeechEnd(); // If no speech, just call onEndCallback immediately
      }
    } catch (e: any) {
      showError(`Erro na síntese de voz: ${e.message}`);
      handleSpeechEnd(); // Ensure callback is called even on error
    }
  }, [settings, onSpeechEndCallback, stopListening, stopSpeakingInternal, setupAudioAnalysis, runAudioAnalysis, isSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeakingInternal();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => console.error("Error closing AudioContext:", e));
      }
    };
  }, [stopSpeakingInternal]);

  return {
    isSpeaking,
    audioIntensity,
    aiResponseText,
    speak,
    stopSpeaking: stopSpeakingInternal, // Expose internal stop function
  };
};