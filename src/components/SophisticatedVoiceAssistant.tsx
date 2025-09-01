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
import { Mic, X, PlusSquare } from "lucide-react";
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
  content: string | null;
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
  const { workspace } = useSession();
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
  const [conversationId, setConversationId] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  const stateRef = useRef({
    isOpen, isListening, isSpeaking, hasBeenActivated, powers, clientActions, messageHistory, systemVariables, conversationId
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const activationRequestedViaButton = useRef(false);
  const audioContextUnlocked = useRef(false);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    stateRef.current = { isOpen, isListening, isSpeaking, hasBeenActivated, powers, clientActions, messageHistory, systemVariables, conversationId };
  }, [isOpen, isListening, isSpeaking, hasBeenActivated, powers, clientActions, messageHistory, systemVariables, conversationId]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !stateRef.current.isListening && !stateRef.current.isSpeaking) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
          console.error("[VA] Erro ao iniciar reconhecimento:", error);
        }
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && stateRef.current.isListening) {
      recognitionRef.current.stop();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) {
      synthRef.current.cancel();
    }
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }

    stopSpeaking();
    setIsSpeaking(true);
    stopListening();
    setAiResponse(text);

    const onSpeechEnd = () => {
      setIsSpeaking(false);
      onEndCallback?.();
      if (stateRef.current.isOpen) {
        startListening();
      }
    };

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (event) => {
          console.error('[VA] SpeechSynthesisUtterance error:', event);
          onSpeechEnd();
        };
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
        audioRef.current.onerror = () => {
          console.error('[VA] HTMLAudioElement error playing TTS.');
          onSpeechEnd();
          URL.revokeObjectURL(audioUrl);
        };
        await audioRef.current.play();
      } else {
        onSpeechEnd();
      }
    } catch (error) {
      console.error("[VA] Erro durante a fala:", error);
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening]);

  const saveMessage = useCallback(async (message: Message) => {
    if (!stateRef.current.conversationId) {
      console.error("[VA] Tentativa de salvar mensagem sem ID de conversa.");
      return;
    }
    const { error } = await supabase.from('messages').insert({
      conversation_id: stateRef.current.conversationId,
      role: message.role,
      content: message,
    });
    if (error) {
      console.error("[VA] Erro ao salvar mensagem no banco de dados:", error);
      showError("Não foi possível salvar a mensagem.");
    }
  }, []);

  const runConversation = useCallback(async (userInput: string) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings || !currentSettings.openai_api_key) {
      speak("Chave API OpenAI não configurada.");
      return;
    }
    stopListening();
    setTranscript(userInput);
    setAiResponse("Pensando...");
    
    const userMessage: Message = { role: "user", content: userInput };
    const newHistory = [...stateRef.current.messageHistory, userMessage];
    setMessageHistory(newHistory);
    await saveMessage(userMessage);

    const tools = stateRef.current.powers.map(p => ({ type: 'function' as const, function: { name: p.name, description: p.description, parameters: p.parameters_schema } }));
    
    const messagesForApi = [
      { role: "system" as const, content: currentSettings.system_prompt },
      { role: "assistant" as const, content: currentSettings.assistant_prompt },
      ...newHistory.slice(-currentSettings.conversation_memory_length) 
    ].filter(msg => msg.content !== null || msg.tool_calls);

    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
        body: JSON.stringify({ model: currentSettings.ai_model, messages: messagesForApi, tools: tools.length > 0 ? tools : undefined, tool_choice: tools.length > 0 ? 'auto' : undefined }),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Erro da API OpenAI:", errorBody);
        throw new Error("Erro na API OpenAI");
      }
      const data = await response.json();
      const responseMessage = data.choices?.[0]?.message;

      if (responseMessage.tool_calls) {
        setAiResponse("Executando ação...");
        setMessageHistory(prev => [...prev, responseMessage]);
        await saveMessage(responseMessage);

        const toolOutputs = await Promise.all(responseMessage.tool_calls.map(async (toolCall: any) => {
          const power = stateRef.current.powers.find(p => p.name === toolCall.function.name);
          if (!power) return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: 'Poder não encontrado.' };
          
          const args = JSON.parse(toolCall.function.arguments);
          const allVars = { ...stateRef.current.systemVariables, ...args };
          
          let processedUrl = replacePlaceholders(power.url || '', allVars);
          let processedHeaders = power.headers ? JSON.parse(replacePlaceholders(JSON.stringify(power.headers), allVars)) : {};
          let processedBody = (power.body && (power.method === "POST" || power.method === "PUT" || power.method === "PATCH")) 
            ? JSON.parse(replacePlaceholders(JSON.stringify(power.body), allVars)) 
            : args;

          const payload = { url: processedUrl, method: power.method, headers: processedHeaders, body: processedBody };
          const { data, error } = await supabase.functions.invoke('proxy-api', { body: payload });
          
          if (error || (data && !data.ok)) {
            console.error(`[VA] Erro ao invocar poder '${power.name}':`, error || data.data);
            return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: JSON.stringify({ error: (error?.message || data?.data?.error || 'Erro na execução do poder.') }) };
          }
          return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: JSON.stringify(data.data) };
        }));

        for (const output of toolOutputs) { await saveMessage(output); }
        setMessageHistory(prev => [...prev, ...toolOutputs]);
        
        const secondResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: currentSettings.ai_model, messages: [...stateRef.current.messageHistory, ...toolOutputs] }),
        });
        if (!secondResponse.ok) throw new Error("Erro na 2ª chamada OpenAI");
        const secondData = await secondResponse.json();
        const finalMessage = secondData.choices?.[0]?.message;
        setMessageHistory(prev => [...prev, finalMessage]);
        await saveMessage(finalMessage);
        speak(finalMessage.content);
      } else {
        const assistantMessage = responseMessage;
        setMessageHistory(prev => [...prev, assistantMessage]);
        await saveMessage(assistantMessage);
        speak(assistantMessage.content);
      }
    } catch (error) {
      console.error('[VA] Erro no fluxo da conversa:', error);
      speak("Desculpe, ocorreu um erro.");
    }
  }, [speak, stopListening, saveMessage]);

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

  const startOrResumeConversation = useCallback(async () => {
    if (!workspace?.id) return;
    const storedConversationId = localStorage.getItem('conversation_id');

    if (storedConversationId) {
      const { data, error } = await supabase.from('conversations').select('id').eq('id', storedConversationId).eq('workspace_id', workspace.id).single();
      if (data && !error) {
        const { data: messagesData } = await supabase.from('messages').select('content').eq('conversation_id', storedConversationId).order('created_at', { ascending: true });
        if (messagesData) setMessageHistory(messagesData.map(m => m.content));
        setConversationId(storedConversationId);
        showSuccess("Conversa anterior restaurada.");
        return;
      }
    }

    const { data, error } = await supabase.from('conversations').insert({ workspace_id: workspace.id }).select('id').single();
    if (data) {
      setConversationId(data.id);
      localStorage.setItem('conversation_id', data.id);
      setMessageHistory([]);
    } else {
      showError("Não foi possível iniciar uma nova conversa.");
      console.error(error);
    }
  }, [workspace]);

  const handleManualActivation = useCallback(() => {
    unlockAudio();
    if (stateRef.current.isOpen) return;

    const activate = () => {
      setIsOpen(true);
      const messageToSpeak = stateRef.current.hasBeenActivated && settingsRef.current?.continuation_phrase
        ? settingsRef.current.continuation_phrase
        : settingsRef.current?.welcome_message;
      speak(messageToSpeak);
      setHasBeenActivated(true);
    };

    if (micPermission !== 'granted') {
      activationRequestedViaButton.current = true;
      setIsPermissionModalOpen(true);
    } else {
      activate();
    }
  }, [micPermission, speak]);

  useEffect(() => {
    const initialize = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "pt-BR";
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (!stopPermanentlyRef.current) {
          setTimeout(() => startListening(), 100);
        }
      };
      recognitionRef.current.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') console.error(`[VA] Erro no reconhecimento: ${e.error}`);
        setIsListening(false);
      };
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        const closePhrases = ["fechar", "encerrar", "desligar", "cancelar"];
        if (stateRef.current.isOpen) {
          if (closePhrases.some(p => transcript.includes(p))) {
            setIsOpen(false);
            setAiResponse("");
            setTranscript("");
            stopSpeaking();
            stopListening();
            return;
          }
          const action = stateRef.current.clientActions.find(a => transcript.includes(a.trigger_phrase));
          if (action) executeClientAction(action);
          else runConversation(transcript);
        } else if (settingsRef.current && transcript.includes(settingsRef.current.activation_phrase.toLowerCase())) {
          handleManualActivation();
        }
      };
      if ("speechSynthesis" in window) synthRef.current = window.speechSynthesis;
    };

    const checkPermission = async () => {
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicPermission(permission.state);
        if (permission.state === 'granted') {
          initialize();
          startListening();
        }
        permission.onchange = () => {
          if (permission.state === 'granted' && !recognitionRef.current) {
            initialize();
            startListening();
          }
          setMicPermission(permission.state);
        };
      } catch { showError("Não foi possível verificar permissão do microfone."); }
    };

    if (!isLoading) {
      checkPermission();
    }
    return () => {
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, [isLoading, startListening, stopListening, stopSpeaking, runConversation, executeClientAction, handleManualActivation]);

  const handleAllowMic = useCallback(async () => {
    setIsPermissionModalOpen(false);
    unlockAudio();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activationRequestedViaButton.current) {
        activationRequestedViaButton.current = false;
        handleManualActivation();
      }
    } catch { showError("Você precisa permitir o uso do microfone."); }
  }, [handleManualActivation]);

  const handleNewConversation = useCallback(() => {
    localStorage.removeItem('conversation_id');
    setConversationId(null);
    setMessageHistory([]);
    setAiResponse("");
    setTranscript("");
    showSuccess("Iniciando uma nova conversa.");
    startOrResumeConversation();
  }, [startOrResumeConversation]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    if (workspace?.id && !conversationId) startOrResumeConversation();
  }, [workspace, conversationId, startOrResumeConversation]);

  useEffect(() => {
    if (workspace?.id) {
      const fetchPowers = async () => {
        const { data, error } = await supabase.from('powers').select('*').eq('workspace_id', workspace.id);
        if (error) showError("Erro ao carregar poderes."); else setPowers(data || []);
      };
      const fetchClientActions = async () => {
        const { data, error } = await supabase.from('client_actions').select('*').eq('workspace_id', workspace.id);
        if (error) showError("Erro ao carregar ações."); else setClientActions(data || []);
      };
      fetchPowers();
      fetchClientActions();
    }
  }, [workspace]);

  const unlockAudio = () => {
    if (audioContextUnlocked.current) return;
    const sound = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
    sound.play().catch(() => {});
    audioContextUnlocked.current = true;
  };

  if (isLoading || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal isOpen={isPermissionModalOpen} onAllow={handleAllowMic} onClose={() => setIsPermissionModalOpen(false)} />
      {micPermission !== 'granted' && micPermission !== 'checking' && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
          <Button onClick={handleManualActivation} size="lg" className="rounded-full w-16 h-16 md:w-20 md-h-20 bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 shadow-lg transform hover:scale-110 transition-transform duration-200 flex items-center justify-center">
            <Mic size={32} />
          </Button>
        </div>
      )}
      {imageToShow && <ImageModal imageUrl={imageToShow.imageUrl!} altText={imageToShow.altText} onClose={() => { setImageToShow(null); startListening(); }} />}
      {urlToOpenInIframe && <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); startListening(); }} />}
      <div className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center p-4 md:p-8 transition-all duration-500", isOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
        <div className="absolute top-4 right-4 z-20 flex space-x-2">
          <Button variant="outline" size="icon" onClick={handleNewConversation} title="Nova Conversa"><PlusSquare className="h-5 w-5" /></Button>
          <Button variant="destructive" size="icon" onClick={() => setIsOpen(false)} title="Fechar Assistente"><X className="h-5 w-5" /></Button>
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-center">
          <div className="flex-grow flex items-center justify-center"><p className="text-white text-3xl md:text-5xl font-bold leading-tight drop-shadow-lg">{displayedAiResponse}</p></div>
          <AudioVisualizer isSpeaking={isSpeaking} />
          <div className="h-16"><p className="text-gray-400 text-lg md:text-xl">{transcript}</p></div>
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;