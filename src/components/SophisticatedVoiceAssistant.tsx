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
  // ... outros estados e refs permanecem iguais ...

  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied" | "checking">("checking");
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

  // ... checkMicPermission e requestMicPermission permanecem iguais ...

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