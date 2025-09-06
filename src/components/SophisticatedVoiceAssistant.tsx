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
import { Mic, X, Zap } from "lucide-react";
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
  const { session } = useSession();
  const { systemVariables } = useSystem();
  const { activationTrigger } = useVoiceAssistant();
  const isMobile = useIsMobile();

  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessingTool, setIsProcessingTool] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState([]);
  const [powers, setPowers] = useState([]);
  const [clientActions, setClientActions] = useState([]);
  const [imageToShow, setImageToShow] = useState(null);
  const [urlToOpenInIframe, setUrlToOpenInIframe] = useState(null);
  const [micPermission, setMicPermission] = useState("checking");
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

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const audioRef = useRef(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

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

  const startListening = useCallback(() => {
    if (micPermission !== 'granted' || !recognitionRef.current || isListeningRef.current || isSpeakingRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.log("Recognition already started, ignoring.");
    }
  }, [micPermission]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) synthRef.current.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setAudioIntensity(0);
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, []);

  const setupAudioAnalysis = useCallback(() => {
    if (!audioContextRef.current) return;
    if (audioRef.current && (!sourceRef.current || sourceRef.current.mediaElement !== audioRef.current)) {
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContextRef.current.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioContextRef.current.destination);
      analyserRef.current = analyser;
      sourceRef.current = source;
    }
  }, []);

  const runAudioAnalysis = useCallback(() => {
    if (analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const normalized = Math.min(average / 128, 1.0);
      setAudioIntensity(normalized);
      animationFrameRef.current = requestAnimationFrame(runAudioAnalysis);
    }
  }, []);

  const speak = useCallback(async (text, onEndCallback) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }

    stopSpeaking();
    stopListening();
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setAiResponse(text);

    const onSpeechEnd = () => {
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        onEndCallback?.();
        if (isOpenRef.current) {
          startListening();
        }
      }
    };

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (e) => { console.error("SpeechSynthesis Error:", e); onSpeechEnd(); };
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: "tts-1", voice: currentSettings.openai_tts_voice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error(`OpenAI TTS API failed with status ${response.status}`);
        
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        audioRef.current = new Audio(audioUrl);
        setupAudioAnalysis();
        
        audioRef.current.onended = () => { URL.revokeObjectURL(audioUrl); onSpeechEnd(); };
        audioRef.current.onerror = (e) => { console.error("Audio playback error:", e); URL.revokeObjectURL(audioUrl); onSpeechEnd(); };
        
        await audioRef.current.play();
        runAudioAnalysis();
      } else {
        setTimeout(onSpeechEnd, 500);
      }
    } catch (error) {
      console.error("Error in speak function:", error);
      showError("Ocorreu um erro ao tentar falar.");
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening, setupAudioAnalysis, runAudioAnalysis]);

  const executePower = async (toolCall) => {
    const powerName = toolCall.function.name;
    const powerArgs = JSON.parse(toolCall.function.arguments);
    const powerDefinition = powersRef.current.find(p => p.name === powerName);

    if (!powerDefinition) {
      return { tool_call_id: toolCall.id, role: "tool", name: powerName, content: JSON.stringify({ error: `Poder '${powerName}' não encontrado.` }) };
    }

    try {
      const { url, method, headers, body } = powerDefinition;
      const processedUrl = replacePlaceholders(url, { ...systemVariablesRef.current, ...powerArgs });
      const processedHeaders = JSON.parse(replacePlaceholders(JSON.stringify(headers || {}), { ...systemVariablesRef.current, ...powerArgs }));
      const processedBody = JSON.parse(replacePlaceholders(JSON.stringify(body || {}), { ...systemVariablesRef.current, ...powerArgs }));

      const { data, error } = await supabase.functions.invoke('proxy-api', {
        body: { url: processedUrl, method, headers: processedHeaders, body: processedBody },
      });

      if (error) throw error;
      return { tool_call_id: toolCall.id, role: "tool", name: powerName, content: JSON.stringify(data) };
    } catch (err) {
      return { tool_call_id: toolCall.id, role: "tool", name: powerName, content: JSON.stringify({ error: err.message }) };
    }
  };

  const runConversation = useCallback(async (userMessage) => {
    setTranscript(userMessage);
    let newHistory = [...messageHistoryRef.current, { role: "user", content: userMessage }];
    setMessageHistory(newHistory);

    try {
      const { data, error } = await supabase.functions.invoke('openai', {
        body: { history: newHistory, settings: settingsRef.current, powers: powersRef.current },
      });
      if (error) throw new Error(error.message);

      const responseMessage = data.choices[0].message;
      newHistory.push(responseMessage);
      setMessageHistory(newHistory);

      if (responseMessage.tool_calls) {
        setIsProcessingTool(true);
        setAiResponse(`Executando: ${responseMessage.tool_calls[0].function.name}...`);
        const toolResults = await Promise.all(responseMessage.tool_calls.map(executePower));
        setIsProcessingTool(false);
        
        newHistory.push(...toolResults);
        setMessageHistory(newHistory);

        const { data: finalData, error: finalError } = await supabase.functions.invoke('openai', {
          body: { history: newHistory, settings: settingsRef.current, powers: powersRef.current },
        });
        if (finalError) throw new Error(finalError.message);

        const finalResponse = finalData.choices[0].message;
        setMessageHistory(prev => [...prev, finalResponse]);
        speak(finalResponse.content);
      } else {
        speak(responseMessage.content);
      }
    } catch (err) {
      console.error("Error in conversation:", err);
      speak("Desculpe, ocorreu um erro ao processar sua solicitação.");
    }
  }, [speak]);

  const handleManualActivation = useCallback(() => {
    if (micPermission !== "granted") {
      setIsPermissionModalOpen(true);
    } else {
      setIsOpen(true);
    }
  }, [micPermission]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    const initialize = async () => {
      // ... (initialization logic remains the same)
    };
    initialize();
    // ... (cleanup logic remains the same)
  }, [startListening, stopListening, stopSpeaking, runConversation]);

  useEffect(() => {
    if (isOpen) {
      const message = !hasBeenActivatedRef.current ? settingsRef.current?.welcome_message : settingsRef.current?.continuation_phrase;
      speak(message || "Olá!", () => {
        if (!hasBeenActivatedRef.current) {
          hasBeenActivatedRef.current = true;
          setHasBeenActivated(true);
        }
      });
    } else {
      stopSpeaking();
    }
  }, [isOpen, settings]);

  useEffect(() => {
    supabase.from("settings").select("*").limit(1).single().then(({ data }) => {
      if (data) setSettings(data);
    });
    supabase.from("powers").select("*").then(({ data }) => {
      if (data) setPowers(data);
    });
  }, []);

  const unlockAudio = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.error("Web Audio API is not supported in this browser.", e);
      }
    }
  }, []);

  if (isLoading) return null;

  return (
    <>
      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={async () => {
          unlockAudio();
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            setMicPermission("granted");
            setIsPermissionModalOpen(false);
            startListening();
          } catch {
            setMicPermission("denied");
          }
        }}
        onClose={() => setIsPermissionModalOpen(false)}
        permissionState={micPermission}
      />
      {imageToShow && <ImageModal imageUrl={imageToShow.imageUrl} altText={imageToShow.altText} onClose={() => setImageToShow(null)} />}
      {urlToOpenInIframe && <UrlIframeModal url={urlToOpenInIframe} onClose={() => setUrlToOpenInIframe(null)} />}
      <div
        className={cn(
          "fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 transition-opacity duration-500",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
          <AIScene audioIntensity={audioIntensity} isMobile={isMobile} />
        </div>
        <div />
        <div className="text-center select-text pointer-events-auto max-w-2xl mx-auto w-full">
          {isProcessingTool && (
            <div className="flex items-center justify-center text-cyan-300 mb-4">
              <Zap className="h-5 w-5 mr-2 animate-pulse" />
              <p>{aiResponse}</p>
            </div>
          )}
          {displayedAiResponse && !isProcessingTool && (
            <div className="bg-[rgba(30,35,70,0.5)] backdrop-blur-lg border border-cyan-400/20 rounded-xl p-6 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
              <p className="text-white text-2xl md:text-4xl font-bold leading-tight drop-shadow-lg">
                {displayedAiResponse}
              </p>
            </div>
          )}
          {transcript && (
            <p className="text-gray-200 text-lg mt-4 drop-shadow-md">{transcript}</p>
          )}
        </div>
        <div
          className={cn(
            "flex items-center justify-center gap-4 p-4 bg-[rgba(30,35,70,0.5)] backdrop-blur-lg border border-cyan-400/20 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.1)] pointer-events-auto transition-shadow duration-300",
            isListening ? "shadow-cyan-500/60" : "shadow-cyan-500/20"
          )}
        >
          <AudioVisualizer isSpeaking={isSpeaking} />
          <div
            className={cn(
              "p-4 bg-cyan-900/20 rounded-full border border-cyan-400/30 cursor-pointer transition-colors duration-300 hover:text-cyan-400 hover:drop-shadow-[0_0_12px_rgba(0,255,255,0.8)]",
              isListening ? "text-cyan-200" : "text-cyan-300"
            )}
          >
            <Mic className="h-8 w-8" />
          </div>
          <AudioVisualizer isSpeaking={isSpeaking} />
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;