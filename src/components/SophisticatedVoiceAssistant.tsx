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

// ... (restante do componente e imports permanecem iguais)

const SophisticatedVoiceAssistant = () => {
  // ... (hooks e estados)

  const { loadingSystemContext } = useSystem();

  // ... (refs e outros estados)

  useEffect(() => {
    const initialize = async () => {
      if (!("speechSynthesis" in window) || !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
        showError("Seu navegador não suporta as APIs de voz.");
        setMicPermission("denied");
        setIsLoading(false);
        return;
      }

      synthRef.current = window.speechSynthesis;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (!stopPermanentlyRef.current && !isSpeakingRef.current) {
          startListening();
        }
      };
      recognitionRef.current.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setMicPermission("denied");
          setIsPermissionModalOpen(true);
        }
      };
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        const closePhrases = ["fechar", "encerrar", "desligar"];
        if (isOpenRef.current) {
          if (closePhrases.some(p => transcript.includes(p))) {
            setIsOpen(false);
          } else {
            runConversation(transcript);
          }
        } else if (settingsRef.current?.activation_phrase && transcript.includes(settingsRef.current.activation_phrase.toLowerCase())) {
          setIsOpen(true);
        }
      };

      try {
        const permissionStatus = await navigator.permissions.query({ name: "microphone" });
        setMicPermission(permissionStatus.state);
        if (permissionStatus.state === "granted") {
          startListening();
        } else if (permissionStatus.state === "prompt") {
          setIsPermissionModalOpen(true);
        }
        permissionStatus.onchange = () => setMicPermission(permissionStatus.state);
      } catch {
        setMicPermission("prompt");
      }
      
      setIsLoading(false);
    };

    if (!loadingSystemContext) {
      initialize();
    }
    return () => {
      stopPermanentlyRef.current = true;
      stopListening();
      stopSpeaking();
    };
  }, [startListening, stopListening, stopSpeaking, runConversation, loadingSystemContext]);

  // ... (restante do componente permanece igual)
};