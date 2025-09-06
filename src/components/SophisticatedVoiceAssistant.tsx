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

const SophisticatedVoiceAssistant = () => {
  const { session } = useSession();
  const { systemVariables, powers, systemPowers, loadingSystemContext, effectiveWorkspace } = useSystem();
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
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied" | "checking">("checking");
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

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  // Função para checar permissão do microfone
  const checkMicPermission = useCallback(() => {
    if (!navigator.permissions) {
      console.log("[Assistant] Permissions API not supported, defaulting to prompt");
      setMicPermission("prompt");
      return;
    }
    navigator.permissions.query({ name: "microphone" as PermissionName }).then((result) => {
      console.log("[Assistant] Microphone permission state:", result.state);
      setMicPermission(result.state as any);
      if (result.state === "denied") {
        setIsPermissionModalOpen(true);
      }
      result.onchange = () => {
        console.log("[Assistant] Microphone permission changed to:", result.state);
        setMicPermission(result.state as any);
        if (result.state === "denied") {
          setIsPermissionModalOpen(true);
        } else {
          setIsPermissionModalOpen(false);
        }
      };
    }).catch((e) => {
      console.error("[Assistant] Error checking microphone permission:", e);
      setMicPermission("prompt");
    });
  }, []);

  // Solicitar permissão do microfone
  const requestMicPermission = useCallback(() => {
    console.log("[Assistant] Requesting microphone permission...");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
      console.log("[Assistant] Microphone permission granted.");
      setMicPermission("granted");
      setIsPermissionModalOpen(false);
      startListening();
    }).catch((e) => {
      console.error("[Assistant] Microphone permission denied or error:", e);
      setMicPermission("denied");
      setIsPermissionModalOpen(true);
    });
  }, []);

  // Função para iniciar escuta
  const startListening = useCallback(() => {
    if (micPermission !== "granted") {
      console.log("[Assistant] Cannot start listening, microphone permission not granted.");
      setIsPermissionModalOpen(true);
      return;
    }
    if (recognitionRef.current && !isListeningRef.current) {
      try {
        recognitionRef.current.start();
        console.log("[Assistant] Started listening.");
      } catch (e) {
        console.error("[Assistant] Error starting recognition:", e);
      }
    }
  }, [micPermission]);

  // Função para abrir assistente e iniciar escuta, aguardando permissão
  const openAssistant = useCallback(async () => {
    console.log("[Assistant] Opening assistant...");
    setIsOpen(true);
    setHasBeenActivated(true);

    // Atualiza permissão antes de tentar iniciar escuta
    await new Promise<void>((resolve) => {
      if (micPermission === "granted") {
        resolve();
      } else if (micPermission === "denied") {
        setIsPermissionModalOpen(true);
        resolve();
      } else if (micPermission === "prompt") {
        // Espera permissão ser atualizada via evento onchange
        const onChange = (state: PermissionState) => {
          console.log("[Assistant] Microphone permission changed to:", state);
          setMicPermission(state as any);
          if (state === "granted" || state === "denied") {
            setIsPermissionModalOpen(state === "denied");
            resolve();
          }
        };
        if (navigator.permissions) {
          navigator.permissions.query({ name: "microphone" as PermissionName }).then((result) => {
            result.onchange = () => onChange(result.state);
          });
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    });

    if (micPermission === "granted") {
      startListening();
    } else if (micPermission === "prompt") {
      setIsPermissionModalOpen(true);
    }
  }, [micPermission, startListening]);

  // ... restante do componente permanece igual ...

  return (
    <>
      <Button onClick={openAssistant} className="fixed bottom-4 right-4 z-50 p-4 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg flex items-center">
        <Mic className="h-6 w-6" />
        <span className="ml-2 hidden md:inline">Abrir Assistente</span>
      </Button>

      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={requestMicPermission}
        onClose={() => setIsPermissionModalOpen(false)}
        permissionState={micPermission}
      />

      {/* JSX restante do assistente */}
    </>
  );
};

export default SophisticatedVoiceAssistant;