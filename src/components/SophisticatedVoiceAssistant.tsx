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
import { Mic, X, Send, Info } from "lucide-react";
import { UrlIframeModal } from "./UrlIframeModal";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
const OPENAI_WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

// Função para detectar suporte à Web Speech API
const hasWebSpeechSupport = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

const SophisticatedVoiceAssistant: React.FC<VoiceAssistantProps> = ({
  settings,
  isLoading,
}) => {
  const { workspace, session } = useSession();
  const { systemVariables } = useSystem();
  const { activationTrigger } = useVoiceAssistant();

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
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
  const [useWebSpeech, setUseWebSpeech] = useState(true);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);

  // Refs para estados e props dinâmicos
  const settingsRef = useRef(settings);
  const isOpenRef = useRef(isOpen);
  const isListeningRef = useRef(isListening);
  const isSpeakingRef = useRef(isSpeaking);
  const hasBeenActivatedRef = useRef(hasBeenActivated);
  const powersRef = useRef(powers);
  const clientActionsRef = useRef(clientActions);
  const messageHistoryRef = useRef(messageHistory);
  const systemVariablesRef = useRef(systemVariables);
  const sessionRef = useRef(session);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const activationRequestedViaButton = useRef(false);
  const isInitializingRef = useRef(false);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Efeitos para sincronizar refs com estados/props
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { hasBeenActivatedRef.current = hasBeenActivated; }, [hasBeenActivated]);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { clientActionsRef.current = clientActions; }, [clientActions]);
  useEffect(() => { messageHistoryRef.current = messageHistory; }, [messageHistory]);
  useEffect(() => { systemVariablesRef.current = systemVariables; }, [systemVariables]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }
    console.log(`[VA] Preparando para falar: "${text}"`);
    stopListening();
    stopSpeaking();
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setAiResponse(text);

    let alreadyRestarted = false;

    const onSpeechEnd = () => {
      console.log('[VA] Finalizou a fala.');
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      onEndCallback?.();
      if (isOpenRef.current && !stopPermanentlyRef.current && !isListeningRef.current && !alreadyRestarted) {
        alreadyRestarted = true;
        console.log('[VA] Reiniciando escuta após fala (único).');
        setTimeout(() => {
          if (!isListeningRef.current) startListening();
        }, 500);
      }
    };

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        console.log('[VA] Usando o modelo de voz do navegador.');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = onSpeechEnd;
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        console.log('[VA] Usando o modelo de voz OpenAI TTS.');
        try {
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
          audioRef.current.onerror = (error) => { 
            console.error('[VA] Erro ao reproduzir áudio OpenAI TTS, usando fallback:', error);
            URL.revokeObjectURL(audioUrl);
            if (synthRef.current) {
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.lang = "pt-BR";
              utterance.onend = onSpeechEnd;
              utterance.onerror = onSpeechEnd;
              synthRef.current.speak(utterance);
            } else {
              onSpeechEnd();
            }
          };
          await audioRef.current.play();
        } catch (error) {
          console.error('[VA] Erro com OpenAI TTS, usando fallback:', error);
          if (synthRef.current) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "pt-BR";
            utterance.onend = onSpeechEnd;
            utterance.onerror = onSpeechEnd;
            synthRef.current.speak(utterance);
          } else {
            onSpeechEnd();
          }
        }
      } else {
        console.warn('[VA] Nenhum modelo de voz válido configurado. Pulando a fala.');
        onSpeechEnd();
      }
    } catch (error) {
      console.error("[VA] Erro durante a fala:", error);
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening]);

  const initializeAssistant = useCallback(() => {
    if (isInitializingRef.current) {
      console.log('[VA] Já está inicializando, ignorando.');
      return;
    }
    
    isInitializingRef.current = true;
    console.log('[VA] Inicializando assistente...');
    
    const webSpeechSupported = hasWebSpeechSupport();
    const hasOpenAIKey = settingsRef.current?.openai_api_key;
    
    if (webSpeechSupported) {
      setUseWebSpeech(true);
      setShowBrowserWarning(false);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onstart = () => {
        console.log('[VA] Reconhecimento de voz iniciado.');
        setIsListening(true);
        isListeningRef.current = true;
      };
      
      recognitionRef.current.onend = () => {
        console.log('[VA] Reconhecimento de voz finalizado.');
        setIsListening(false);
        isListeningRef.current = false;
        if (!isSpeakingRef.current && !stopPermanentlyRef.current && !isListeningRef.current) {
          console.log('[VA] Reiniciando escuta após onend (único).');
          setTimeout(() => {
            if (!isListeningRef.current) startListening();
          }, 1000);
        }
      };
      
      recognitionRef.current.onerror = (e) => {
        console.log(`[VA] Erro no reconhecimento de voz: ${e.error}`);
        setIsListening(false);
        isListeningRef.current = false;
        if ((e.error === 'no-speech' || e.error === 'audio-capture') && !isSpeakingRef.current && !stopPermanentlyRef.current && !isListeningRef.current) {
          console.log('[VA] Reiniciando escuta após erro esperado (único).');
          setTimeout(() => {
            if (!isListeningRef.current) startListening();
          }, 1500);
        }
      };
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log(`[VA] Transcrição Web Speech: "${transcript}"`);
        handleTranscription(transcript);
      };
    } else if (hasOpenAIKey) {
      setUseWebSpeech(false);
      setShowBrowserWarning(true);
    } else {
      showError("Reconhecimento de voz não suportado neste navegador e chave OpenAI não configurada.");
      isInitializingRef.current = false;
      return;
    }

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      console.log('[VA] Síntese de voz inicializada.');
    }
    isInitializingRef.current = false;
    setTimeout(() => startListening(), 1000);
  }, [handleTranscription, startListening]);

  // restante do código permanece igual...

export default SophisticatedVoiceAssistant;