"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { replacePlaceholders } from "@/lib/utils";
import FuturisticVoiceAssistantScene from "./FuturisticVoiceAssistantScene";
import { useAssistantAudio } from "@/hooks/useAssistantAudio";

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

interface Power {
  id: string;
  name: string;
  description: string | null;
  method: string;
  url: string | null;
  headers: Record<string, string> | null;
  body: Record<string, any> | null;
  api_key_id: string | null;
  parameters_schema: Record<string, any> | null;
}

interface ClientAction {
  id: string;
  trigger_phrase: string;
  action_type: 'OPEN_URL' | 'SHOW_IMAGE' | 'OPEN_IFRAME_URL';
  action_payload: {
    url?: string;
    imageUrl?: string;
    altText?: string;
  };
}

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

const FuturisticVoiceAssistant: React.FC<VoiceAssistantProps> = ({ settings, isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [powers, setPowers] = useState<Power[]>([]);
  const [clientActions, setClientActions] = useState<ClientAction[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<HTMLAudioElement | null>(null);
  const isMounted = useRef(true);

  // Usar hook para captar intensidade do áudio sintetizado
  const { audioIntensity, isSpeaking: isSpeakingAudio } = useAssistantAudio({ audioElementRef: synthRef });

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
      // Criar elemento de áudio oculto para conectar ao hook de áudio
      const audioEl = document.createElement("audio");
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
      synthRef.current = audioEl;
    }

    return () => {
      isMounted.current = false;
      recognition.stop();
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      if (synthRef.current) {
        synthRef.current.pause();
        synthRef.current.src = "";
        document.body.removeChild(synthRef.current);
        synthRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    // Carregar poderes e ações do cliente para gatilhos
    const fetchPowersAndActions = async () => {
      const { data: powersData, error: powersError } = await supabase.from('powers').select('*');
      if (powersError) {
        showError("Erro ao carregar poderes da IA.");
      } else {
        setPowers(powersData || []);
      }

      const { data: actionsData, error: actionsError } = await supabase.from('client_actions').select('*');
      if (actionsError) {
        showError("Erro ao carregar ações do cliente.");
      } else {
        setClientActions(actionsData || []);
      }
    };
    fetchPowersAndActions();
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

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleUserInput = async (input: string) => {
    if (!settings?.openai_api_key) {
      speak("Chave API OpenAI não configurada.");
      return;
    }

    // Verificar se input corresponde a alguma ação do cliente
    const matchedAction = clientActions.find(action =>
      input.toLowerCase().includes(action.trigger_phrase.toLowerCase())
    );

    if (matchedAction) {
      executeClientAction(matchedAction);
      return;
    }

    // Atualizar histórico de mensagens
    const newHistory = [...messageHistory, { role: "user", content: input }];
    setMessageHistory(newHistory);
    setAiResponse("Pensando...");

    const tools = powers.map(p => ({
      type: 'function' as const,
      function: {
        name: p.name,
        description: p.description,
        parameters: p.parameters_schema || { type: "object", properties: {} }
      }
    }));

    const messagesForApi = [
      { role: "system" as const, content: settings.system_prompt || "" },
      { role: "assistant" as const, content: settings.assistant_prompt || "" },
      ...newHistory.slice(-settings.conversation_memory_length)
    ];

    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.openai_api_key}`,
        },
        body: JSON.stringify({
          model: settings.ai_model || "gpt-4o-mini",
          messages: messagesForApi,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.error?.message || "Erro na API OpenAI");
      }

      const data = await response.json();
      const responseMessage = data.choices?.[0]?.message;

      if (responseMessage.tool_calls) {
        setAiResponse("Executando ação...");
        const historyWithToolCall = [...newHistory, responseMessage];
        setMessageHistory(historyWithToolCall);

        const toolOutputs = await Promise.all(responseMessage.tool_calls.map(async (toolCall: any) => {
          const power = powers.find(p => p.name === toolCall.function.name);
          if (!power) return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: 'Poder não encontrado.' };

          const args = JSON.parse(toolCall.function.arguments);
          const isInternalFunction = power.url?.includes('supabase.co/functions/v1/');
          const functionName = isInternalFunction ? power.url.split('/functions/v1/')[1] : null;
          let toolResult, invokeError;

          if (isInternalFunction && functionName) {
            const headers: Record<string, string> = {};
            const { data, error } = await supabase.functions.invoke(functionName, { body: args, headers });
            invokeError = error;
            toolResult = data;
          } else {
            const processedUrl = replacePlaceholders(power.url || '', args);
            const processedHeaders = power.headers ? JSON.parse(replacePlaceholders(JSON.stringify(power.headers), args)) : {};
            const processedBody = (power.body && ["POST", "PUT", "PATCH"].includes(power.method)) ? JSON.parse(replacePlaceholders(JSON.stringify(power.body), args)) : undefined;
            const payload = { url: processedUrl, method: power.method, headers: processedHeaders, body: processedBody };
            const { data, error } = await supabase.functions.invoke('proxy-api', { body: payload });
            toolResult = data;
            invokeError = error;
          }

          if (invokeError) return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: JSON.stringify({ error: invokeError.message }) };
          return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: JSON.stringify(toolResult) };
        }));

        const historyWithToolResults = [...historyWithToolCall, ...toolOutputs];
        setMessageHistory(historyWithToolResults);

        const secondResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.openai_api_key}`,
          },
          body: JSON.stringify({
            model: settings.ai_model || "gpt-4o-mini",
            messages: historyWithToolResults,
          }),
        });

        if (!secondResponse.ok) {
          const errorBody = await secondResponse.json();
          throw new Error(errorBody.error?.message || "Erro na segunda chamada OpenAI");
        }

        const secondData = await secondResponse.json();
        const finalMessage = secondData.choices?.[0]?.message?.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: finalMessage }]);
        setAiResponse(finalMessage);
        speak(finalMessage);
      } else {
        const assistantMessage = responseMessage.content;
        setMessageHistory(prev => [...prev, { role: "assistant", content: assistantMessage }]);
        setAiResponse(assistantMessage);
        speak(assistantMessage);
      }
    } catch (error: any) {
      console.error("Erro na conversa:", error);
      showError(error.message || "Erro ao processar a conversa.");
      speak("Desculpe, ocorreu um erro ao processar sua solicitação.");
    }
  };

  const executeClientAction = (action: ClientAction) => {
    stopListening();
    switch (action.action_type) {
      case 'OPEN_URL':
        if (action.action_payload.url) {
          speak(`Abrindo ${action.action_payload.url}`, () => window.open(action.action_payload.url, '_blank'));
        }
        break;
      case 'OPEN_IFRAME_URL':
        speak("Abrindo conteúdo em overlay, funcionalidade ainda não implementada.");
        break;
      case 'SHOW_IMAGE':
        speak("Mostrando imagem, funcionalidade ainda não implementada.");
        break;
      default:
        speak("Ação desconhecida.");
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

  // Detectar qualidade para ajustar partículas (mobile ou desktop)
  const quality = window.innerWidth >= 768 ? 'desktop' : 'mobile';

  return (
    <>
      <FuturisticVoiceAssistantScene audioIntensity={audioIntensity} isSpeaking={isSpeakingAudio} quality={quality} />
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