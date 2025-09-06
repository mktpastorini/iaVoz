"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystem } from "@/contexts/SystemContext";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AudioVisualizer } from "./AudioVisualizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, X, Loader2 } from "lucide-react";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { AIScene } from "./AIScene";
import { useIsMobile } from "@/hooks/use-mobile";

const SophisticatedVoiceAssistant = () => {
  const { powers, loadingSystemContext, effectiveWorkspace } = useSystem();
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
  const [listeningMode, setListeningMode] = useState<'hotword' | 'command'>('hotword');
  const [audioIntensity, setAudioIntensity] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const settingsRef = useRef(settings);
  const powersRef = useRef(powers);
  const isSpeakingRef = useRef(isSpeaking);
  const stopPermanentlyRef = useRef(false);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  const logAction = (message: string, data?: any) => {
    console.log(`[Assistant] ${message}`, data !== undefined ? data : "");
  };

  const startListening = useCallback(() => {
    if (recognitionRef.current && micPermission === 'granted' && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        logAction("Recognition start error (might be already starting).", e);
      }
    }
  }, [micPermission, isListening]);

  const speak = useCallback((text: string, onEndCallback?: () => void) => {
    logAction("Speaking:", text);
    if (!text) {
      onEndCallback?.();
      return;
    }
    
    setIsSpeaking(true);
    setAiResponse(text);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    
    utterance.onstart = () => {
      recognitionRef.current?.stop();
    };

    utterance.onend = () => {
      logAction("Finished speaking.");
      setIsSpeaking(false);
      onEndCallback?.();
    };
    
    utterance.onerror = (e) => {
      logAction("Speech error", e);
      setIsSpeaking(false);
      onEndCallback?.();
    };
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const runConversation = useCallback(async (userMessage: string) => {
    logAction("Starting conversation with:", userMessage);
    setIsProcessing(true);
    setTranscript(userMessage);
    setAiResponse("");

    let currentHistory = [...messageHistory, { role: "user", content: userMessage }];
    setMessageHistory(currentHistory);

    try {
      for (let i = 0; i < 5; i++) {
        const { data: openAIResponse, error: invokeError } = await supabase.functions.invoke('openai', {
          body: { history: currentHistory, settings: settingsRef.current, powers: powersRef.current },
        });
        if (invokeError) throw new Error(invokeError.message);

        const message = openAIResponse.choices[0].message;
        currentHistory = [...currentHistory, message];
        setMessageHistory(currentHistory);

        if (message.tool_calls) {
          logAction("AI requested tool calls:", message.tool_calls);
          const toolOutputs = await Promise.all(message.tool_calls.map(async (toolCall) => {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            logAction(`Executing tool: ${functionName}`, functionArgs);
            const { data: toolResult, error: toolError } = await supabase.functions.invoke(functionName, { body: functionArgs });
            return { tool_call_id: toolCall.id, output: JSON.stringify(toolError ? { error: toolError.message } : toolResult) };
          }));
          const toolMessages = toolOutputs.map(output => ({
            tool_call_id: output.tool_call_id, role: "tool", name: message.tool_calls.find(tc => tc.id === output.tool_call_id)!.function.name, content: output.output,
          }));
          currentHistory = [...currentHistory, ...toolMessages];
          setMessageHistory(currentHistory);
        } else {
          logAction("AI final response:", message.content);
          speak(message.content, () => {
            setListeningMode('hotword');
            startListening();
          });
          setIsProcessing(false);
          return;
        }
      }
    } catch (err: any) {
      logAction("Error in conversation:", err);
      speak("Desculpe, ocorreu um erro.", startListening);
    } finally {
      setIsProcessing(false);
    }
  }, [messageHistory, speak, startListening]);

  const requestMicPermission = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => logAction("Permission granted via prompt."))
      .catch(() => logAction("Permission denied via prompt."));
  }, []);

  useEffect(() => {
    if (loadingSystemContext || !effectiveWorkspace?.id) return;
    supabase.from("settings").select("*").eq("workspace_id", effectiveWorkspace.id).single()
      .then(({ data, error }) => {
        if (error) logAction("Error fetching settings:", error);
        else setSettings(data);
      });
  }, [effectiveWorkspace, loadingSystemContext]);

  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não é suportado neste navegador.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      if (!stopPermanentlyRef.current && !isSpeakingRef.current) {
        setTimeout(() => startListening(), 250);
      }
    };
    recognition.onerror = (event) => {
      logAction("Recognition error", event.error);
      if (event.error === 'not-allowed') setMicPermission('denied');
    };
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      logAction("Heard:", transcript);
      const activationPhrase = settingsRef.current?.activation_phrase?.toLowerCase() || 'ativar';

      if (listeningMode === 'hotword' && transcript.includes(activationPhrase)) {
        logAction("Activation phrase detected!");
        setIsOpen(true);
        setListeningMode('command');
        const continuationPhrase = settingsRef.current?.continuation_phrase || "Pois não?";
        speak(continuationPhrase, startListening);
      } else if (listeningMode === 'command' && isOpen) {
        logAction("Processing command:", transcript);
        runConversation(transcript);
      }
    };

    navigator.permissions.query({ name: "microphone" as PermissionName }).then((result) => {
      setMicPermission(result.state as any);
      if (result.state === 'granted') startListening();
      result.onchange = () => {
        logAction("Permission state changed to:", result.state);
        setMicPermission(result.state as any);
        if (result.state === 'granted') startListening();
        else recognition.stop();
      };
    });

    return () => {
      stopPermanentlyRef.current = true;
      recognition.stop();
    };
  }, [listeningMode, runConversation, speak, isOpen, startListening]);

  useEffect(() => {
    setIsPermissionModalOpen(micPermission === 'prompt' || micPermission === 'denied');
  }, [micPermission]);

  if (!isOpen) {
    return (
      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={requestMicPermission}
        onClose={() => setIsPermissionModalOpen(false)}
        permissionState={micPermission}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="h-6 w-6 text-white" />
        </Button>
      </div>
      <div className="w-full max-w-3xl text-center">
        <div className="mb-8 h-12"><AudioVisualizer isSpeaking={isSpeaking} /></div>
        <p className="text-lg text-gray-400 h-12 mb-4">{transcript}</p>
        <h2 className="text-3xl md:text-4xl font-bold text-white min-h-[100px]">
          {displayedAiResponse || (isListening ? "Ouvindo..." : "Aguardando comando...")}
        </h2>
      </div>
      <div className="absolute bottom-10">
        <Button size="lg" className={cn("rounded-full h-20 w-20")} disabled>
          {isProcessing ? <Loader2 className="h-8 w-8 animate-spin" /> : <Mic className="h-8 w-8" />}
        </Button>
      </div>
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <AIScene audioIntensity={audioIntensity} isMobile={isMobile} />
      </div>
    </div>
  );
};

export default SophisticatedVoiceAssistant;