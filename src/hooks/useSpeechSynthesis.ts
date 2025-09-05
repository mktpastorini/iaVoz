"use client";

import { useState, useRef, useCallback } from 'react';
import { showError } from '@/utils/toast';

const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";

export const useSpeechSynthesis = (settings) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);

  const synthRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);
  const speechTimeoutRef = useRef(null);
  const isSpeakingRef = useRef(false);

  const stopSpeaking = useCallback(() => {
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
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
  }, []);

  const setupAudioAnalysis = useCallback(() => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
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
      setAudioIntensity(normalized);
      animationFrameRef.current = requestAnimationFrame(runAudioAnalysis);
    }
  }, []);

  const speak = useCallback(async (text, onEndCallback) => {
    if (!text || !settings) {
      onEndCallback?.();
      return;
    }

    const onSpeechEnd = () => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setAudioIntensity(0);
        onEndCallback?.();
      }
    };

    stopSpeaking();
    isSpeakingRef.current = true;
    setIsSpeaking(true);

    speechTimeoutRef.current = setTimeout(onSpeechEnd, (text.length / 15) * 1000 + 3000);

    try {
      if (settings.voice_model === "browser" && "speechSynthesis" in window) {
        synthRef.current = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (e) => { console.error("SpeechSynthesis Error:", e); onSpeechEnd(); };
        synthRef.current.speak(utterance);
      } else if (settings.voice_model === "openai-tts" && settings.openai_api_key) {
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.openai_api_key}` },
          body: JSON.stringify({ model: "tts-1", voice: settings.openai_tts_voice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error("OpenAI TTS API request failed");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        setupAudioAnalysis();
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.onerror = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
        runAudioAnalysis();
      } else {
        onSpeechEnd();
      }
    } catch (e) {
      showError(`Speech synthesis error: ${e.message}`);
      onSpeechEnd();
    }
  }, [settings, stopSpeaking, setupAudioAnalysis, runAudioAnalysis]);

  return { speak, isSpeaking, audioIntensity, stopSpeaking };
};