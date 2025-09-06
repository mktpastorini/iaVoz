"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import P5AssistantScene from "./assistant-scene/P5AssistantScene";
import AssistantUI from "./AssistantUI";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";

interface VoiceAssistantProps {
  settings: any | null;
  isLoading: boolean;
  powers: any[]; // Adicionando powers como prop
}

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

const FuturisticVoiceAssistant: React.FC<VoiceAssistantProps> = ({ settings, isLoading, powers }) => {
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
    if (activationTrigger > 0 && !isOpen) {
      handleOpen();
    }
  }, [activationTrigger, isOpen]);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!text || !window.speechSynthesis) {
      onDone?.();
      return;
    }
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
    utterance.onerror = (e) => {
      console.error("SpeechSynthesis Error:", e);
      setIsSpeaking(false);
      onDone?.();
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !isSpeaking) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Erro ao iniciar reconhecimento:", e);
      }
    }
  }, [isListening, isSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const handleUserInput = useCallback(async (input: string) => {
    if (!input || !settings?.openai_api_key) {
      if (!settings?.openai_api_key) speak("A chave da API da OpenAI não está configurada.");
      return;
    }

    stopListening();
    const newHistory: Message[] = [...messageHistory, { role: "user", content: input }];
    setMessageHistory(newHistory);
    setAiResponse("");

    try {
      const tools = powers.map(power => ({
        type: "function",
        function: { name: power.name, description: power.description, parameters: power.parameters_schema || { type: "object", properties: {} } },
      }));

      const messagesForApi = [
        { role: "system", content: settings.system_prompt || "Você é um assistente prestativo." },
        ...newHistory.slice(-(settings.conversation_memory_length || 5)),
      ];

      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.openai_api_key}` },
        body: JSON.stringify({
          model: settings.ai_model || "gpt-4o-mini",
          messages: messagesForApi,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
        }),
      });

      if (!response.ok) throw new Error("Erro na API da OpenAI.");
      const data = await response.json();
      const aiMessage = data.choices[0].message;

      if (aiMessage.tool_calls) {
        setMessageHistory(prev => [...prev, aiMessage]);
        speak("Ok, um momento enquanto executo a ação.", async () => {
          const toolResponses = await Promise.all(
            aiMessage.tool_calls.map(async (toolCall: any) => {
              const functionName = toolCall.function.name;
              const functionArgs = JSON.parse(toolCall.function.arguments);
              
              try {
                const { data: result, error } = await supabase.functions.invoke(functionName, { body: functionArgs });
                if (error) throw error;
                return {
                  tool_call_id: toolCall.id,
                  role: "tool",
                  name: functionName,
                  content: JSON.stringify(result),
                };
              } catch (e) {
                return {
                  tool_call_id: toolCall.id,
                  role: "tool",
                  name: functionName,
                  content: JSON.stringify({ error: `Falha ao executar a ferramenta ${functionName}: ${e.message}` }),
                };
              }
            })
          );

          const historyWithToolResponses = [...newHistory, aiMessage, ...toolResponses];
          setMessageHistory(historyWithToolResponses);

          const secondResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.openai_api_key}` },
            body: JSON.stringify({
              model: settings.ai_model || "gpt-4o-mini",
              messages: [messagesForApi[0], ...historyWithToolResponses.slice(-settings.conversation_memory_length || -5)],
            }),
          });

          if (!secondResponse.ok) throw new Error("Erro na segunda chamada à API da OpenAI.");
          const secondData = await secondResponse.json();
          const finalMessage = secondData.choices[0].message.content;

          setAiResponse(finalMessage);
          setMessageHistory(prev => [...prev, { role: "assistant", content: finalMessage }]);
          speak(finalMessage, startListening);
        });
      } else {
        const assistantMessageContent = aiMessage.content;
        setAiResponse(assistantMessageContent);
        setMessageHistory(prev => [...prev, { role: "assistant", content: assistantMessageContent }]);
        speak(assistantMessageContent, startListening);
      }
    } catch (error) {
      console.error("Erro na conversa:", error);
      speak("Desculpe, ocorreu um erro ao processar sua solicitação.");
    }
  }, [messageHistory, settings, powers, speak, startListening, stopListening]);

  useEffect(() => {
    isMounted.current = true;
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "pt-BR";

    recognition.onstart = () => isMounted.current && setIsListening(true);
    recognition.onend = () => {
      if (isMounted.current && !isSpeaking) {
        setIsListening(false);
      }
    };
    recognition.onerror = (e) => console.error("Speech recognition error", e);
    recognition.onresult = (event) => {
      if (!isMounted.current) return;
      const text = event.results[0][0].transcript.trim();
      setTranscript(text);
      handleUserInput(text);
    };
    recognitionRef.current = recognition;

    return () => { isMounted.current = false; recognition.stop(); };
  }, [handleUserInput, isSpeaking]);

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
    setMessageHistory([]);
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