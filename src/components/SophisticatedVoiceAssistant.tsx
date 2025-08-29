"use client";

import React, { useState, useEffect, useRef } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useSystem } from "@/contexts/SystemContext";
import { replacePlaceholders } from "@/lib/utils";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";

// ... (interfaces Message, Power, VoiceAssistantProps remain the same)
interface VoiceAssistantProps {
  welcomeMessage?: string;
  openAiApiKey: string;
  systemPrompt?: string;
  assistantPrompt?: string;
  model?: string;
  conversationMemoryLength: number;
  voiceModel: "browser" | "openai-tts" | "gemini-tts";
  openaiTtsVoice?: string;
  activationPhrase: string;
}

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
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


const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

const SophisticatedVoiceAssistant: React.FC<VoiceAssistantProps> = ({
  welcomeMessage = "Bem-vindo ao site! Diga 'ativar' para começar a conversar.",
  openAiApiKey,
  systemPrompt = "Você é Intra, a IA da Intratégica. Empresa de automações, desenvolvimento de IAs e sistemas.",
  assistantPrompt = "Você é um assistente amigável e profissional que ajuda agências de tecnologia a automatizar processos e criar soluções de IA personalizadas.",
  model = "gpt-4o-mini",
  conversationMemoryLength,
  voiceModel,
  openaiTtsVoice = "alloy",
  activationPhrase,
}) => {
  const { workspace } = useSession();
  const { systemVariables } = useSystem();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [powers, setPowers] = useState<Power[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isRecognitionActive = useRef(false);
  const isSpeakingRef = useRef(false);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  useEffect(() => {
    if (workspace?.id) {
      const fetchPowers = async () => {
        const { data, error } = await supabase.from('powers').select('*').eq('workspace_id', workspace.id);
        if (error) showError("Erro ao carregar os poderes da IA.");
        else setPowers(data || []);
      };
      fetchPowers();
    }
  }, [workspace]);

  const startListening = () => {
    if (recognitionRef.current && !isRecognitionActive.current && !isSpeakingRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("[VA] Erro ao iniciar reconhecimento:", error);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isRecognitionActive.current) {
      recognitionRef.current.stop();
    }
  };

  const stopSpeaking = () => {
    if (synthRef.current?.speaking) synthRef.current.cancel();
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  };

  const closeAssistant = () => {
    stopListening();
    stopSpeaking();
    setIsOpen(false);
    setAiResponse("");
    setTranscript("");
  };

  const speak = async (text: string, onEndCallback?: () => void) => {
    if (!text) {
      onEndCallback?.();
      return;
    }
    stopSpeaking();
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setAiResponse(text);

    const onSpeechEnd = () => {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      onEndCallback?.();
    };

    if (voiceModel === "browser" && synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.onend = onSpeechEnd;
      synthRef.current.speak(utterance);
    } else if (voiceModel === "openai-tts" && openAiApiKey) {
      try {
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiApiKey}` },
          body: JSON.stringify({ model: "tts-1", voice: openaiTtsVoice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error("Falha na API OpenAI TTS");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.play();
      } catch (error) {
        console.error(error);
        onSpeechEnd();
      }
    } else {
      onEndCallback();
    }
  };

  const runConversation = async (userInput: string) => {
    if (!openAiApiKey) {
      speak("Chave API OpenAI não configurada.", startListening);
      return;
    }
    setTranscript(userInput);
    setAiResponse("Pensando...");
    const newHistory = [...messageHistory, { role: "user" as const, content: userInput }];
    setMessageHistory(newHistory);

    const tools = powers.map(p => ({ type: 'function' as const, function: { name: p.name, description: p.description, parameters: p.parameters_schema } }));
    const messagesForApi = [{ role: "system" as const, content: systemPrompt }, { role: "assistant" as const, content: assistantPrompt }, ...newHistory.slice(-conversationMemoryLength)];

    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiApiKey}` },
        body: JSON.stringify({ model, messages: messagesForApi, tools: tools.length > 0 ? tools : undefined, tool_choice: tools.length > 0 ? 'auto' : undefined }),
      });
      if (!response.ok) throw new Error("Erro na API OpenAI");
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
          let url = replacePlaceholders(power.url || '', { ...systemVariables, ...args });
          let body = power.body ? JSON.parse(replacePlaceholders(JSON.stringify(power.body), { ...systemVariables, ...args })) : undefined;

          const { data: toolResult, error } = await supabase.functions.invoke('proxy-api', { body: { url, method: power.method, headers: power.headers, body } });
          return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: error ? JSON.stringify({ error: error.message }) : JSON.stringify(toolResult) };
        }));

        const historyWithToolResults = [...historyWithToolCall, ...toolOutputs];
        setMessageHistory(historyWithToolResults);
        const secondResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiApiKey}` },
          body: JSON.stringify({ model, messages: historyWithToolResults }),
        });
        if (!secondResponse.ok) throw new Error("Erro na 2ª chamada OpenAI");
        const secondData = await secondResponse.json();
        const finalMessage = secondData.choices?.[0]?.message?.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: finalMessage }]);
        speak(finalMessage, startListening);
      } else {
        const assistantMessage = responseMessage.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
        speak(assistantMessage, startListening);
      }
    } catch (error) {
      console.error(error);
      speak("Desculpe, ocorreu um erro.", startListening);
    }
  };

  useEffect(() => {
    if (!isInitialized) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado.");
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false; // MUDANÇA CHAVE: Desativa o modo contínuo
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";

    recognitionRef.current.onstart = () => { isRecognitionActive.current = true; setIsListening(true); };
    recognitionRef.current.onend = () => { 
      isRecognitionActive.current = false; 
      setIsListening(false); 
      // Reinicia a escuta explicitamente se o assistente estiver aberto e não falando
      if (isOpen && !isSpeakingRef.current) {
        startListening();
      }
    };
    recognitionRef.current.onerror = (e) => { console.error(`Erro de reconhecimento: ${e.error}`); if (e.error !== 'no-speech') showError(`Erro de voz: ${e.error}`); };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      const closePhrase = "fechar";

      if (isOpen) {
        if (transcript.includes(closePhrase)) {
          closeAssistant();
        } else {
          // Não precisa mais parar a escuta aqui, pois o modo não contínuo fará isso
          runConversation(transcript);
        }
      } else {
        if (transcript.includes(activationPhrase.toLowerCase())) {
          setIsOpen(true);
          speak(welcomeMessage, startListening);
        } else {
          // Se não for a palavra de ativação, reinicia a escuta
          startListening();
        }
      }
    };

    if ("speechSynthesis" in window) synthRef.current = window.speechSynthesis;
    else showError("Síntese de voz não suportada.");

    startListening();

    return () => { stopListening(); stopSpeaking(); };
  }, [isInitialized, isOpen, activationPhrase, welcomeMessage, powers, systemVariables]);

  const handleInit = () => {
    setIsInitialized(true);
    showSuccess("Assistente ativado! Diga a palavra de ativação.");
  };

  if (!isInitialized) {
    return (
      <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
        <Button onClick={handleInit} size="lg" className="rounded-full w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 shadow-lg transform hover:scale-110 transition-transform duration-200 flex items-center justify-center">
          <Mic size={32} />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex flex-col items-center justify-center p-4 md:p-8 transition-all duration-500",
      isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
    )}>
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={closeAssistant}></div>
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-center">
        <div className="flex-grow flex items-center justify-center">
          <p className="text-white text-3xl md:text-5xl font-bold leading-tight drop-shadow-lg">
            {displayedAiResponse}
          </p>
        </div>
        <AudioVisualizer isSpeaking={isSpeaking} />
        <div className="h-16">
          <p className="text-gray-400 text-lg md:text-xl">{transcript}</p>
        </div>
      </div>
    </div>
  );
};

export default SophisticatedVoiceAssistant;