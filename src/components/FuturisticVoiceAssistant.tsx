"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

interface VoiceAssistantProps {
  settings: any | null;
  isLoading: boolean;
}

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
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
  const synthRef = useRef<SpeechSynthesis | null>(null);
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
      console.log("Reconhecimento de voz iniciado.");
    };

    recognition.onend = () => {
      if (isMounted.current) setIsListening(false);
      console.log("Reconhecimento de voz finalizado.");
      if (isOpen) {
        recognition.start();
      }
    };

    recognition.onerror = (event) => {
      console.error("Erro no reconhecimento de voz:", event.error);
      if (isMounted.current) setIsListening(false);
    };

    recognition.onresult = (event) => {
      if (!isMounted.current) return;
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript.trim();
      console.log("Texto reconhecido:", text);
      setTranscript(text);
      handleUserInput(text);
    };

    recognitionRef.current = recognition;

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      isMounted.current = false;
      recognition.stop();
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      if (synthRef.current?.speaking) {
        synthRef.current.cancel();
      }
    };
  }, [isOpen]);

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

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const speak = (text: string) => {
    if (!synthRef.current) return;
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  };

  const handleUserInput = async (input: string) => {
    if (!settings?.openai_api_key) {
      speak("Chave API OpenAI não configurada.");
      return;
    }

    // Atualizar histórico de mensagens
    const newHistory = [...messageHistory, { role: "user", content: input }];
    setMessageHistory(newHistory);
    setAiResponse("Pensando...");

    try {
      const messagesForApi = [
        { role: "system", content: settings.system_prompt || "" },
        ...newHistory,
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

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error?.message || "Erro na API OpenAI");
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || "Desculpe, não entendi.";

      setMessageHistory([...newHistory, { role: "assistant", content: assistantMessage }]);
      setAiResponse(assistantMessage);
      speak(assistantMessage);
    } catch (error: any) {
      console.error("Erro na conversa:", error);
      speak("Desculpe, ocorreu um erro ao processar sua solicitação.");
    }
  };

  const toggleAssistant = () => {
    if (isOpen) {
      setIsOpen(false);
      stopListening();
      setTranscript("");
      setAiResponse("");
      setMessageHistory([]);
    } else {
      setIsOpen(true);
      speak(settings?.welcome_message || "Assistente ativado.");
      startListening();
    }
  };

  if (isLoading) return null;

  return (
    <>
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