"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AudioVisualizer } from "./AudioVisualizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, X } from "lucide-react";
import { UrlIframeModal } from "./UrlIframeModal";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { AIScene } from "./AIScene";

// Importar os novos hooks e utilitários
import { useAssistantData } from "@/hooks/use-assistant-data";
import { useMicrophonePermission } from "@/hooks/use-microphone-permission";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { useAIConversation } from "@/hooks/use-ai-conversation";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { executeClientAction as executeClientActionUtil } from "@/utils/client-actions";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";

const ImageModal = ({ imageUrl, altText, onClose }) => (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80" onClick={onClose}>
    <div className="relative max-w-4xl max-h-[80vh] p-4" onClick={(e) => e.stopPropagation()}>
      <img src={imageUrl} alt={altText} className="w-full h-full object-contain rounded-lg" />
      <Button variant="destructive" size="icon" className="absolute top-6 right-6 rounded-full" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  </div>
);

const SophisticatedVoiceAssistant = () => {
  const { systemVariables } = useSystem();
  const { activationTrigger } = useVoiceAssistant();

  // Estados locais do componente principal
  const [isOpen, setIsOpen] = useState(false);
  const [imageToShow, setImageToShow] = useState(null);
  const [urlToOpenInIframe, setUrlToOpenInIframe] = useState(null);
  const [hasBeenActivated, setHasBeenActivated] = useState(false);

  // Refs para estados e props que precisam ser estáveis em callbacks
  const isOpenRef = useRef(isOpen);
  const hasBeenActivatedRef = useRef(hasBeenActivated);
  const stopPermanentlyRef = useRef(false); // Para sinalizar parada permanente no unmount
  const activationTriggerRef = useRef(0);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { hasBeenActivatedRef.current = hasBeenActivated; }, [hasBeenActivated]);

  // --- Hooks Modulares ---
  const { settings, powers, clientActions, isLoadingData, fetchAllAssistantData } = useAssistantData();

  const onSpeechEndGlobal = useCallback(() => {
    // This callback is called by useSpeechSynthesis when speech ends
    // It ensures that after speech, recognition can potentially restart
    // The actual restart logic is within useSpeechRecognition's useEffect
  }, []);

  const { isSpeaking, audioIntensity, aiResponseText, speak, stopSpeaking } = useSpeechSynthesis(
    settings,
    onSpeechEndGlobal,
    () => recognitionRef.current?.stopListening(), // Pass stopListening from recognition hook
    () => recognitionRef.current?.startListening(), // Pass startListening from recognition hook
    isOpen,
    stopPermanentlyRef
  );

  const { transcript, setTranscript, messageHistory, setMessageHistory, runConversation } = useAIConversation(
    settings,
    powers,
    systemVariables,
    speak,
    () => recognitionRef.current?.stopListening() // Pass stopListening from recognition hook
  );

  const executeClientAction = useCallback((action) => {
    stopSpeaking(); // Stop speaking immediately
    executeClientActionUtil({
      action,
      setImageToShow,
      setUrlToOpenInIframe,
      startListening: () => recognitionRef.current?.startListening(), // Restart listening after action
    });
  }, [stopSpeaking]);

  const onPermissionDenied = useCallback(() => {
    setMicPermission("denied");
    setIsPermissionModalOpen(true);
  }, []);

  const { micPermission, isPermissionModalOpen, setIsPermissionModalOpen, checkAndRequestMicPermission, handleAllowMic } = useMicrophonePermission(
    () => recognitionRef.current?.startListening() // Callback when mic permission is granted
  );

  const recognitionRef = useRef<any>(null); // Ref to hold the useSpeechRecognition instance

  // Initialize SpeechRecognition hook
  useEffect(() => {
    if (settings && !recognitionRef.current) {
      recognitionRef.current = useSpeechRecognition({
        onCommand: (command) => {
          if (command === "close_assistant") {
            setIsOpen(false);
            setAiResponse("");
            setTranscript("");
            stopSpeaking();
          } else {
            runConversation(command);
          }
        },
        onActivationPhrase: (phrase) => {
          fetchAllAssistantData().then((latestSettings) => {
            if (!latestSettings) return;
            setIsOpen(true);
            const messageToSpeak = hasBeenActivatedRef.current && latestSettings.continuation_phrase ? latestSettings.continuation_phrase : latestSettings.welcome_message;
            speak(messageToSpeak, () => { if (isOpenRef.current) recognitionRef.current?.startListening(); });
            setHasBeenActivated(true);
          });
        },
        onPermissionDenied,
        onSpeechEnd: onSpeechEndGlobal, // Pass the global speech end callback
        isSpeaking,
        isAssistantOpen: isOpen,
        activationPhrase: settings.activation_phrase,
        clientActions,
        executeClientAction,
      });
    }
  }, [settings, isSpeaking, isOpen, clientActions, executeClientAction, runConversation, speak, stopSpeaking, fetchAllAssistantData, onPermissionDenied, onSpeechEndGlobal]);


  // --- Efeitos de Orquestração ---

  // Efeito para buscar dados iniciais e verificar permissão do microfone
  useEffect(() => {
    fetchAllAssistantData().then(() => {
      checkAndRequestMicPermission();
    });

    return () => {
      stopPermanentlyRef.current = true;
      recognitionRef.current?.stopListening();
      stopSpeaking();
    };
  }, [fetchAllAssistantData, checkAndRequestMicPermission, stopSpeaking]);

  // Efeito para ativar o assistente manualmente via contexto
  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      if (isOpenRef.current) return; // Already open
      if (micPermission !== "granted") {
        checkAndRequestMicPermission();
      } else {
        fetchAllAssistantData().then((latestSettings) => {
          if (!latestSettings) return;
          setIsOpen(true);
          const messageToSpeak = hasBeenActivatedRef.current && latestSettings.continuation_phrase ? latestSettings.continuation_phrase : latestSettings.welcome_message;
          speak(messageToSpeak, () => { if (isOpenRef.current) recognitionRef.current?.startListening(); });
          setHasBeenActivated(true);
        });
      }
    }
  }, [activationTrigger, micPermission, checkAndRequestMicPermission, speak, fetchAllAssistantData]);

  if (isLoadingData || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={handleAllowMic}
        onClose={() => setIsPermissionModalOpen(false)}
        permissionState={micPermission}
      />
      {imageToShow && (
        <ImageModal imageUrl={imageToShow.imageUrl} altText={imageToShow.altText} onClose={() => { setImageToShow(null); recognitionRef.current?.startListening(); }} />
      )}
      {urlToOpenInIframe && (
        <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); recognitionRef.current?.startListening(); }} />
      )}
      <div
        className={cn(
          "fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 transition-opacity duration-500",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
          <AIScene audioIntensity={audioIntensity} />
        </div>
        <div />
        <div className="text-center select-text pointer-events-auto max-w-2xl mx-auto w-full">
          {aiResponseText && (
            <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-xl p-6 shadow-lg shadow-purple-500/20">
              <p className="text-white text-2xl md:text-4xl font-bold leading-tight drop-shadow-lg">
                {aiResponseText}
              </p>
            </div>
          )}
          {transcript && (
            <p className="text-gray-400 text-lg mt-4">{transcript}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-4 p-4 bg-black/30 backdrop-blur-md rounded-2xl border border-cyan-400/20 shadow-lg shadow-cyan-500/20 pointer-events-auto">
          <AudioVisualizer isSpeaking={isSpeaking} />
          <div className="p-4 bg-cyan-900/20 rounded-full border border-cyan-400/30">
            <Mic className={cn("h-8 w-8 text-cyan-300 transition-all", isListening && "text-cyan-200 animate-pulse drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]")} />
          </div>
          <AudioVisualizer isSpeaking={isSpeaking} />
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;