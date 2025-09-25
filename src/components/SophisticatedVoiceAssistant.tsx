"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { showError } from "@/utils/toast";
import { supabase, supabaseAnon } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useSystem } from "@/contexts/SystemContext";
import { replacePlaceholders } from "@/lib/utils";
import { AudioVisualizer } from "./AudioVisualizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, X } from "lucide-react";
import { UrlIframeModal } from "./UrlIframeModal";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import Orb from "./Orb";
import { useIsMobile } from "@/hooks/use-mobile";
import { createClient, LiveClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";

const ImageModal = ({ imageUrl, altText, onClose }: { imageUrl: string, altText: string, onClose: () => void }) => (
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

  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState<any[]>([]);
  const [powers, setPowers] = useState<any[]>([]);
  const [clientActions, setClientActions] = useState<any[]>([]);
  const [imageToShow, setImageToShow] = useState<any>(null);
  const [urlToOpenInIframe, setUrlToOpenInIframe] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState("checking");
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [hasBeenActivated, setHasBeenActivated] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);

  // Refs
  const settingsRef = useRef(settings);
  const isOpenRef = useRef(isOpen);
  const isListeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const hasBeenActivatedRef = useRef(hasBeenActivated);
  const powersRef = useRef(powers);
  const clientActionsRef = useRef(clientActions);
  const systemVariablesRef = useRef(systemVariables);
  const sessionRef = useRef(session);
  const messageHistoryRef = useRef(messageHistory);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Streaming Refs
  const sttConnectionRef = useRef<LiveClient | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingAudioRef = useRef(false);

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync refs with state
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { 
    isOpenRef.current = isOpen;
    console.log(`[ASSISTANT] State changed: isOpen = ${isOpen}`);
  }, [isOpen]);
  useEffect(() => { hasBeenActivatedRef.current = hasBeenActivated; }, [hasBeenActivated]);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { clientActionsRef.current = clientActions; }, [clientActions]);
  useEffect(() => { systemVariablesRef.current = systemVariables; }, [systemVariables]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { messageHistoryRef.current = messageHistory; }, [messageHistory]);

  const fetchAllAssistantData = useCallback(async () => {
    console.log("[ASSISTANT] Fetching all assistant data...");
    setIsLoading(true);
    try {
      const { data: settingsData, error: settingsError } = await supabaseAnon
        .from("settings")
        .select("*")
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      
      if (settingsError) throw settingsError;
      setSettings(settingsData);
      console.log("[ASSISTANT] Settings loaded:", settingsData);

      const workspaceId = settingsData.workspace_id;

      const { data: powersData } = await supabaseAnon.from("powers").select("*").eq('workspace_id', workspaceId);
      setPowers(powersData || []);
      console.log("[ASSISTANT] Powers loaded:", powersData);

      const { data: actionsData } = await supabaseAnon.from("client_actions").select("*").eq('workspace_id', workspaceId);
      setClientActions(actionsData || []);
      console.log("[ASSISTANT] Client Actions loaded:", actionsData);

    } catch (error) {
      console.error("[ERROR] Failed to fetch assistant data:", error);
      showError("Erro ao carregar dados do assistente.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      console.log("[SPEECH] Stopping listening.");
      recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    if (isListeningRef.current || isSpeakingRef.current || stopPermanentlyRef.current || !recognitionRef.current) {
      return;
    }
    try {
      console.log("[SPEECH] Starting listening.");
      recognitionRef.current.start();
    } catch (e) {
      console.error("[ERROR] Error starting recognition:", e);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking || (audioRef.current && !audioRef.current.paused)) {
      console.log("[SPEECH] Stopping speech.");
    }
    if (synthRef.current?.speaking) synthRef.current.cancel();
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioIntensity(0);
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
  }, []);

  const setupAudioAnalysis = useCallback(() => {
    if (!audioContextRef.current) return;
    if (audioRef.current && !sourceRef.current) {
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

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }

    const onSpeechEnd = () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
      if (isSpeakingRef.current) {
        console.log("[SPEECH] Speech finished.");
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setAudioIntensity(0);
        onEndCallback?.();
        if (isOpenRef.current && !stopPermanentlyRef.current) {
          startListening();
        }
      }
    };

    stopSpeaking();
    stopListening();

    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setAiResponse(text);
    console.log(`[SPEECH] Speaking: "${text}"`);

    const estimatedSpeechTime = (text.length / 15) * 1000 + 3000;
    speechTimeoutRef.current = setTimeout(onSpeechEnd, estimatedSpeechTime);

    try {
      let audioBlob;
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        console.log("[SPEECH] Using browser Web Speech API for synthesis.");
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (e) => { 
          console.error("[ERROR] SpeechSynthesis Error:", e); 
          onSpeechEnd(); 
        };
        // This is a robust way to handle synthesis
        try {
          synthRef.current.speak(utterance);
        } catch (e) {
          console.error("[ERROR] synth.speak failed:", e);
          onSpeechEnd();
        }
        return;
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        console.log("[SPEECH] Using OpenAI TTS API for synthesis.");
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: "tts-1", voice: currentSettings.openai_tts_voice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error("Falha na API OpenAI TTS");
        audioBlob = await response.blob();
      } else if (currentSettings.voice_model === "google-tts" && currentSettings.google_tts_api_key) {
        console.log("[SPEECH] Using Google TTS API via proxy.");
        const { data, error } = await supabaseAnon.functions.invoke('google-tts-proxy', {
          body: { text },
        });
        if (error) throw new Error(`Google TTS proxy error: ${error.message}`);
        audioBlob = data;
      } else if (currentSettings.voice_model === "deepgram" && currentSettings.deepgram_api_key) {
        console.log("[SPEECH] Using Deepgram TTS API via proxy.");
        const { data, error } = await supabaseAnon.functions.invoke('deepgram-proxy', {
          body: { action: 'tts', text },
        });
        if (error) throw new Error(`Deepgram TTS proxy error: ${error.message}`);
        audioBlob = data;
      } else {
        console.warn("[SPEECH] No voice model configured or key is missing. Skipping speech.");
        onSpeechEnd();
        return;
      }

      if (audioBlob) {
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        setupAudioAnalysis();
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.onerror = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
        runAudioAnalysis();
      }

    } catch (e: any) {
      console.error("[ERROR] Speech synthesis failed:", e);
      showError(`Erro na síntese de voz: ${e.message}`);
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening, setupAudioAnalysis, runAudioAnalysis]);

  const executeClientAction = useCallback((action: any) => {
    console.log(`[ACTION] Executing client action: ${action.action_type}`, action.action_payload);
    stopListening();
    speak("Ok, executando.", () => {
      switch (action.action_type) {
        case 'OPEN_URL': window.open(action.action_payload.url, '_blank', 'noopener,noreferrer'); break;
        case 'SHOW_IMAGE': setImageToShow(action.action_payload); break;
        case 'OPEN_IFRAME_URL': setUrlToOpenInIframe(action.action_payload.url); break;
        default: console.warn(`[ACTION] Unknown client action type: ${action.action_type}`); break;
      }
    });
  }, [speak, stopListening]);

  const runConversation = useCallback(async (userMessage: string) => {
    if (!userMessage) return;
    console.log(`[AI] Starting conversation with user message: "${userMessage}"`);
    setTranscript(userMessage);
    setAiResponse("");
    stopListening();

    const currentHistory = [...messageHistoryRef.current, { role: "user", content: userMessage }];
    setMessageHistory(currentHistory);
    
    const currentSettings = settingsRef.current;
    if (!currentSettings) {
        showError("Configurações não carregadas.");
        return;
    }
    const isGemini = currentSettings.ai_model.startsWith('gemini');
    
    const hasApiKey = isGemini ? !!currentSettings.gemini_api_key : !!currentSettings.openai_api_key;
    if (!hasApiKey) {
      const errorMsg = `Desculpe, a chave da API para ${isGemini ? 'Gemini' : 'OpenAI'} não está configurada.`;
      console.error(`[ERROR] API key for ${isGemini ? 'Gemini' : 'OpenAI'} is not configured.`);
      speak(errorMsg);
      showError(errorMsg);
      return;
    }

    const systemPrompt = replacePlaceholders(currentSettings.system_prompt, systemVariablesRef.current);
    const tools = powersRef.current.map(power => ({
      type: "function",
      function: { name: power.name, description: power.description, parameters: power.parameters_schema || { type: "object", properties: {} } },
    }));

    try {
      let response;
      console.log(`[AI] Calling ${isGemini ? 'Gemini' : 'OpenAI'}...`);
      if (isGemini) {
        const { data, error } = await supabaseAnon.functions.invoke('gemini-proxy', {
          body: {
            model: currentSettings.ai_model,
            messages: [{ role: "system", content: systemPrompt }, ...currentHistory.slice(-currentSettings.conversation_memory_length)],
            tools: tools.length > 0 ? tools : undefined,
          }
        });
        if (error) throw new Error(`Gemini proxy error: ${error.message}`);
        response = data;
      } else {
        const requestBody = {
          model: currentSettings.ai_model,
          messages: [{ role: "system", content: systemPrompt }, ...currentHistory.slice(-currentSettings.conversation_memory_length)],
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
          stream: true,
        };
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`OpenAI API Error: ${errorData.error?.message || JSON.stringify(errorData)}`);
        }
      }

      if (!response.body) {
        throw new Error("A resposta da API não continha um corpo para streaming.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        
        if (isGemini) {
            try {
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6);
                        const parsed = JSON.parse(jsonStr);
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            fullResponse += text;
                            setAiResponse(current => current + text);
                        }
                    }
                }
            } catch (e) {
                console.warn("Could not parse Gemini chunk:", chunk);
            }
        } else {
            const lines = chunk.split("\n");
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const dataStr = line.substring(6);
                    if (dataStr === "[DONE]") break;
                    try {
                        const data = JSON.parse(dataStr);
                        const delta = data.choices[0]?.delta?.content;
                        if (delta) {
                            fullResponse += delta;
                            setAiResponse(current => current + delta);
                        }
                    } catch (e) {
                        console.error("[ERROR] Failed to parse OpenAI stream chunk:", dataStr, e);
                    }
                }
            }
        }
      }

      setMessageHistory(prev => [...prev, { role: "assistant", content: fullResponse }]);
      speak(fullResponse);

    } catch (e: any) {
      console.error("[ERROR] Error in runConversation:", e);
      const errorMsg = `Desculpe, não consegui processar sua solicitação.`;
      speak(errorMsg);
      showError(`Erro na conversa: ${e.message}`);
    }
  }, [speak, stopListening]);

  const initializeAssistant = useCallback(() => {
    console.log("[ASSISTANT] Initializing...");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("[ERROR] Speech Recognition not supported by this browser.");
      showError("Reconhecimento de voz não suportado.");
      setMicPermission("denied");
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";
    recognitionRef.current.onstart = () => { isListeningRef.current = true; setIsListening(true); console.log("[SPEECH] Recognition started."); };
    recognitionRef.current.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      console.log("[SPEECH] Recognition ended.");
      if (!isSpeakingRef.current && !stopPermanentlyRef.current) startListening();
    };
    recognitionRef.current.onerror = (e: any) => {
      console.error("[ERROR] Speech Recognition Error:", e.error, e.message);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicPermission("denied");
        setIsPermissionModalOpen(true);
      }
    };
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      console.log(`[USER] Recognized transcript: "${transcript}"`);
      
      const currentSettings = settingsRef.current;
      if (!currentSettings) return;

      if (isOpenRef.current) {
        const closePhrases = currentSettings.deactivation_phrases || [];
        if (closePhrases.some((phrase: string) => transcript.includes(phrase.toLowerCase()))) {
          console.log("[USER] Close phrase detected. Closing assistant.");
          setIsOpen(false);
          setAiResponse("");
          setTranscript("");
          stopSpeaking();
          return;
        }
        const matchedAction = clientActionsRef.current.find((a) => transcript.includes(a.trigger_phrase.toLowerCase()));
        if (matchedAction) {
          console.log(`[USER] Client action triggered by phrase: "${matchedAction.trigger_phrase}"`);
          executeClientAction(matchedAction);
          return;
        }
        runConversation(transcript);
      } else {
        const activationPhrases = currentSettings.activation_phrases || [];
        if (activationPhrases.some((phrase: string) => transcript.includes(phrase.toLowerCase()))) {
          console.log(`[USER] Activation phrase detected.`);
          setIsOpen(true);
          const messageToSpeak = hasBeenActivatedRef.current && currentSettings.continuation_phrase ? currentSettings.continuation_phrase : currentSettings.welcome_message;
          speak(messageToSpeak);
          setHasBeenActivated(true);
        }
      }
    };
    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      // Warm-up call to prevent initial errors on some browsers
      if (synthRef.current.getVoices().length === 0) {
        synthRef.current.onvoiceschanged = () => {
          console.log("[ASSISTANT] Speech Synthesis voices loaded.");
        };
      } else {
         console.log("[ASSISTANT] Speech Synthesis initialized.");
      }
    }
  }, [executeClientAction, runConversation, speak, startListening, stopSpeaking]);

  const checkAndRequestMicPermission = useCallback(async () => {
    console.log("[ASSISTANT] Checking microphone permission...");
    try {
      const permissionStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
      console.log(`[ASSISTANT] Microphone permission status: ${permissionStatus.state}`);
      setMicPermission(permissionStatus.state);
      if (permissionStatus.state === "granted") {
        if (!recognitionRef.current) initializeAssistant();
        startListening();
      } else {
        setIsPermissionModalOpen(true);
      }
      permissionStatus.onchange = () => {
        console.log(`[ASSISTANT] Microphone permission status changed to: ${permissionStatus.state}`);
        setMicPermission(permissionStatus.state);
      }
    } catch(e) {
      console.error("[ERROR] Could not query microphone permission:", e);
      setMicPermission("denied");
    }
  }, [initializeAssistant, startListening]);

  const handleAllowMic = useCallback(async () => {
    console.log("[USER] Clicked 'Allow Microphone'.");
    setIsPermissionModalOpen(false);
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[ASSISTANT] Microphone access granted by user.");
      setMicPermission("granted");
      if (!recognitionRef.current) initializeAssistant();
      startListening();
    } catch(e) {
      console.error("[ERROR] User denied microphone access or an error occurred:", e);
      setMicPermission("denied");
      setIsPermissionModalOpen(true);
    }
  }, [initializeAssistant, startListening]);

  const handleManualActivation = useCallback(() => {
    console.log("[USER] Manually activating assistant.");
    // This is a user gesture, so we can safely resume the audio context.
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    if (isOpenRef.current) return;
    if (micPermission !== "granted") {
      checkAndRequestMicPermission();
    } else {
      setIsOpen(true);
      const messageToSpeak = hasBeenActivatedRef.current && settingsRef.current.continuation_phrase ? settingsRef.current.continuation_phrase : settingsRef.current.welcome_message;
      speak(messageToSpeak);
      setHasBeenActivated(true);
    }
  }, [micPermission, checkAndRequestMicPermission, speak, startListening]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    console.log("[ASSISTANT] Component mounted.");
    if (!audioContextRef.current) {
      audioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    }
    
    fetchAllAssistantData().then(() => {
      checkAndRequestMicPermission();
    });

    return () => {
      console.log("[ASSISTANT] Component unmounting. Cleaning up...");
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, [fetchAllAssistantData, checkAndRequestMicPermission]);

  if (isLoading || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={handleAllowMic}
        onClose={() => setIsPermissionModalOpen(false)}
        permissionState={micPermission as 'prompt' | 'denied' | 'checking'}
      />
      {imageToShow && (
        <ImageModal imageUrl={imageToShow.imageUrl} altText={imageToShow.altText} onClose={() => { setImageToShow(null); startListening(); }} />
      )}
      {urlToOpenInIframe && (
        <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); startListening(); }} />
      )}
      <div
        className={cn(
          "fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 transition-opacity duration-500",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 -z-20 pointer-events-none bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <Orb audioIntensity={audioIntensity} />
        </div>
        <div />
        <div className="text-center select-text pointer-events-auto max-w-2xl mx-auto w-full">
          {aiResponse && (
            <div className="bg-[rgba(30,35,70,0.5)] backdrop-blur-lg border border-cyan-400/20 rounded-xl p-6 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
              <p className="text-white text-2xl md:text-4xl font-bold leading-tight drop-shadow-lg">
                {aiResponse}
              </p>
            </div>
          )}
          {transcript && (
            <p className="text-gray-200 text-lg mt-4 drop-shadow-md">{transcript}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-4 p-4 bg-[rgba(30,35,70,0.5)] backdrop-blur-lg border border-cyan-400/20 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.1)] pointer-events-auto">
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