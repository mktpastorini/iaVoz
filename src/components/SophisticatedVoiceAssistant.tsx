"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Tube } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useSystem } from "@/contexts/SystemContext";
import { replacePlaceholders } from "@/lib/utils";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, X } from "lucide-react";
import { UrlIframeModal } from "./UrlIframeModal";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";

// Interfaces e constantes (mesmos da última versão, omitidos aqui para brevidade)

// --- 3D Components (mesmos da última versão, omitidos para brevidade) ---

const SophisticatedVoiceAssistant: React.FC<VoiceAssistantProps> = ({
  settings,
  isLoading,
}) => {
  const { session } = useSession();
  const { systemVariables } = useSystem();
  const { activationTrigger } = useVoiceAssistant();

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
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

  // Refs para estados e props dinâmicos
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
  const activationRequestedViaButton = useRef(false);
  const isTransitioningToSpeakRef = useRef(false);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Sincroniza refs com estados/props
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

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListeningRef.current && !isSpeakingRef.current && !stopPermanentlyRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Pode lançar erro se já estiver rodando, ignorar
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) {
      synthRef.current.cancel();
    }
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (isSpeakingRef.current) {
      setIsSpeaking(false);
    }
  }, []);

  // Inicializa reconhecimento de voz e eventos
  const initializeAssistant = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado neste navegador.");
      setMicPermission('denied');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "pt-BR";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isTransitioningToSpeakRef.current) return;
      if (!stopPermanentlyRef.current) {
        startListening();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicPermission('denied');
        showError("Permissão para microfone negada.");
      }
    };

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript.trim().toLowerCase();

      if (!isOpenRef.current) {
        if (settingsRef.current && transcript.includes(settingsRef.current.activation_phrase.toLowerCase())) {
          setIsOpen(true);
          const welcomeMsg = hasBeenActivatedRef.current && settingsRef.current.continuation_phrase
            ? settingsRef.current.continuation_phrase
            : settingsRef.current.welcome_message;
          speak(welcomeMsg);
          setHasBeenActivated(true);
        }
        return;
      }

      // Se assistente aberto, tratar comandos
      const closeCommands = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];
      if (closeCommands.some(cmd => transcript.includes(cmd))) {
        setIsOpen(false);
        setAiResponse("");
        setTranscript("");
        stopSpeaking();
        return;
      }

      const matchedAction = clientActionsRef.current.find(a => transcript.includes(a.trigger_phrase.toLowerCase()));
      if (matchedAction) {
        executeClientAction(matchedAction);
        return;
      }

      runConversation(transcript);
    };

    recognitionRef.current = recognition;
  }, [startListening, speak, stopSpeaking, executeClientAction, runConversation]);

  // Funções speak, runConversation, executeClientAction permanecem iguais (omitidas aqui para brevidade)

  // Verifica permissão do microfone e inicializa
  useEffect(() => {
    if (isLoading) return;
    const checkPermissionAndInit = async () => {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicPermission(status.state);
        if (status.state === 'granted') {
          if (!recognitionRef.current) {
            initializeAssistant();
          }
          startListening();
        } else if (status.state === 'prompt') {
          setIsPermissionModalOpen(true);
        }
        status.onchange = () => checkPermissionAndInit();
      } catch {
        setMicPermission('denied');
      }
    };
    checkPermissionAndInit();

    return () => {
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, [isLoading, initializeAssistant, startListening]);

  // Efeito para ativar assistente via contexto
  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      if (!isOpenRef.current) {
        setIsOpen(true);
      }
    }
  }, [activationTrigger]);

  if (isLoading || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={() => {
          navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
            setIsPermissionModalOpen(false);
            if (activationRequestedViaButton.current) {
              activationRequestedViaButton.current = false;
            }
          }).catch(() => {
            setMicPermission('denied');
            showError("Você precisa permitir o uso do microfone para continuar.");
          });
        }}
        onClose={() => setIsPermissionModalOpen(false)}
      />
      {micPermission === 'denied' && !isOpen && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
          <Button onClick={() => {
            navigator.permissions.query({ name: 'microphone' as PermissionName }).then(status => {
              setMicPermission(status.state);
              if (status.state === 'granted') {
                // initializeAssistant();
                // startListening();
              } else if (status.state === 'prompt') {
                setIsPermissionModalOpen(true);
              }
            });
          }} size="lg" className="rounded-full w-16 h-16 shadow-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"><Mic size={32} /></Button>
        </div>
      )}
      {imageToShow && <ImageModal imageUrl={imageToShow.imageUrl!} altText={imageToShow.altText} onClose={() => { setImageToShow(null); }} />}
      {urlToOpenInIframe && <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); }} />}
      
      <div
        className={cn(
          "fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-purple-950"
          onClick={() => setIsOpen(false)}
        ></div>
        
        <div className="absolute inset-0 z-10 pointer-events-none">
          <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            
            <CosmicBackground />
            <ParticleOrb />
            <EnergyLines />

            <EffectComposer>
              <Bloom intensity={3.5} luminanceThreshold={0.03} mipmapBlur={true} />
            </EffectComposer>
          </Canvas>
        </div>

        <div className="relative z-20 flex flex-col items-center justify-between w-full h-full p-8 pointer-events-auto">
          <div /> 
          <div className="text-center">
            {displayedAiResponse && (
              <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 max-w-lg mx-auto">
                <p className="text-white text-2xl md:text-4xl font-bold leading-tight drop-shadow-lg">{displayedAiResponse}</p>
              </div>
            )}
            {transcript && <p className="text-gray-400 text-lg mt-4">{transcript}</p>}
          </div>

          <div className="flex items-center justify-center gap-4 p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10">
            <AudioVisualizer isSpeaking={isSpeaking} />
            <div className="p-3 bg-white/10 rounded-full">
              <Mic className={cn("h-6 w-6 text-white", isListening && "text-cyan-400 animate-pulse")} />
            </div>
            <AudioVisualizer isSpeaking={isSpeaking} />
          </div>
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;