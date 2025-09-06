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
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { AIScene } from "./AIScene";
import { useIsMobile } from "@/hooks/use-mobile";

const SophisticatedVoiceAssistant = () => {
  const { powers, loadingSystemContext, effectiveWorkspace } = useSystem();
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
  const [audioIntensity, setAudioIntensity] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activationTriggerRef = useRef(activationTrigger);
  const settingsRef = useRef(settings);
  const powersRef = useRef(powers);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { powersRef.current = powers; }, [powers]);

  const logAction = (message: string, data?: any) => {
    console.groupCollapsed(`[Assistant] ${message}`);
    if (data !== undefined) console.log(data);
    console.groupEnd();
  };

  const speak = useCallback((text: string, onEndCallback?: () => void) => {
    // Simplified speak function for brevity
    console.log(`[Assistant] Speaking: ${text}`);
    setIsSpeaking(true);
    setAiResponse(text);
    setTimeout(() => {
      setIsSpeaking(false);
      onEndCallback?.();
    }, 1000 + text.length * 50); // Simulate speech time
  }, []);

  const runConversation = useCallback(async (userMessage: string) => {
    logAction("Starting conversation with:", userMessage);
    setIsProcessing(true);
    setTranscript(userMessage);
    setAiResponse("");

    let currentHistory = [...messageHistory, { role: "user", content: userMessage }];
    setMessageHistory(currentHistory);

    try {
      for (let i = 0; i < 5; i++) { // Loop to handle multiple tool calls
        const { data: openAIResponse, error: invokeError } = await supabase.functions.invoke('openai', {
          body: {
            history: currentHistory,
            settings: settingsRef.current,
            powers: powersRef.current,
          },
        });

        if (invokeError) throw new Error(invokeError.message);

        const message = openAIResponse.choices[0].message;
        currentHistory = [...currentHistory, message];
        setMessageHistory(currentHistory);

        if (message.tool_calls) {
          logAction("AI requested tool calls:", message.tool_calls);
          speak("Um momento, estou processando sua solicitação...");

          const toolOutputs = await Promise.all(message.tool_calls.map(async (toolCall) => {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            logAction(`Executing tool: ${functionName}`, functionArgs);

            const power = powersRef.current.find(p => p.name === functionName);
            if (!power) {
              return { tool_call_id: toolCall.id, output: JSON.stringify({ error: `Poder "${functionName}" não encontrado.` }) };
            }

            const { data: toolResult, error: toolError } = await supabase.functions.invoke(functionName, {
              body: functionArgs
            });

            if (toolError) {
              return { tool_call_id: toolCall.id, output: JSON.stringify({ error: toolError.message }) };
            }
            return { tool_call_id: toolCall.id, output: JSON.stringify(toolResult) };
          }));

          const toolMessages = toolOutputs.map(output => ({
            tool_call_id: output.tool_call_id,
            role: "tool",
            name: message.tool_calls.find(tc => tc.id === output.tool_call_id)!.function.name,
            content: output.output,
          }));
          
          currentHistory = [...currentHistory, ...toolMessages];
          setMessageHistory(currentHistory);
        } else {
          logAction("AI final response:", message.content);
          speak(message.content);
          setIsProcessing(false);
          return;
        }
      }
      speak("Houve um problema ao processar sua solicitação com múltiplas etapas.");
    } catch (err: any) {
      logAction("Error in conversation:", err);
      speak("Desculpe, ocorreu um erro ao processar sua solicitação.");
    } finally {
      setIsProcessing(false);
    }
  }, [messageHistory, speak]);

  const startListening = useCallback(() => {
    if (micPermission !== "granted") {
      setIsPermissionModalOpen(true);
      return;
    }
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  }, [micPermission, isListening]);

  const requestMicPermission = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        setMicPermission("granted");
        setIsPermissionModalOpen(false);
        startListening();
      })
      .catch(() => setMicPermission("denied"));
  }, [startListening]);

  const openAssistant = useCallback(() => {
    setIsOpen(true);
    if (micPermission === "granted") {
      startListening();
    } else {
      setIsPermissionModalOpen(true);
    }
  }, [micPermission, startListening]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      openAssistant();
    }
  }, [activationTrigger, openAssistant]);

  useEffect(() => {
    if (loadingSystemContext || !effectiveWorkspace?.id) return;
    supabase.from("settings").select("*").eq("workspace_id", effectiveWorkspace.id).single()
      .then(({ data, error }) => {
        if (error) logAction("Error fetching settings:", error);
        else setSettings(data);
      });
  }, [effectiveWorkspace, loadingSystemContext]);

  useEffect(() => {
    navigator.permissions.query({ name: "microphone" as PermissionName }).then((result) => {
      setMicPermission(result.state as any);
      result.onchange = () => setMicPermission(result.state as any);
    });

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current!;
    recognition.continuous = false;
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') setMicPermission('denied');
    };
    recognition.onresult = (event) => {
      const command = event.results[event.results.length - 1][0].transcript.trim();
      runConversation(command);
    };
    return () => recognition.stop();
  }, [runConversation]);

  if (!isOpen) return null;

  return (
    <>
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
            {displayedAiResponse || (isListening ? "Ouvindo..." : "Pressione o microfone para falar")}
          </h2>
        </div>
        <div className="absolute bottom-10">
          <Button
            size="lg"
            className={cn("rounded-full h-20 w-20", isListening ? "bg-red-500" : "bg-cyan-500")}
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