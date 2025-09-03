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
import { UrlIframeModal } from "./UrlIframeModal";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";

// Interfaces
interface Settings {
  welcome_message?: string;
  openai_api_key: string;
  system_prompt?: string;
  assistant_prompt?: string;
  ai_model?: string;
  conversation_memory_length: number;
  voice_model: "browser" | "openai-tts" | "gemini-tts";
  openai_tts_voice?: string;
  activation_phrase: string;
  continuation_phrase?: string;
}

interface VoiceAssistantProps {
  settings: Settings | null;
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
  settings,
  isLoading,
}) => {
  const { session } = useSession();
  const { systemVariables } = useSystem();
  const { activationTrigger } = useVoiceAssistant();

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [powers, setPowers] = useState<Power[]>([]);
  const [clientActions, setClientActions] = useState<ClientAction[]>([]);
  const [imageToShow, setImageToShow] = useState<ClientAction['action_payload'] | null>(null);
  const [urlToOpenInIframe, setUrlToOpenInIframe] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [hasBeenActivated, setHasBeenActivated] = useState(false);

  // Refs para estados e props dinâmicos
  const settingsRef = useRef(settings);
  const isOpenRef = useRef(isOpen);
  const isListeningRef = useRef(isListening);
  const isSpeakingRef = useRef(isSpeaking);
  const hasBeenActivatedRef = useRef(hasBeenActivated);
  const powersRef = useRef(powers);
  const clientActionsRef = useRef(clientActions);
  const systemVariablesRef = useRef(systemVariables);
  const sessionRef = useRef(session);
  const messageHistoryRef = useRef(messageHistory);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const activationRequestedViaButton = useRef(false);
  const isTransitioningToSpeakRef = useRef(false);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Efeitos para sincronizar refs com estados/props
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { hasBeenActivatedRef.current = hasBeenActivated; }, [hasBeenActivated]);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { clientActionsRef.current = clientActions; }, [clientActions]);
  useEffect(() => { systemVariablesRef.current = systemVariables; }, [systemVariables]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { messageHistoryRef.current = messageHistory; }, [messageHistory]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      console.log('[VA] Parando a escuta...');
      recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    if (isListeningRef.current || isSpeakingRef.current || stopPermanentlyRef.current || !recognitionRef.current) {
      console.log(`[VA] Ignorando startListening. Status: isListening=${isListeningRef.current}, isSpeaking=${isSpeakingRef.current}`);
      return;
    }
    try {
      console.log('[VA] Tentando iniciar a escuta...');
      recognitionRef.current.start();
    } catch (error) {
      console.error("[VA] Erro ao tentar iniciar reconhecimento (pode ser normal se já estiver parando):", error);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    // Para a síntese de voz do navegador
    if (synthRef.current?.speaking) {
      console.log('[VA] Parando a síntese de voz do navegador.');
      synthRef.current.cancel();
    }
    // Para o áudio do OpenAI TTS
    if (audioRef.current) {
      console.log('[VA] Limpando recurso de áudio anterior.');
      if (!audioRef.current.paused) {
        audioRef.current.pause();
      }
      // **A CORREÇÃO CRÍTICA ESTÁ AQUI**
      // Remove os event listeners para evitar que o áudio "fantasma" dispare ações
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      // Libera o recurso de áudio do navegador
      audioRef.current.src = ''; 
      audioRef.current = null;
    }
    // Garante que o estado de "falando" seja desativado
    if (isSpeakingRef.current) {
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }
    
    const onSpeechEnd = () => {
      console.log('[VA] Finalizou a fala.');
      isTransitioningToSpeakRef.current = false;
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      onEndCallback?.();
      if (isOpenRef.current) {
        console.log('[VA] Assistente aberto após fala, reiniciando escuta.');
        startListening();
      }
    };

    console.log(`[VA] Preparando para falar: "${text}"`);
    isTransitioningToSpeakRef.current = true;
    stopListening();
    stopSpeaking();
    
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setAiResponse(text);

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (e) => { console.error('[VA] Erro na síntese de voz do navegador:', e); onSpeechEnd(); };
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: "tts-1", voice: currentSettings.openai_tts_voice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error("Falha na API OpenAI TTS");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.onerror = (e) => { console.error('[VA] Erro ao tocar áudio TTS:', e); onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
      } else {
        onSpeechEnd();
      }
    } catch (error) {
      console.error("[VA] Erro durante a fala:", error);
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening]);

  const runConversation = useCallback(async (userInput: string) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings || !currentSettings.openai_api_key) {
      speak("Chave API OpenAI não configurada.");
      return;
    }
    console.log(`[VA] Executando conversa com entrada: "${userInput}"`);
    stopListening();
    setTranscript(userInput);
    setAiResponse("Pensando...");
    
    const currentHistory = messageHistoryRef.current;
    const historyForApi = [
      ...currentHistory,
      { role: "user" as const, content: userInput }
    ];
    setMessageHistory(historyForApi);

    const tools = powersRef.current.map(p => ({
      type: 'function' as const,
      function: {
        name: p.name,
        description: p.description,
        parameters: p.parameters_schema || { type: "object", properties: {} }
      }
    }));
    
    const messagesForApi = [
      { role: "system" as const, content: currentSettings.system_prompt },
      { role: "assistant" as const, content: currentSettings.assistant_prompt },
      ...historyForApi.slice(-currentSettings.conversation_memory_length) 
    ];

    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
        body: JSON.stringify({ model: currentSettings.ai_model, messages: messagesForApi, tools: tools.length > 0 ? tools : undefined, tool_choice: tools.length > 0 ? 'auto' : undefined }),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Erro na API OpenAI: ${errorBody.error?.message || response.statusText}`);
      }
      const data = await response.json();
      const responseMessage = data.choices?.[0]?.message;

      if (responseMessage.tool_calls) {
        setAiResponse("Executando ação...");
        const historyWithToolCall = [...historyForApi, responseMessage];
        setMessageHistory(historyWithToolCall);

        const toolOutputs = await Promise.all(responseMessage.tool_calls.map(async (toolCall: any) => {
          const power = powersRef.current.find(p => p.name === toolCall.function.name);
          if (!power) return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: 'Poder não encontrado.' };
          
          const args = JSON.parse(toolCall.function.arguments);
          const isInternalFunction = power.url?.includes('supabase.co/functions/v1/');
          const functionName = isInternalFunction ? power.url.split('/functions/v1/')[1] : null;
          let toolResult, invokeError;

          if (isInternalFunction && functionName) {
            const headers: Record<string, string> = sessionRef.current?.access_token ? { Authorization: `Bearer ${sessionRef.current.access_token}` } : {};
            const { data, error } = await supabase.functions.invoke(functionName, { body: args, headers });
            invokeError = error;
            toolResult = data;
          } else {
            const processedUrl = replacePlaceholders(power.url || '', { ...systemVariablesRef.current, ...args });
            const processedHeaders = power.headers ? JSON.parse(replacePlaceholders(JSON.stringify(power.headers), { ...systemVariablesRef.current, ...args })) : {};
            const processedBody = (power.body && ["POST", "PUT", "PATCH"].includes(power.method)) ? JSON.parse(replacePlaceholders(JSON.stringify(power.body), { ...systemVariablesRef.current, ...args })) : undefined;
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
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: currentSettings.ai_model, messages: historyWithToolResults }),
        });
        if (!secondResponse.ok) {
          const errorBody = await secondResponse.json();
          throw new Error(`Erro na 2ª chamada OpenAI: ${errorBody.error?.message || secondResponse.statusText}`);
        }
        const secondData = await secondResponse.json();
        const finalMessage = secondData.choices?.[0]?.message?.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: finalMessage }]);
        speak(finalMessage);
      } else {
        const assistantMessage = responseMessage.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
        speak(assistantMessage);
      }
    } catch (error: any) {
      console.error('[VA] Erro no fluxo da conversa:', error);
      showError(error.message || "Desculpe, ocorreu um erro.");
      speak("Desculpe, ocorreu um erro.");
    }
  }, [speak, stopListening]);

  const executeClientAction = useCallback((action: ClientAction) => {
    stopListening();
    switch (action.action_type) {
      case 'OPEN_URL':
        if (action.action_payload.url) speak(`Abrindo ${action.action_payload.url}`, () => window.open(action.action_payload.url, '_blank'));
        break;
      case 'OPEN_IFRAME_URL':
        if (action.action_payload.url) speak("Ok, abrindo conteúdo.", () => setUrlToOpenInIframe(action.action_payload.url!));
        break;
      case 'SHOW_IMAGE':
        if (action.action_payload.imageUrl) speak("Claro, aqui está a imagem.", () => setImageToShow(action.action_payload));
        break;
    }
  }, [speak, stopListening]);

  const initializeAssistant = useCallback(() => {
    console.log('[VA] Inicializando assistente...');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado.");
      setMicPermission('denied');
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";

    recognitionRef.current.onstart = () => {
      console.log('[VA] Evento: onstart - Reconhecimento de voz iniciado.');
      setIsListening(true);
    };
    
    recognitionRef.current.onend = () => {
      console.log('[VA] Evento: onend - Reconhecimento de voz finalizado.');
      setIsListening(false);
      if (isTransitioningToSpeakRef.current) {
        console.log('[VA] onend: Ignorando reinício, transição para fala em progresso.');
        return;
      }
      if (!stopPermanentlyRef.current) {
        console.log('[VA] onend: Reiniciando escuta...');
        startListening();
      }
    };
    
    recognitionRef.current.onerror = (e) => {
      console.log(`[VA] Evento: onerror - Erro no reconhecimento: ${e.error}`);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicPermission('denied');
        showError("Permissão para microfone negada.");
      }
    };
    
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      console.log(`[VA] Transcrição ouvida: "${transcript}"`);
      const closePhrases = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];

      if (isOpenRef.current) {
        if (closePhrases.some(phrase => transcript.includes(phrase))) {
          setIsOpen(false);
          setAiResponse("");
          setTranscript("");
          stopSpeaking();
          return;
        }
        const matchedAction = clientActionsRef.current.find(a => transcript.includes(a.trigger_phrase.toLowerCase()));
        if (matchedAction) {
          executeClientAction(matchedAction);
          return;
        }
        runConversation(transcript);
      } else {
        if (settingsRef.current && transcript.includes(settingsRef.current.activation_phrase.toLowerCase())) {
          setIsOpen(true);
          const messageToSpeak = hasBeenActivatedRef.current && settingsRef.current.continuation_phrase
            ? settingsRef.current.continuation_phrase
            : settingsRef.current.welcome_message;
          speak(messageToSpeak);
          setHasBeenActivated(true);
        }
      }
    };

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, [speak, startListening, stopSpeaking, runConversation, executeClientAction]);

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setMicPermission(permissionStatus.state);

      if (permissionStatus.state === 'granted') {
        if (!recognitionRef.current) initializeAssistant();
        startListening();
      } else if (permissionStatus.state === 'prompt') {
        setIsPermissionModalOpen(true);
      }
      permissionStatus.onchange = () => checkAndRequestMicPermission();
    } catch (error) {
      console.error("[VA] Erro ao verificar permissão do microfone:", error);
      setMicPermission('denied');
    }
  }, [initializeAssistant, startListening]);

  const handleAllowMic = async () => {
    setIsPermissionModalOpen(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activationRequestedViaButton.current) {
        activationRequestedViaButton.current = false;
        handleManualActivation();
      }
    } catch (error) {
      setMicPermission('denied');
      showError("Você precisa permitir o uso do microfone para continuar.");
    }
  };

  const handleManualActivation = useCallback(() => {
    if (isOpenRef.current) return;
    if (micPermission !== 'granted') {
      activationRequestedViaButton.current = true;
      checkAndRequestMicPermission();
    } else {
      setIsOpen(true);
      const messageToSpeak = hasBeenActivatedRef.current && settingsRef.current?.continuation_phrase
        ? settingsRef.current.continuation_phrase
        : settingsRef.current?.welcome_message;
      speak(messageToSpeak);
      setHasBeenActivated(true);
    }
  }, [micPermission, checkAndRequestMicPermission, speak]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    if (isLoading) return;
    checkAndRequestMicPermission();
    return () => {
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, [isLoading, checkAndRequestMicPermission]);

  useEffect(() => {
    const fetchPowersAndActions = async () => {
      const { data: powersData, error: powersError } = await supabase.from('powers').select('*');
      if (powersError) showError("Erro ao carregar os poderes da IA.");
      else setPowers(powersData || []);

      const { data: actionsData, error: actionsError } = await supabase.from('client_actions').select('*');
      if (actionsError) showError("Erro ao carregar ações do cliente.");
      else setClientActions(actionsData || []);
    };
    fetchPowersAndActions();
  }, []);

  if (isLoading || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal isOpen={isPermissionModalOpen} onAllow={handleAllowMic} onClose={() => setIsPermissionModalOpen(false)} />
      {micPermission === 'denied' && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
          <Button onClick={checkAndRequestMicPermission} size="lg" className="rounded-full w-16 h-16 shadow-lg"><Mic size={32} /></Button>
        </div>
      )}
      {imageToShow && <ImageModal imageUrl={imageToShow.imageUrl!} altText={imageToShow.altText} onClose={() => { setImageToShow(null); startListening(); }} />}
      {urlToOpenInIframe && <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); startListening(); }} />}
      <div className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center p-4 transition-all duration-500", isOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-center">
          <div className="flex-grow flex items-center justify-center">
            <p className="text-white text-3xl md:text-5xl font-bold leading-tight drop-shadow-lg">{displayedAiResponse}</p>
          </div>
          <AudioVisualizer isSpeaking={isSpeaking} />
          <div className="h-16"><p className="text-gray-400 text-lg md:text-xl">{transcript}</p></div>
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;