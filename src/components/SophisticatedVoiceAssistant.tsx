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

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const audioRef = useRef(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentenceQueueRef = useRef<string[]>([]);
  const speechManagerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { hasBeenActivatedRef.current = hasBeenActivated; }, [hasBeenActivated]);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { clientActionsRef.current = clientActions; }, [clientActions]);
  useEffect(() => { systemVariablesRef.current = systemVariables; }, [systemVariables]);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { messageHistoryRef.current = messageHistory; }, [messageHistory]);

  const fetchAllAssistantData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: settingsData } = await supabase.from("settings").select("*").order('created_at', { ascending: true }).limit(1).single();
      setSettings(settingsData);
      const { data: powersData } = await supabase.from("powers").select("*");
      setPowers(powersData || []);
      const { data: actionsData } = await supabase.from("client_actions").select("*");
      setClientActions(actionsData || []);
      return settingsData;
    } catch (error) {
      showError("Erro ao carregar dados do assistente.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    if (isListeningRef.current || isSpeakingRef.current || stopPermanentlyRef.current || !recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("[ERROR] Error starting recognition:", e);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) synthRef.current.cancel();
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setAudioIntensity(0);
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    sentenceQueueRef.current = [];
    if (speechManagerTimeoutRef.current) clearTimeout(speechManagerTimeoutRef.current);
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

  const speakSingleSentence = useCallback(async (text, onEndCallback) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }

    const onSpeechEnd = () => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      onEndCallback?.();
    };

    isSpeakingRef.current = true;
    setIsSpeaking(true);

    const estimatedSpeechTime = (text.length / 15) * 1000 + 3000;
    speechTimeoutRef.current = setTimeout(onSpeechEnd, estimatedSpeechTime);

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (e) => { console.error("SpeechSynthesis Error:", e); onSpeechEnd(); };
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: "tts-1", voice: currentSettings.openai_tts_voice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error("Falha na API OpenAI TTS");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        setupAudioAnalysis();
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.onerror = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
        runAudioAnalysis();
      } else {
        onSpeechEnd();
      }
    } catch (e: any) {
      showError(`Erro na síntese de voz: ${e.message}`);
      onSpeechEnd();
    }
  }, [setupAudioAnalysis, runAudioAnalysis]);

  const speechManager = useCallback(() => {
    if (isSpeakingRef.current || sentenceQueueRef.current.length === 0) {
      if (speechManagerTimeoutRef.current) clearTimeout(speechManagerTimeoutRef.current);
      speechManagerTimeoutRef.current = setTimeout(speechManager, 100);
      return;
    }

    const sentenceToSpeak = sentenceQueueRef.current.shift();
    if (sentenceToSpeak) {
      speakSingleSentence(sentenceToSpeak, () => {
        if (sentenceQueueRef.current.length === 0) {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          setAudioIntensity(0);
          if (isOpenRef.current && !stopPermanentlyRef.current) startListening();
        } else {
          speechManager();
        }
      });
    }
  }, [speakSingleSentence, startListening]);

  const speak = useCallback((text, onEndCallback) => {
    stopSpeaking();
    stopListening();
    setAiResponse(text);
    sentenceQueueRef.current.push(text);
    speechManager();
    if (onEndCallback) {
      // This is tricky with queues. For now, we assume onEndCallback is for the whole speech.
      // A more robust solution would involve a queue of callbacks.
      const checkCompletion = () => {
        if (!isSpeakingRef.current && sentenceQueueRef.current.length === 0) {
          onEndCallback();
        } else {
          setTimeout(checkCompletion, 200);
        }
      };
      checkCompletion();
    }
  }, [stopSpeaking, stopListening, speechManager]);

  const executeClientAction = useCallback((action) => {
    stopListening();
    speak("Ok, executando.", () => {
      switch (action.action_type) {
        case 'OPEN_URL': window.open(action.action_payload.url, '_blank', 'noopener,noreferrer'); break;
        case 'SHOW_IMAGE': setImageToShow(action.action_payload); break;
        case 'OPEN_IFRAME_URL': setUrlToOpenInIframe(action.action_payload.url); break;
        default: console.warn(`Unknown client action type: ${action.action_type}`); break;
      }
    });
  }, [speak, stopListening]);

  const runConversation = useCallback(async (userMessage) => {
    if (!userMessage) return;
    setTranscript(userMessage);
    setAiResponse("");
    stopListening();

    const currentHistory = [...messageHistoryRef.current, { role: "user", content: userMessage }];
    setMessageHistory(currentHistory);
    
    const currentSettings = settingsRef.current;
    if (!currentSettings || !currentSettings.openai_api_key) {
      speak("Desculpe, a chave da API OpenAI não está configurada.");
      return;
    }

    const systemPrompt = replacePlaceholders(currentSettings.system_prompt, systemVariablesRef.current);
    const tools = powersRef.current.map(power => ({
      type: "function",
      function: { name: power.name, description: power.description, parameters: power.parameters_schema || { type: "object", properties: {} } },
    }));

    const requestBody = {
      model: currentSettings.ai_model,
      messages: [{ role: "system", content: systemPrompt }, ...currentHistory.slice(-currentSettings.conversation_memory_length)],
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      stream: true,
    };

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error(`OpenAI API Error: ${(await response.json()).error?.message}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let toolCalls = [];
      let sentenceBuffer = "";

      const processAndSpeakBuffer = (force = false) => {
        const punctuation = /[.!?]/;
        let splitPoint = -1;
        if (force) {
          splitPoint = sentenceBuffer.length;
        } else {
          const lastPunctuation = sentenceBuffer.search(punctuation);
          if (lastPunctuation !== -1) {
            splitPoint = lastPunctuation + 1;
          }
        }

        if (splitPoint > 0) {
          const sentence = sentenceBuffer.substring(0, splitPoint).trim();
          if (sentence) {
            sentenceQueueRef.current.push(sentence);
            speechManager();
          }
          sentenceBuffer = sentenceBuffer.substring(splitPoint);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (sentenceBuffer.trim()) processAndSpeakBuffer(true);
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6);
            if (dataStr === "[DONE]") break;
            
            try {
              const data = JSON.parse(dataStr);
              const delta = data.choices[0]?.delta;

              if (delta?.content) {
                fullResponse += delta.content;
                setAiResponse(current => current + delta.content);
                if (currentSettings.output_mode === 'streaming') {
                  sentenceBuffer += delta.content;
                  processAndSpeakBuffer();
                }
              }
              if (delta?.tool_calls) {
                delta.tool_calls.forEach(toolCall => {
                  if (!toolCalls[toolCall.index]) toolCalls[toolCall.index] = { id: "", type: "function", function: { name: "", arguments: "" } };
                  if (toolCall.id) toolCalls[toolCall.index].id = toolCall.id;
                  if (toolCall.function.name) toolCalls[toolCall.index].function.name = toolCall.function.name;
                  if (toolCall.function.arguments) toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                });
              }
            } catch (e) { console.error("Failed to parse stream chunk:", dataStr, e); }
          }
        }
      }

      const aiMessage = { role: "assistant", content: fullResponse, tool_calls: toolCalls.length > 0 ? toolCalls : undefined };
      setMessageHistory(prev => [...prev, aiMessage]);

      if (aiMessage.tool_calls?.length > 0) {
        // Tool call logic remains the same, but the final response will also be streamed.
        speak(`Ok, um momento enquanto eu acesso minhas ferramentas.`, async () => {
            const toolPromises = aiMessage.tool_calls.map(async (toolCall) => {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                const power = powersRef.current.find(p => p.name === functionName);
                if (!power) throw new Error(`Power "${functionName}" not found.`);
                const allVariables = { ...systemVariablesRef.current, ...functionArgs };
                const payload = {
                    url: replacePlaceholders(power.url, allVariables),
                    method: power.method,
                    headers: JSON.parse(replacePlaceholders(JSON.stringify(power.headers || {}), allVariables)),
                    body: { ...(power.body || {}), ...functionArgs }
                };
                const { data, error } = await supabaseAnon.functions.invoke('proxy-api', { body: payload });
                if (error) throw new Error(`Error invoking ${functionName}: ${error.message}`);
                return { tool_call_id: toolCall.id, role: "tool", name: functionName, content: JSON.stringify(data.data || data) };
            });
            const toolResponses = await Promise.all(toolPromises);
            const historyForSecondCall = [...currentHistory, aiMessage, ...toolResponses];
            setMessageHistory(historyForSecondCall);
            setAiResponse("");

            const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
                body: JSON.stringify({ model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...historyForSecondCall.slice(-currentSettings.conversation_memory_length)], stream: true }),
            });
            if (!secondResponse.ok) throw new Error(`OpenAI API Error: ${(await secondResponse.json()).error?.message}`);
            
            const secondReader = secondResponse.body.getReader();
            let finalResponseText = "";
            sentenceBuffer = "";
            while (true) {
                const { done, value } = await secondReader.read();
                if (done) {
                  if (sentenceBuffer.trim()) processAndSpeakBuffer(true);
                  break;
                }
                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.substring(6);
                        if (dataStr === "[DONE]") break;
                        try {
                            const data = JSON.parse(dataStr);
                            const delta = data.choices[0]?.delta?.content;
                            if (delta) {
                                finalResponseText += delta;
                                setAiResponse(current => current + delta);
                                if (currentSettings.output_mode === 'streaming') {
                                  sentenceBuffer += delta;
                                  processAndSpeakBuffer();
                                }
                            }
                        } catch (e) { console.error("Failed to parse second stream chunk:", dataStr, e); }
                    }
                }
            }
            setMessageHistory(prev => [...prev, { role: "assistant", content: finalResponseText }]);
            if (currentSettings.output_mode !== 'streaming') speak(finalResponseText);
        });
      } else {
        if (currentSettings.output_mode !== 'streaming') speak(fullResponse);
      }
    } catch (e: any) {
      speak(`Desculpe, não consegui processar sua solicitação.`);
      showError(`Erro na conversa: ${e.message}`);
    }
  }, [speak, stopListening]);

  const initializeAssistant = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicPermission("denied");
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";
    recognitionRef.current.onstart = () => { isListeningRef.current = true; setIsListening(true); };
    recognitionRef.current.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      if (!isSpeakingRef.current && !stopPermanentlyRef.current) startListening();
    };
    recognitionRef.current.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicPermission("denied");
        setIsPermissionModalOpen(true);
      }
    };
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      const currentSettings = settingsRef.current;
      if (!currentSettings) return;

      if (isOpenRef.current) {
        if (currentSettings.deactivation_phrases.some(p => transcript.includes(p.toLowerCase()))) {
          setIsOpen(false);
          stopSpeaking();
          return;
        }
        const matchedAction = clientActionsRef.current.find(a => transcript.includes(a.trigger_phrase.toLowerCase()));
        if (matchedAction) {
          executeClientAction(matchedAction);
          return;
        }
        runConversation(transcript);
      } else {
        if (currentSettings.activation_phrases.some(p => transcript.includes(p.toLowerCase()))) {
          fetchAllAssistantData().then((latestSettings) => {
            if (!latestSettings) return;
            setIsOpen(true);
            const message = hasBeenActivatedRef.current ? latestSettings.continuation_phrase : latestSettings.welcome_message;
            speak(message);
            setHasBeenActivated(true);
          });
        }
      }
    };
    if ("speechSynthesis" in window) synthRef.current = window.speechSynthesis;
  }, [executeClientAction, runConversation, speak, startListening, stopSpeaking, fetchAllAssistantData]);

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: "microphone" });
      setMicPermission(permissionStatus.state);
      if (permissionStatus.state === "granted") {
        if (!recognitionRef.current) initializeAssistant();
        startListening();
      } else {
        setIsPermissionModalOpen(true);
      }
      permissionStatus.onchange = () => setMicPermission(permissionStatus.state);
    } catch(e) {
      setMicPermission("denied");
    }
  }, [initializeAssistant, startListening]);

  const handleAllowMic = useCallback(async () => {
    setIsPermissionModalOpen(false);
    if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      if (!recognitionRef.current) initializeAssistant();
      startListening();
    } catch(e) {
      setMicPermission("denied");
      setIsPermissionModalOpen(true);
    }
  }, [initializeAssistant, startListening]);

  const handleManualActivation = useCallback(() => {
    if (isOpenRef.current) return;
    if (micPermission !== "granted") {
      checkAndRequestMicPermission();
    } else {
      fetchAllAssistantData().then((latestSettings) => {
        if (!latestSettings) return;
        setIsOpen(true);
        const message = hasBeenActivatedRef.current ? latestSettings.continuation_phrase : latestSettings.welcome_message;
        speak(message);
        setHasBeenActivated(true);
      });
    }
  }, [micPermission, checkAndRequestMicPermission, speak, fetchAllAssistantData]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    fetchAllAssistantData().then(() => checkAndRequestMicPermission());
    return () => {
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, [fetchAllAssistantData, checkAndRequestMicPermission]);

  if (isLoading || !settings) return null;

  const showTranscriptUI = settings.show_transcript;

  return (
    <>
      <MicrophonePermissionModal isOpen={isPermissionModalOpen} onAllow={handleAllowMic} onClose={() => setIsPermissionModalOpen(false)} permissionState={micPermission as 'prompt' | 'denied' | 'checking'} />
      {imageToShow && <ImageModal imageUrl={imageToShow.imageUrl} altText={imageToShow.altText} onClose={() => { setImageToShow(null); startListening(); }} />}
      {urlToOpenInIframe && <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); startListening(); }} />}
      <div className={cn("fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 transition-opacity duration-500", isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
          <AIScene audioIntensity={audioIntensity} isMobile={isMobile} />
        </div>
        <div />
        <div className="text-center select-text pointer-events-auto max-w-2xl mx-auto w-full">
          {showTranscriptUI && aiResponse && (
            <div className="bg-[rgba(30,35,70,0.5)] backdrop-blur-lg border border-cyan-400/20 rounded-xl p-6 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
              <p className="text-white text-2xl md:text-4xl font-bold leading-tight drop-shadow-lg">{aiResponse}</p>
            </div>
          )}
          {showTranscriptUI && transcript && (
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