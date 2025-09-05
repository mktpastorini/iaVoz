"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { showError, showSuccess } from "@/utils/toast";
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
  // Permissão do microfone/modal
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'denied' | 'checking'>('checking');

  // Estados principais do assistente
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [audioIntensity, setAudioIntensity] = useState(0);

  // Refs para reconhecimento de voz e síntese
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Para ativação via contexto global
  const { activationTrigger } = useVoiceAssistant();
  const isMobile = useIsMobile();

  // Checa permissão do microfone ao abrir assistente
  const checkMicPermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermission("denied");
      setIsPermissionModalOpen(true);
      return false;
    }
    try {
      // Tenta obter permissão
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("prompt");
      return true;
    } catch {
      setMicPermission("denied");
      setIsPermissionModalOpen(true);
      return false;
    }
  }, []);

  // Inicia reconhecimento de voz
  const startListening = useCallback(async () => {
    const hasPermission = await checkMicPermission();
    if (!hasPermission) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado neste navegador.");
      return;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e: any) => {
      setIsListening(false);
      showError("Erro no microfone: " + (e.error || "desconhecido"));
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setUserText(transcript);
      handleUserCommand(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [checkMicPermission]);

  // Para ativar assistente via botão ou contexto
  useEffect(() => {
    if (activationTrigger > 0) {
      setIsOpen(true);
      setTimeout(() => startListening(), 400);
    }
    // eslint-disable-next-line
  }, [activationTrigger]);

  // Fecha assistente e para tudo
  const closeAssistant = () => {
    setIsOpen(false);
    setUserText("");
    setAssistantText("");
    setIsListening(false);
    setIsSpeaking(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  };

  // Fala texto usando Web Speech API
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    synthRef.current = window.speechSynthesis;
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR";
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    synthRef.current.speak(utter);
  }, []);

  // Lógica de resposta do assistente (placeholder)
  const handleUserCommand = useCallback((command: string) => {
    // Aqui você pode integrar com IA, API, etc.
    const response = `Você disse: "${command}". Como posso ajudar?`;
    setAssistantText(response);
    speak(response);
  }, [speak]);

  // Inicia assistente manualmente
  const handleOpenAssistant = async () => {
    setIsOpen(true);
    setTimeout(() => startListening(), 400);
  };

  // Renderização
  return (
    <>
      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={() => {
          setIsPermissionModalOpen(false);
          setMicPermission("prompt");
        }}
        onClose={() => setIsPermissionModalOpen(false)}
        permissionState={micPermission}
      />
      {/* Botão flutuante para abrir assistente */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={handleOpenAssistant}
            className="rounded-full p-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg"
            size="icon"
          >
            <Mic className="h-6 w-6" />
          </Button>
        </div>
      )}
      {/* Modal do assistente */}
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70">
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 flex flex-col items-center">
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-4 right-4"
              onClick={closeAssistant}
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="mb-4">
              <AudioVisualizer isSpeaking={isSpeaking} />
            </div>
            <div className="w-full mb-2">
              <div className="text-gray-700 dark:text-gray-200 text-lg font-semibold text-center min-h-[2.5rem]">
                {userText ? `Você: ${userText}` : isListening ? "Estou ouvindo..." : "Clique no microfone e fale"}
              </div>
              <div className="text-purple-700 dark:text-purple-300 text-base text-center min-h-[2.5rem]">
                {assistantText}
              </div>
            </div>
            <div className="flex justify-center mt-4">
              <Button
                onClick={startListening}
                className={cn(
                  "rounded-full p-4 text-white shadow-lg",
                  isListening ? "bg-red-600" : "bg-cyan-500"
                )}
                size="icon"
                disabled={isListening}
              >
                <Mic className="h-6 w-6" />
              </Button>
            </div>
          </div>
          {/* Efeito visual de fundo */}
          <div className="fixed inset-0 -z-10 pointer-events-none">
            <AIScene audioIntensity={audioIntensity} isMobile={isMobile} />
          </div>
        </div>
      )}
    </>
  );
};

export default SophisticatedVoiceAssistant;