"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import Test3DScene from "./Test3DScene";

interface VoiceAssistantProps {
  settings: any | null;
  isLoading: boolean;
}

const FuturisticVoiceAssistant: React.FC<VoiceAssistantProps> = ({ settings, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Reconhecimento de voz não suportado neste navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "pt-BR";

    recognition.onstart = () => {
      if (isMounted.current) setIsListening(true);
    };

    recognition.onend = () => {
      if (isMounted.current) setIsListening(false);
      if (isOpen) {
        recognition.start();
      }
    };

    recognition.onerror = () => {
      if (isMounted.current) setIsListening(false);
    };

    recognition.onresult = (event) => {
      if (!isMounted.current) return;
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.trim();
      setTranscript(text);
      // Aqui você pode chamar a função para processar o texto
    };

    recognitionRef.current = recognition;

    return () => {
      isMounted.current = false;
      recognition.stop();
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
    };
  }, [isOpen]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch {}
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const toggleAssistant = () => {
    if (isOpen) {
      setIsOpen(false);
      stopListening();
      setTranscript("");
      setAiResponse("");
    } else {
      setIsOpen(true);
      startListening();
    }
  };

  if (isLoading) return null;

  return (
    <>
      <Test3DScene />
      {isOpen && (
        <div className="fixed bottom-24 right-4 z-50 p-4 bg-cyan-700 text-white rounded-lg shadow-lg max-w-xs w-full">
          <p className="mb-2 font-semibold">Assistente de Voz</p>
          <p className="mb-1 italic text-cyan-200">Você disse: {transcript || "..."}</p>
          <p className="mb-2">{aiResponse || "..."}</p>
          <Button onClick={toggleListening} className="w-full mb-2">
            {isListening ? <MicOff /> : <Mic />} {isListening ? "Parar de ouvir" : "Ouvir"}
          </Button>
          <Button variant="outline" onClick={toggleAssistant} className="w-full">
            Fechar Assistente
          </Button>
        </div>
      )}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button onClick={toggleAssistant} size="lg" className="rounded-full w-16 h-16 shadow-lg bg-cyan-500 hover:bg-cyan-600 text-white">
            <Mic size={32} />
          </Button>
        </div>
      )}
    </>
  );
};

export default FuturisticVoiceAssistant;