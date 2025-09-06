"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useSystem } from "@/contexts/SystemContext";
import { replacePlaceholders } from "@/lib/utils";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AudioVisualizer } from "./AudioVisualizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, X } from "lucide-react";
import { UrlIframeModal } from "./UrlIframeModal";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { AIScene } from "./AIScene";
import { useIsMobile } from "@/hooks/use-mobile";

const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";

const ImageModal = ({ imageUrl, altText, onClose }) => (
  <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80" onClick={onClose}>
    <div className="relative max-w-4xl max-h-[80vh] p-4" onClick={(e) => e.stopPropagation()}>
      <img src={imageUrl} alt={altText} className="w-full h-full object-contain rounded-lg" />
      <Button variant="destructive" size="icon" className="absolute top-6 right-6 rounded-full" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

const SophisticatedVoiceAssistant = () => {
  const { session } = useSession();
  const { systemVariables } = useSystem();
  const { activationTrigger, isOpen, closeAssistant } = useVoiceAssistant();
  const isMobile = useIsMobile();

  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState([]);
  const [powers, setPowers] = useState([]);
  const [clientActions, setClientActions] = useState([]);
  const [imageToShow, setImageToShow] = useState(null);
  const [urlToOpenInIframe, setUrlToOpenInIframe] = useState(null);
  const [micPermission, setMicPermission] = useState("checking");
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [hasBeenActivated, setHasBeenActivated] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);

  // Refs
  const settingsRef = useRef(settings);
  const isOpenRef = useRef(isOpen);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const hasBeenActivatedRef = useRef(hasBeenActivated);
  const powersRef = useRef(powers);
  const clientActionsRef = useRef(clientActions);
  const systemVariablesRef = useRef(systemVariables);
  const sessionRef = useRef(session);
  const messageHistoryRef = useRef(messageHistory);

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const audioRef = useRef(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const speechTimeoutRef = useRef(null);

  // Web Audio API refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Sync refs with state
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { hasBeenActivatedRef.current = hasBeenActivated; }, [hasBeenActivated]);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { clientActionsRef.current = clientActions; }, [clientActions]);
  useEffect(() => { systemVariablesRef.current = systemVariables; }, [systemVariables]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { messageHistoryRef.current = messageHistory; }, [messageHistory]);

  // Função para executar ação do cliente (placeholder)
  const executeClientAction = useCallback((action) => {
    console.log("[executeClientAction] Executando ação do cliente:", action);
    // Aqui você pode implementar a lógica para abrir URL, mostrar imagem, etc.
    // Por enquanto, só loga no console.
  }, []);

  // Função para rodar a conversa (placeholder)
  const runConversation = useCallback((userInput) => {
    console.log("[runConversation] Processando entrada do usuário:", userInput);
    // Aqui você pode implementar a lógica para enviar a entrada para a IA, atualizar o estado, etc.
  }, []);

  // Função para falar texto usando SpeechSynthesis
  const speak = useCallback((text, onDone) => {
    if (!window.speechSynthesis) {
      onDone && onDone();
      return;
    }
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onDone && onDone();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      onDone && onDone();
    };
    synthRef.current = window.speechSynthesis;
    synthRef.current.speak(utterance);
  }, []);

  // Função para iniciar o reconhecimento de voz
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current) {
      try {
        recognitionRef.current.start();
        isListeningRef.current = true;
        setIsListening(true);
        console.log("[VoiceRecognition] Reconhecimento iniciado via startListening");
      } catch (e) {
        console.error("[VoiceRecognition] Erro ao iniciar reconhecimento:", e);
      }
    }
  }, []);

  // Função para parar o reconhecimento de voz
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
      isListeningRef.current = false;
      setIsListening(false);
      console.log("[VoiceRecognition] Reconhecimento parado via stopListening");
    }
  }, []);

  // Função para parar a fala
  const stopSpeaking = useCallback(() => {
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Função para buscar dados do assistente (placeholder)
  const fetchAllAssistantData = useCallback(async () => {
    // Aqui você pode implementar a lógica para buscar configurações, poderes, etc.
    // Por enquanto, retorna as configurações atuais
    return settingsRef.current;
  }, []);

  const initializeAssistant = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado.");
      setMicPermission("denied");
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";
    recognitionRef.current.onstart = () => { 
      isListeningRef.current = true; 
      setIsListening(true); 
      console.log("[VoiceRecognition] Iniciado"); 
    };
    recognitionRef.current.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      console.log("[VoiceRecognition] Encerrado");
      if (!isSpeakingRef.current && !stopPermanentlyRef.current) {
        console.log("[VoiceRecognition] Reiniciando reconhecimento...");
        // Não reinicia imediatamente para evitar loop no no-speech
        setTimeout(() => {
          startListening();
        }, 1000);
      }
    };
    recognitionRef.current.onerror = (e) => {
      console.error("[VoiceRecognition] Erro:", e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicPermission("denied");
        setIsPermissionModalOpen(true);
      }
      if (e.error === "no-speech") {
        console.log("[VoiceRecognition] Nenhuma fala detectada, aguardando para reiniciar...");
        // Não reinicia aqui para evitar loop infinito
      }
    };
    recognitionRef.current.onresult = (event) => {
      const transcriptRaw = event.results[event.results.length - 1][0].transcript.trim();
      const transcriptLower = transcriptRaw.toLowerCase();
      console.log("[VoiceRecognition] Resultado:", transcriptRaw);

      const closePhrases = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];
      if (isOpenRef.current) {
        if (closePhrases.some((phrase) => transcriptLower.includes(phrase))) {
          console.log("[VoiceRecognition] Frase de fechamento detectada:", transcriptRaw);
          setIsOpen(false);
          setAiResponse("");
          setTranscript("");
          stopSpeaking();
          return;
        }
        const matchedAction = clientActionsRef.current.find((a) => transcriptLower.includes(a.trigger_phrase.toLowerCase()));
        if (matchedAction) {
          console.log("[VoiceRecognition] Ação do cliente detectada:", matchedAction);
          executeClientAction(matchedAction);
          return;
        }
        runConversation(transcriptRaw);
      } else {
        if (settingsRef.current && transcriptLower.includes(settingsRef.current.activation_phrase.toLowerCase())) {
          console.log("[VoiceRecognition] Frase de ativação detectada:", transcriptRaw);
          fetchAllAssistantData().then((latestSettings) => {
            if (!latestSettings) return;
            setIsOpen(true);
            const messageToSpeak = hasBeenActivatedRef.current && latestSettings.continuation_phrase ? latestSettings.continuation_phrase : latestSettings.welcome_message;
            speak(messageToSpeak);
            setHasBeenActivated(true);
          });
        }
      }
    };
    if ("speechSynthesis" in window) synthRef.current = window.speechSynthesis;
  }, [executeClientAction, runConversation, speak, startListening, stopSpeaking, fetchAllAssistantData]);

  // Iniciar reconhecimento de voz automaticamente quando o assistente abrir
  useEffect(() => {
    if (isOpen) {
      console.log("[VoiceAssistant] Assistente aberto, iniciando microfone...");
      startListening();
    } else {
      console.log("[VoiceAssistant] Assistente fechado, parando microfone...");
      stopListening();
    }
  }, [isOpen, startListening, stopListening]);

  // Inicializa o assistente na montagem
  useEffect(() => {
    initializeAssistant();
  }, [initializeAssistant]);

  return (
    <>
      {/* Aqui você pode renderizar a UI do assistente */}
    </>
  );
};

export default SophisticatedVoiceAssistant;