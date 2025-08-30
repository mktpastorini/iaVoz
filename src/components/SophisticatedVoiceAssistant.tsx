"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useSystem } from "@/contexts/SystemContext";
import { replacePlaceholders } from "@/lib/utils";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, X } from "lucide-react";
import { IframeModal } from "@/components/IframeModal";

// Interfaces
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

// Constants
const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

// Modal Component
const ImageModal = ({ imageUrl, altText, onClose }: { imageUrl: string; altText?: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70" onClick={onClose}>
    <div className="relative max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
      <img src={imageUrl} alt={altText || 'Imagem exibida pelo assistente'} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 rounded-full" onClick={onClose}><X /></Button>
    </div>
  </div>
);

// Main Component
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
  const [clientActions, setClientActions] = useState<ClientAction[]>([]);
  const [imageToShow, setImageToShow] = useState<ClientAction['action_payload'] | null>(null);
  const [iframeToShow, setIframeToShow] = useState<{ url: string } | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isRecognitionActive = useRef(false); // Controla se recognition.start() foi chamado

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Refs para acessar o estado mais recente dentro dos callbacks do SpeechRecognition
  const isOpenRef = useRef(isOpen);
  const isSpeakingRef = useRef(isSpeaking);
  const imageToShowRef = useRef(imageToShow);
  const iframeToShowRef = useRef(iframeToShow);
  const clientActionsRef = useRef(clientActions);
  const activationPhraseRef = useRef(activationPhrase);
  const welcomeMessageRef = useRef(welcomeMessage);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { imageToShowRef.current = imageToShow; }, [imageToShow]);
  useEffect(() => { iframeToShowRef.current = iframeToShow; }, [iframeToShow]);
  useEffect(() => { clientActionsRef.current = clientActions; }, [clientActions]);
  useEffect(() => { activationPhraseRef.current = activationPhrase; }, [activationPhrase]);
  useEffect(() => { welcomeMessageRef.current = welcomeMessage; }, [welcomeMessage]);


  useEffect(() => {
    if (workspace?.id) {
      const fetchPowers = async () => {
        const { data, error } = await supabase.from('powers').select('*').eq('workspace_id', workspace.id);
        if (error) showError("Erro ao carregar os poderes da IA.");
        else setPowers(data || []);
      };
      const fetchClientActions = async () => {
        const { data, error } = await supabase.from('client_actions').select('*').eq('workspace_id', workspace.id);
        if (error) showError("Erro ao carregar ações do cliente.");
        else setClientActions(data || []);
      };
      fetchPowers();
      fetchClientActions();
    }
  }, [workspace]);

  // Funções de controle de escuta e fala
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isRecognitionActive.current) {
      try {
        recognitionRef.current.start();
        console.log("[VA] Recognition started.");
      } catch (error) {
        console.error("[VA] Erro ao iniciar reconhecimento:", error);
        if (error instanceof DOMException && error.name === "InvalidStateError") {
          console.warn("[VA] Recognition already active or in invalid state, not restarting.");
        } else if (error instanceof DOMException && error.name === "NotAllowedError") {
          showError("Permissão de microfone negada ou bloqueada.");
        }
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isRecognitionActive.current) {
      try {
        recognitionRef.current.stop();
        console.log("[VA] Recognition stopped.");
      } catch (error) {
        console.error("[VA] Erro ao parar reconhecimento:", error);
      }
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) synthRef.current.cancel();
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  }, []);

  const closeAssistant = useCallback(() => {
    stopListening();
    stopSpeaking();
    setIsOpen(false);
    setAiResponse("");
    setTranscript("");
    setImageToShow(null);
    setIframeToShow(null);
  }, [stopListening, stopSpeaking]);

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    if (!text) {
      onEndCallback?.();
      return;
    }
    stopSpeaking();
    setIsSpeaking(true);
    setAiResponse(text);

    const handleSpeechEnd = () => {
      setIsSpeaking(false);
      onEndCallback?.();
    };

    try {
      if (voiceModel === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = handleSpeechEnd;
        synthRef.current.speak(utterance);
      } else if (voiceModel === "openai-tts" && openAiApiKey) {
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiApiKey}` },
          body: JSON.stringify({ model: "tts-1", voice: openaiTtsVoice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error("Falha na API OpenAI TTS");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => { handleSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.play();
      } else {
        handleSpeechEnd();
      }
    } catch (error) {
      console.error("Erro durante a fala:", error);
      showError("Erro ao gerar áudio da resposta.");
      handleSpeechEnd();
    }
  }, [voiceModel, openAiApiKey, openaiTtsVoice, stopSpeaking]);

  const executeClientAction = useCallback((action: ClientAction) => {
    switch (action.action_type) {
      case 'OPEN_URL':
        if (action.action_payload.url) {
          speak(`Abrindo ${action.action_payload.url}`, () => {
            window.open(action.action_payload.url, '_blank');
          });
        }
        break;
      case 'SHOW_IMAGE':
        if (action.action_payload.imageUrl) {
          speak("Claro, aqui está a imagem.", () => {
            setImageToShow(action.action_payload);
          });
        }
        break;
      case 'OPEN_IFRAME_URL':
        if (action.action_payload.url) {
          speak(`Abrindo ${action.action_payload.url} em um overlay.`, () => {
            setIframeToShow({ url: action.action_payload.url! });
          });
        }
        break;
    }
  }, [speak]);

  const runConversation = useCallback(async (userInput: string) => {
    if (!openAiApiKey) {
      speak("Chave API OpenAI não configurada.");
      return;
    }
    stopListening();
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
        speak(finalMessage);
      } else {
        const assistantMessage = responseMessage.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
        speak(assistantMessage);
      }
    } catch (error) {
      console.error(error);
      speak("Desculpe, ocorreu um erro.");
    }
  }, [openAiApiKey, stopListening, messageHistory, powers, systemVariables, systemPrompt, assistantPrompt, conversationMemoryLength, model, speak]);

  // Efeito principal para configurar o reconhecimento de voz (roda apenas uma vez na inicialização)
  useEffect(() => {
    if (!isInitialized) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "pt-BR";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isRecognitionActive.current = true;
      setIsListening(true);
      console.log("[VA] onstart: Listening active.");
    };

    recognition.onerror = (e) => {
      console.error(`[VA] onerror: Erro de reconhecimento: ${e.error}`);
      isRecognitionActive.current = false;
      setIsListening(false);
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        showError(`Erro de voz: ${e.error}`);
      }
      // Tenta reiniciar a escuta após um erro, se as condições permitirem
      if (isOpenRef.current && !isSpeakingRef.current && !imageToShowRef.current && !iframeToShowRef.current) {
        setTimeout(() => startListening(), 500);
      }
    };

    recognition.onend = () => {
      isRecognitionActive.current = false;
      setIsListening(false);
      console.log("[VA] onend: Listening inactive.");
      // Lógica de reinício autossuficiente: se as condições forem atendidas, reinicia a escuta
      if (isOpenRef.current && !isSpeakingRef.current && !imageToShowRef.current && !iframeToShowRef.current) {
        setTimeout(() => startListening(), 100); // Pequeno atraso para evitar erros de reinício rápido
      }
    };

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      console.log("[VA] onresult: Transcript:", transcript);

      // Parar a escuta imediatamente após um resultado para processá-lo
      stopListening(); // Isso irá disparar o onend

      const closePhrase = "fechar";

      if (isOpenRef.current) { // Usar ref para o estado mais recente
        if (transcript.includes(closePhrase)) {
          closeAssistant();
          return;
        }
        const matchedAction = clientActionsRef.current.find(a => transcript.includes(a.trigger_phrase));
        if (matchedAction) {
          executeClientAction(matchedAction);
          return;
        }
        runConversation(transcript);
      } else {
        if (transcript.includes(activationPhraseRef.current.toLowerCase())) {
          setIsOpen(true);
          speak(welcomeMessageRef.current); // speak irá definir isSpeaking, onend irá reiniciar a escuta
        }
        // Se não for a frase de ativação, o onend já cuidará de reiniciar a escuta se necessário
      }
    };

    // Garante que a síntese de voz esteja disponível
    if (!synthRef.current && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    } else if (!("speechSynthesis" in window)) {
      showError("Síntese de voz não suportada.");
    }

    // Função de limpeza para este useEffect
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.stop(); // Garante que seja parado ao desmontar/mudar dependências
        recognitionRef.current = null; // Limpa a referência
      }
      if (synthRef.current) {
        synthRef.current.cancel();
        synthRef.current = null;
      }
    };
  }, [isInitialized, startListening, stopListening, closeAssistant, speak, executeClientAction, runConversation]); // Dependências para reconfigurar apenas quando necessário

  // Efeito separado para controlar o estado de escuta com base nas mudanças de estado
  useEffect(() => {
    if (!isInitialized) return;

    const shouldBeListening = isOpen && !isSpeaking && !imageToShow && !iframeToShow;

    if (shouldBeListening && !isRecognitionActive.current) {
      startListening();
    } else if (!shouldBeListening && isRecognitionActive.current) {
      stopListening();
    }
  }, [isOpen, isSpeaking, imageToShow, iframeToShow, isInitialized, startListening, stopListening]);


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
    <>
      {imageToShow && (
        <ImageModal
          imageUrl={imageToShow.imageUrl!}
          altText={imageToShow.altText}
          onClose={() => setImageToShow(null)}
        />
      )}
      {iframeToShow && (
        <IframeModal
          url={iframeToShow.url}
          onClose={() => setIframeToShow(null)}
        />
      )}
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
    </>
  );
};

export default SophisticatedVoiceAssistant;