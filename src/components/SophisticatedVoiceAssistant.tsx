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
  const { systemVariables, powers, systemPowers, loadingSystemContext } = useSystem();
  const { activationTrigger } = useVoiceAssistant();
  const isMobile = useIsMobile();

  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState([]);
  const [clientActions, setClientActions] = useState([]);
  const [imageToShow, setImageToShow] = useState(null);
  const [urlToOpenInIframe, setUrlToOpenInIframe] = useState(null);
  const [micPermission, setMicPermission] = useState("checking");
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [hasBeenActivated, setHasBeenActivated] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);

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

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const audioRef = useRef(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

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

  // Buscar configurações filtrando pelo workspace ativo do SystemContext
  useEffect(() => {
    const fetchSettings = async () => {
      if (loadingSystemContext) {
        console.log("[Assistant] System context loading, waiting to fetch settings...");
        return;
      }
      const workspaceId = systemVariables?.workspace_id || null;
      console.log("[Assistant] Fetching settings for workspace:", workspaceId || "unknown");

      try {
        const { data, error } = await supabase
          .from("settings")
          .select("*")
          .eq("workspace_id", workspaceId)
          .limit(1)
          .single();

        if (error) {
          console.error("[Assistant] Error fetching settings:", error);
          showError("Erro ao carregar configurações do assistente.");
          setSettings(null);
        } else {
          console.log("[Assistant] Settings loaded:", data);
          setSettings(data);
        }
      } catch (e) {
        console.error("[Assistant] Exception fetching settings:", e);
        setSettings(null);
      }
    };

    fetchSettings();
  }, [systemVariables, loadingSystemContext]);

  // Funções auxiliares para log detalhado
  const logAction = (message, data) => {
    console.groupCollapsed(`[Assistant] ${message}`);
    if (data !== undefined) console.log(data);
    console.groupEnd();
  };

  const startListening = useCallback(() => {
    logAction("Starting voice recognition...");
    if (micPermission !== 'granted' || !recognitionRef.current || isListeningRef.current || isSpeakingRef.current) {
      logAction("Cannot start listening: permission or state not valid", { micPermission, isListening: isListeningRef.current, isSpeaking: isSpeakingRef.current });
      return;
    }
    try {
      recognitionRef.current.start();
      logAction("Voice recognition started");
    } catch (e) {
      logAction("Recognition start error (probably already started)", e);
    }
  }, [micPermission]);

  const stopListening = useCallback(() => {
    logAction("Stopping voice recognition...");
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
      logAction("Voice recognition stopped");
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    logAction("Stopping speech synthesis...");
    if (synthRef.current?.speaking) synthRef.current.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setAudioIntensity(0);
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
    logAction("Speech synthesis stopped");
  }, []);

  // Função para falar texto com logs
  const speak = useCallback(async (text, onEndCallback) => {
    logAction("Speak called with text:", text);
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      logAction("No text or settings to speak");
      onEndCallback?.();
      return;
    }

    stopSpeaking();
    stopListening();
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setAiResponse(text);

    const onSpeechEnd = () => {
      logAction("Speech ended");
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        onEndCallback?.();
        if (isOpenRef.current) {
          startListening();
        }
      }
    };

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (e) => { logAction("SpeechSynthesis error:", e); onSpeechEnd(); };
        synthRef.current.speak(utterance);
        logAction("SpeechSynthesis utterance started");
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: "tts-1", voice: currentSettings.openai_tts_voice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error(`OpenAI TTS API failed with status ${response.status}`);

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        audioRef.current = new Audio(audioUrl);
        setupAudioAnalysis();

        audioRef.current.onended = () => { URL.revokeObjectURL(audioUrl); onSpeechEnd(); };
        audioRef.current.onerror = (e) => { logAction("Audio playback error:", e); URL.revokeObjectURL(audioUrl); onSpeechEnd(); };

        await audioRef.current.play();
        runAudioAnalysis();
        logAction("OpenAI TTS audio playback started");
      } else {
        logAction("No voice model matched, skipping speech");
        setTimeout(onSpeechEnd, 500);
      }
    } catch (error) {
      logAction("Error in speak function:", error);
      showError("Ocorreu um erro ao tentar falar.");
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening]);

  // Função para executar conversa com logs detalhados
  const runConversation = useCallback(async (userMessage) => {
    logAction("User message received:", userMessage);
    setTranscript(userMessage);
    const newHistory = [...messageHistoryRef.current, { role: "user", content: userMessage }];
    setMessageHistory(newHistory);

    try {
      logAction("Invoking OpenAI edge function with history and powers", { history: newHistory, powers: powersRef.current, systemVariables: systemVariablesRef.current });
      const { data, error } = await supabase.functions.invoke('openai', {
        body: {
          history: newHistory,
          settings: settingsRef.current,
          powers: powersRef.current,
          system_variables: systemVariablesRef.current,
          user: sessionRef.current?.user,
        },
      });

      if (error) {
        logAction("Error from OpenAI edge function:", error);
        throw new Error(error.message);
      }

      const responseContent = data.choices[0].message.content;
      logAction("OpenAI response received:", responseContent);
      speak(responseContent);
      setMessageHistory(prev => [...prev, { role: "assistant", content: responseContent }]);
    } catch (err) {
      logAction("Error in conversation:", err);
      speak("Desculpe, ocorreu um erro ao processar sua solicitação.");
    }
  }, [speak]);

  // ... restante do componente permanece igual, com logs adicionados em pontos críticos ...

  return (
    <>
      {/* JSX do componente */}
    </>
  );
};

export default SophisticatedVoiceAssistant;