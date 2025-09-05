"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { showError } from '@/utils/toast';

interface SpeechRecognitionCallbacks {
  onCommand: (command: string) => void;
  onActivationPhrase: (phrase: string) => void;
  onPermissionDenied: () => void;
  onSpeechEnd: () => void; // Callback from speech synthesis
  isSpeaking: boolean;
  isAssistantOpen: boolean;
  activationPhrase: string;
  clientActions: any[]; // Simplified type for now
  executeClientAction: (action: any) => void;
}

export const useSpeechRecognition = ({
  onCommand,
  onActivationPhrase,
  onPermissionDenied,
  onSpeechEnd,
  isSpeaking,
  isAssistantOpen,
  activationPhrase,
  clientActions,
  executeClientAction,
}: SpeechRecognitionCallbacks) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stopPermanentlyRef = useRef(false); // To signal permanent stop on unmount

  // Refs for stable access to props/callbacks within recognition events
  const isSpeakingRef = useRef(isSpeaking);
  const isAssistantOpenRef = useRef(isAssistantOpen);
  const activationPhraseRef = useRef(activationPhrase);
  const clientActionsRef = useRef(clientActions);
  const executeClientActionRef = useRef(executeClientAction);
  const onCommandRef = useRef(onCommand);
  const onActivationPhraseRef = useRef(onPermissionDenied); // This seems like a typo, should be onActivationPhrase
  const onPermissionDeniedRef = useRef(onPermissionDenied);

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isAssistantOpenRef.current = isAssistantOpen; }, [isAssistantOpen]);
  useEffect(() => { activationPhraseRef.current = activationPhrase; }, [activationPhrase]);
  useEffect(() => { clientActionsRef.current = clientActions; }, [clientActions]);
  useEffect(() => { executeClientActionRef.current = executeClientAction; }, [executeClientAction]);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { onActivationPhraseRef.current = onActivationPhrase; }, [onActivationPhrase]);
  useEffect(() => { onPermissionDeniedRef.current = onPermissionDenied; }, [onPermissionDenied]);


  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current && !isSpeakingRef.current && !stopPermanentlyRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("[useSpeechRecognition] Error starting recognition:", e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // --- NEW: Dedicated useEffect for SpeechRecognition setup ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado neste navegador.");
      onPermissionDeniedRef.current(); // Signal that permission is denied due to unsupported API
      stopPermanentlyRef.current = true;
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "pt-BR";

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      console.log("[useSpeechRecognition] SpeechRecognition started.");
    };

    recognition.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      console.log("[useSpeechRecognition] SpeechRecognition ended.");
      // Add a small delay before restarting to avoid race conditions
      // Only restart if not speaking and not permanently stopped, and assistant is open
      if (!isSpeakingRef.current && !stopPermanentlyRef.current && isAssistantOpenRef.current) {
        setTimeout(() => {
          if (!isSpeakingRef.current && !stopPermanentlyRef.current && isAssistantOpenRef.current) {
            startListening();
          }
        }, 100); // Small delay
      }
    };

    recognition.onerror = (e) => {
      console.error("[useSpeechRecognition] SpeechRecognition Error:", e);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        onPermissionDeniedRef.current();
      }
      setIsListening(false); // Ensure listening state is reset on error
      isListeningRef.current = false;
    };

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      if (!transcript) { // Ignore empty transcripts
        console.warn("[useSpeechRecognition] Empty transcript received, ignoring.");
        return;
      }
      const closePhrases = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];
      if (isAssistantOpenRef.current) {
        if (closePhrases.some((phrase) => transcript.includes(phrase))) {
          onCommand("close_assistant"); // Special command to close
          return;
        }
        const matchedAction = clientActionsRef.current.find((a: any) => transcript.includes(a.trigger_phrase.toLowerCase()));
        if (matchedAction) {
          executeClientActionRef.current(matchedAction);
          return;
        }
        onCommandRef.current(transcript);
      } else {
        if (activationPhraseRef.current && transcript.includes(activationPhraseRef.current.toLowerCase())) {
          onActivationPhraseRef.current(transcript);
        }
      }
    };
    recognitionRef.current = recognition;

    return () => {
      console.log("[useSpeechRecognition] Cleaning up SpeechRecognition.");
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
    };
  }, [startListening]); // Only startListening is a dependency here, as other callbacks are accessed via refs

  // Effect to restart listening when speech ends (triggered by onSpeechEnd from useSpeechSynthesis)
  useEffect(() => {
    if (!isSpeaking && isAssistantOpen && !stopPermanentlyRef.current) {
      startListening();
    }
  }, [isSpeaking, isAssistantOpen, startListening, onSpeechEnd]);


  return {
    isListening,
    startListening,
    stopListening,
  };
};