"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import P5AssistantScene from "./assistant-scene/P5AssistantScene";
import AssistantUI from "./AssistantUI";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";

interface VoiceAssistantProps {
  settings: any | null;
  isLoading: boolean;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

const FuturisticVoiceAssistant: React.FC<VoiceAssistantProps> = ({ settings, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isMounted = useRef(true);
  const { activationTrigger } = useVoiceAssistant();
  const hasBeenOpened = useRef(false);

  useEffect(() => {
    if (activationTrigger > 0) {
      handleOpen();
    }
  }, [activationTrigger]);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onDone?.();
    };
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Erro ao iniciar reconhecimento:", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const handleUserInput = useCallback(async (input: string) => {
    if (!settings?.openai_api_key) {
      speak("A chave da API da OpenAI não está configurada.");
      return;
    }

    const newHistory: Message[] = [...messageHistory, { role: "user", content: input }];
    setMessageHistory(newHistory);
    setAiResponse(""); // Limpa a resposta anterior

    try {
      const messagesForApi = [
        { role: "system", content: settings.system_prompt || "Você é um assistente prestativo." },
        ...newHistory.slice(-settings.conversation_memory_length || -5),
      ];

      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.openai_api_key}`,
        },
        body: JSON.stringify({
          model: settings.ai_model || "gpt-4o-mini",
          messages: messagesForApi,
        }),
      });

      if (!response.ok) throw new Error("Erro na API da OpenAI.");

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || "Não consegui processar sua solicitação.";
      
      setAiResponse(assistantMessage);
      setMessageHistory(prev => [...prev, { role: "assistant", content: assistantMessage }]);
      speak(assistantMessage, startListening);
    } catch (error) {
      console.error("Erro na conversa:", error);
      speak("Desculpe, ocorreu um erro.");
    }
  }, [messageHistory, settings, speak, startListening]);

  useEffect(() => {
    isMounted.current = true;
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "pt-BR";

    recognition.onstart = () => isMounted.current && setIsListening(true);
    recognition.onend = () => isMounted.current && setIsListening(false);
    recognition.onerror = (e) => console.error("Speech recognition error", e);
    recognition.onresult = (event) => {
      if (!isMounted.current) return;
      const text = event.results[0][0].transcript.trim();
      setTranscript(text);
      handleUserInput(text);
    };
    recognitionRef.current = recognition;

    return () => { isMounted.current = false; recognition.stop(); };
  }, [handleUserInput]);

  const handleOpen = () => {
    if (isOpen) return;
    setIsOpen(true);
    const welcomeMsg = hasBeenOpened.current ? settings?.continuation_phrase : settings?.welcome_message;
    speak(welcomeMsg || "Olá!", startListening);
    hasBeenOpened.current = true;
  };

  const handleClose = () => {
    setIsOpen(false);
    stopListening();
    if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
    setTranscript("");
    setAiResponse("");
  };

  const toggleMic = () => {
    if (isListening) stopListening();
    else startListening();
  };

  if (isLoading || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <P5AssistantScene isSpeaking={isSpeaking} isListening={isListening} />
      <AssistantUI
        isListening={isListening}
        isSpeaking={isSpeaking}
        transcript={transcript}
        aiResponse={aiResponse}
        onToggleMic={toggleMic}
      />
    </div>
  );
};

export default FuturisticVoiceAssistant;