"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { showError } from '@/utils/toast';

export const useSpeechRecognition = ({ onTranscript }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    if (isListeningRef.current || !recognitionRef.current) {
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Error starting recognition:", e);
    }
  }, []);

  const initialize = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado.");
      return false;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";

    recognitionRef.current.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
    };

    recognitionRef.current.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      onTranscript(transcript);
    };
    
    return true;
  }, [onTranscript]);

  return {
    isListening,
    startListening,
    stopListening,
    initialize,
    recognitionRef, // For external control if needed
  };
};