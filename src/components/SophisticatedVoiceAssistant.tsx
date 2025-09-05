"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useAssistantAPI } from "@/hooks/useAssistantAPI";
import { cn } from "@/lib/utils";
import { Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIScene } from "./AIScene";
import { AudioVisualizer } from "./AudioVisualizer";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { UrlIframeModal } from "./UrlIframeModal";
import { useTypewriter } from "@/hooks/useTypewriter";

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
  const { activationTrigger } = useVoiceAssistant();
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [micPermission, setMicPermission] = useState("checking");
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [imageToShow, setImageToShow] = useState(null);
  const [urlToOpenInIframe, setUrlToOpenInIframe] = useState(null);
  const [hasBeenActivated, setHasBeenActivated] = useState(false);

  const activationTriggerRef = useRef(0);

  const { speak, isSpeaking, audioIntensity, stopSpeaking } = useSpeechSynthesis(settings);
  const { settings, clientActions, isLoading, fetchAllAssistantData, runConversation } = useAssistantAPI(speak);
  
  const handleTranscript = useCallback((text) => {
    const closePhrases = ["fechar", "encerrar", "desligar", "cancelar"];
    if (isOpen) {
      if (closePhrases.some(p => text.includes(p))) {
        setIsOpen(false);
        stopSpeaking();
        return;
      }
      const action = clientActions.find(a => text.includes(a.trigger_phrase.toLowerCase()));
      if (action) {
        stopListening();
        speak("Ok, executando.", () => {
            if (action.action_type === 'SHOW_IMAGE') setImageToShow(action.action_payload);
            if (action.action_type === 'OPEN_IFRAME_URL') setUrlToOpenInIframe(action.action_payload.url);
            if (action.action_type === 'OPEN_URL') window.open(action.action_payload.url, '_blank');
        });
      } else {
        setTranscript(text);
        runConversation(text);
      }
    } else if (settings && text.includes(settings.activation_phrase.toLowerCase())) {
      setIsOpen(true);
    }
  }, [isOpen, settings, clientActions, runConversation, speak, stopSpeaking]);

  const { isListening, startListening, stopListening, initialize } = useSpeechRecognition({ onTranscript: handleTranscript });
  const displayedAiResponse = useTypewriter(aiResponse, 40);

  const handleManualActivation = useCallback(() => {
    if (isOpen) return;
    if (micPermission !== "granted") {
      setIsPermissionModalOpen(true);
    } else {
      setIsOpen(true);
    }
  }, [isOpen, micPermission]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    if (isOpen) {
      const message = hasBeenActivated && settings.continuation_phrase ? settings.continuation_phrase : settings.welcome_message;
      speak(message, startListening);
      if (!hasBeenActivated) setHasBeenActivated(true);
    } else {
      stopListening();
      stopSpeaking();
    }
  }, [isOpen, settings, hasBeenActivated]);

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      const permission = await navigator.permissions.query({ name: "microphone" });
      setMicPermission(permission.state);
      if (permission.state === "granted") {
        if (initialize()) startListening();
      } else {
        setIsPermissionModalOpen(true);
      }
      permission.onchange = () => setMicPermission(permission.state);
    } catch {
      setMicPermission("denied");
    }
  }, [initialize, startListening]);

  useEffect(() => {
    fetchAllAssistantData();
    checkAndRequestMicPermission();
  }, [fetchAllAssistantData, checkAndRequestMicPermission]);

  const handleAllowMic = async () => {
    setIsPermissionModalOpen(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      if (initialize()) startListening();
    } catch {
      setMicPermission("denied");
    }
  };

  if (isLoading || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal isOpen={isPermissionModalOpen} onAllow={handleAllowMic} onClose={() => setIsPermissionModalOpen(false)} permissionState={micPermission} />
      {imageToShow && <ImageModal imageUrl={imageToShow.imageUrl} altText={imageToShow.altText} onClose={() => { setImageToShow(null); startListening(); }} />}
      {urlToOpenInIframe && <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); startListening(); }} />}
      
      <div className={cn("fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 transition-opacity duration-500", isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
        {isOpen && (
            <div className="absolute inset-0 -z-10 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
                <AIScene audioIntensity={audioIntensity} />
            </div>
        )}
        <div />
        <div className="text-center select-text pointer-events-auto max-w-2xl mx-auto w-full">
          {displayedAiResponse && (
            <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-xl p-6 shadow-lg shadow-purple-500/20">
              <p className="text-white text-2xl md:text-4xl font-bold leading-tight drop-shadow-lg">{displayedAiResponse}</p>
            </div>
          )}
          {transcript && <p className="text-gray-400 text-lg mt-4">{transcript}</p>}
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