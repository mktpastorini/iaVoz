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
import { Mic, X, Loader2 } from "lucide-react";
import { UrlIframeModal } from "./UrlIframeModal";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { AIScene } from "./AIScene";
import { useIsMobile } from "@/hooks/use-mobile";

const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";

const SophisticatedVoiceAssistant = () => {
  const { session } = useSession();
  const { systemVariables, powers, loadingSystemContext, effectiveWorkspace } = useSystem();
  const { activationTrigger } = useVoiceAssistant();
  const isMobile = useIsMobile();

  const [settings, setSettings] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState([]);
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied" | "checking">("checking");
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [hasBeenActivated, setHasBeenActivated] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activationTriggerRef = useRef(activationTrigger);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  const logAction = (message: string, data?: any) => {
    console.groupCollapsed(`[Assistant] ${message}`);
    if (data !== undefined) console.log(data);
    console.groupEnd();
  };

  const startListening = useCallback(() => {
    if (micPermission !== "granted") {
      logAction("Cannot start listening, permission not granted.", { micPermission });
      setIsPermissionModalOpen(true);
      return;
    }
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        logAction("Recognition started.");
      } catch (e) {
        logAction("Recognition start error.", e);
      }
    }
  }, [micPermission, isListening]);

  const requestMicPermission = useCallback(() => {
    logAction("Requesting microphone permission...");
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        logAction("Microphone permission granted.");
        setMicPermission("granted");
        setIsPermissionModalOpen(false);
        startListening();
      })
      .catch((e) => {
        logAction("Microphone permission denied.", e);
        setMicPermission("denied");
        setIsPermissionModalOpen(true);
      });
  }, [startListening]);

  const openAssistant = useCallback(() => {
    logAction("Opening assistant...");
    setIsOpen(true);
    if (!hasBeenActivated) {
      setHasBeenActivated(true);
      const welcomeMessage = settings?.welcome_message || "Olá! Como posso ajudar?";
      // speak(welcomeMessage, startListening); // Temporariamente desativado para focar no mic
    }
    
    if (micPermission === "granted") {
      startListening();
    } else {
      setIsPermissionModalOpen(true);
    }
  }, [micPermission, hasBeenActivated, settings, startListening]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      openAssistant();
    }
  }, [activationTrigger, openAssistant]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (loadingSystemContext || !effectiveWorkspace?.id) return;
      
      logAction("Fetching settings for workspace:", effectiveWorkspace.id);
      const { data: settingsData, error: settingsError } = await supabase
        .from("settings")
        .select("*")
        .eq("workspace_id", effectiveWorkspace.id)
        .single();

      if (settingsError) {
        logAction("Error fetching settings:", settingsError);
      } else {
        logAction("Settings loaded:", settingsData);
        setSettings(settingsData);
      }
    };
    fetchInitialData();
  }, [effectiveWorkspace, loadingSystemContext]);

  useEffect(() => {
    const checkMicPermission = () => {
      navigator.permissions.query({ name: "microphone" as PermissionName }).then((result) => {
        logAction("Initial microphone permission state:", result.state);
        setMicPermission(result.state as any);
        result.onchange = () => {
          logAction("Microphone permission changed to:", result.state);
          setMicPermission(result.state as any);
        };
      });
    };
    checkMicPermission();
  }, []);

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) {
      showError("Reconhecimento de voz não é suportado neste navegador.");
      return;
    }
    const SpeechRecognition = window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart logic can be added here if needed
    };
    recognition.onerror = (event) => {
      logAction("Speech recognition error", event);
      if (event.error === 'not-allowed') {
        setMicPermission('denied');
        setIsPermissionModalOpen(true);
      }
    };
    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const command = event.results[last][0].transcript.trim();
      logAction("Command received:", command);
      setTranscript(command);
      // Here you would call runConversation(command);
    };

    return () => {
      recognition.stop();
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
            <X className="h-6 w-6 text-white" />
          </Button>
        </div>

        <div className="w-full max-w-3xl text-center">
          <div className="mb-8 h-12">
            <AudioVisualizer isSpeaking={isSpeaking} />
          </div>

          <p className="text-lg text-gray-400 h-12 mb-4">{transcript}</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white min-h-[100px]">
            {displayedAiResponse || (isListening ? "Ouvindo..." : "Pressione o microfone para falar")}
          </h2>
        </div>

        <div className="absolute bottom-10">
          <Button
            size="lg"
            className={cn(
              "rounded-full h-20 w-20 transition-all duration-300 shadow-2xl",
              isListening ? "bg-red-500 hover:bg-red-600" : "bg-cyan-500 hover:bg-cyan-600"
            )}
            onClick={() => isListening ? recognitionRef.current?.stop() : startListening()}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-8 w-8 animate-spin" /> : <Mic className="h-8 w-8" />}
          </Button>
        </div>
        
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <AIScene audioIntensity={audioIntensity} isMobile={isMobile} />
        </div>
      </div>

      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={requestMicPermission}
        onClose={() => setIsPermissionModalOpen(false)}
        permissionState={micPermission}
      />
    </>
  );
};

export default SophisticatedVoiceAssistant;