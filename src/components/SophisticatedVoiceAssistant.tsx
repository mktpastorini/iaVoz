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

const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";
const DEEPGRAM_TTS_API_URL = "https://api.deepgram.com/v1/speak?model=aura-asteria-pt-br";
const GOOGLE_TTS_API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

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
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioChunkQueue = useRef<ArrayBuffer[]>([]);
  const isAppendingBuffer = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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
      const { data } = await supabase.from("settings").select("*").order('created_at', { ascending: true }).limit(1).single();
      setSettings(data);
      const { data: powersData } = await supabase.from("powers").select("*");
      setPowers(powersData || []);
      const { data: actionsData } = await supabase.from("client_actions").select("*");
      setClientActions(actionsData || []);
      return data;
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
      console.error("Error starting recognition:", e);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) synthRef.current.cancel();
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.src = '';
      }
    }
    if (mediaSourceRef.current?.readyState === 'open') {
      try { mediaSourceRef.current.endOfStream(); } catch (e) { console.warn("Error ending MediaSource stream:", e); }
    }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    audioChunkQueue.current = [];
    isAppendingBuffer.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setAudioIntensity(0);
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
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
      setAudioIntensity(Math.min(average / 128, 1.0));
      animationFrameRef.current = requestAnimationFrame(runAudioAnalysis);
    }
  }, []);

  const playStreamedAudio = useCallback(async (response: Response, onEnd: () => void) => {
    if (!('MediaSource' in window) || !response.body) {
      showError("Streaming de áudio não é suportado neste navegador.");
      onEnd();
      return;
    }
    audioRef.current = new Audio();
    setupAudioAnalysis();
    mediaSourceRef.current = new MediaSource();
    audioRef.current.src = URL.createObjectURL(mediaSourceRef.current);
    audioRef.current.onended = onEnd;
    audioRef.current.onerror = onEnd;

    mediaSourceRef.current.addEventListener('sourceopen', async () => {
      if (!mediaSourceRef.current) return;
      const mimeCodec = 'audio/mpeg';
      sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(mimeCodec);
      const processQueue = () => {
        if (!isAppendingBuffer.current && audioChunkQueue.current.length > 0 && sourceBufferRef.current && !sourceBufferRef.current.updating) {
          isAppendingBuffer.current = true;
          const chunk = audioChunkQueue.current.shift();
          if (chunk) try { sourceBufferRef.current.appendBuffer(chunk); } catch (e) { isAppendingBuffer.current = false; }
          else isAppendingBuffer.current = false;
        }
      };
      sourceBufferRef.current.addEventListener('updateend', () => {
        isAppendingBuffer.current = false;
        if (audioChunkQueue.current.length > 0) processQueue();
        else if (mediaSourceRef.current?.readyState === 'open' && !isAppendingBuffer.current) {
          try { mediaSourceRef.current.endOfStream(); } catch (e) { console.warn("Error ending stream:", e); }
        }
      });
      const reader = response.body!.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        audioChunkQueue.current.push(value.buffer);
        processQueue();
      }
    });
    await audioRef.current.play();
    runAudioAnalysis();
  }, [setupAudioAnalysis, runAudioAnalysis]);

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) { onEndCallback?.(); return; }
    const onSpeechEnd = () => {
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setAudioIntensity(0);
        onEndCallback?.();
        if (isOpenRef.current && !stopPermanentlyRef.current) startListening();
      }
    };
    stopSpeaking();
    stopListening();
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setAiResponse(text);

    try {
      const useStreaming = currentSettings.enable_streaming_voice;
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        const response = await fetch(OPENAI_TTS_API_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` }, body: JSON.stringify({ model: "tts-1", voice: currentSettings.openai_tts_voice || "alloy", input: text, response_format: useStreaming ? "mp3" : undefined }) });
        if (!response.ok) throw new Error("Falha na API OpenAI TTS");
        if (useStreaming) await playStreamedAudio(response, onSpeechEnd);
        else {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          audioRef.current = new Audio(audioUrl);
          setupAudioAnalysis();
          audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
          await audioRef.current.play();
          runAudioAnalysis();
        }
      } else if (currentSettings.voice_model === "deepgram" && currentSettings.deepgram_api_key) {
        const response = await fetch(DEEPGRAM_TTS_API_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Token ${currentSettings.deepgram_api_key}` }, body: JSON.stringify({ text }) });
        if (!response.ok) throw new Error("Falha na API Deepgram TTS");
        await playStreamedAudio(response, onSpeechEnd);
      } else if (currentSettings.voice_model === "google-tts" && currentSettings.google_tts_api_key) {
        const response = await fetch(`${GOOGLE_TTS_API_URL}?key=${currentSettings.google_tts_api_key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: { text }, voice: { languageCode: "pt-BR", name: "pt-BR-Wavenet-A" }, audioConfig: { audioEncoding: "MP3" } }) });
        if (!response.ok) throw new Error("Falha na API Google TTS");
        const data = await response.json();
        const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        setupAudioAnalysis();
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
        runAudioAnalysis();
      } else {
        onSpeechEnd();
      }
    } catch (e: any) {
      showError(`Erro na síntese de voz: ${e.message}`);
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening, setupAudioAnalysis, runAudioAnalysis, playStreamedAudio]);

  const executeClientAction = useCallback((action: any) => {
    stopListening();
    speak("Ok, executando.", () => {
      switch (action.action_type) {
        case 'OPEN_URL': window.open(action.action_payload.url, '_blank', 'noopener,noreferrer'); break;
        case 'SHOW_IMAGE': setImageToShow(action.action_payload); break;
        case 'OPEN_IFRAME_URL': setUrlToOpenInIframe(action.action_payload.url); break;
      }
    });
  }, [speak, stopListening]);

  const runConversation = useCallback(async (userMessage: string) => {
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
    const tools = powersRef.current.map(p => ({ type: "function", function: { name: p.name, description: p.description, parameters: p.parameters_schema || { type: "object", properties: {} } } }));
    const requestBody = { model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...currentHistory.slice(-currentSettings.conversation_memory_length)], tools: tools.length ? tools : undefined, tool_choice: tools.length ? "auto" : undefined, stream: true };
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` }, body: JSON.stringify(requestBody) });
      if (!response.ok) throw new Error(`OpenAI API Error: ${(await response.json()).error?.message}`);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let toolCalls: any[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6);
            if (dataStr === "[DONE]") break;
            try {
              const data = JSON.parse(dataStr);
              const delta = data.choices[0]?.delta;
              if (delta?.content) { fullResponse += delta.content; setAiResponse(c => c + delta.content); }
              if (delta?.tool_calls) {
                delta.tool_calls.forEach((tc: any) => {
                  if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: "", type: "function", function: { name: "", arguments: "" } };
                  if (tc.id) toolCalls[tc.index].id = tc.id;
                  if (tc.function.name) toolCalls[tc.index].function.name = tc.function.name;
                  if (tc.function.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                });
              }
            } catch (e) { console.error("Failed to parse stream chunk:", dataStr, e); }
          }
        }
      }
      const aiMessage = { role: "assistant", content: fullResponse, tool_calls: toolCalls.length ? toolCalls : undefined };
      const newHistory = [...currentHistory, aiMessage];
      setMessageHistory(newHistory);
      if (aiMessage.tool_calls) {
        speak(`Ok, um momento enquanto eu acesso minhas ferramentas.`, async () => {
          const toolPromises = aiMessage.tool_calls!.map(async (tc) => {
            const power = powersRef.current.find(p => p.name === tc.function.name);
            if (!power) return { tool_call_id: tc.id, role: "tool", name: tc.function.name, content: JSON.stringify({ error: "Power not found" }) };
            const args = JSON.parse(tc.function.arguments);
            const allVars = { ...systemVariablesRef.current, ...args };
            const payload = { url: replacePlaceholders(power.url, allVars), method: power.method, headers: JSON.parse(replacePlaceholders(JSON.stringify(power.headers || {}), allVars)), body: { ...(power.body || {}), ...args } };
            const { data, error } = await supabaseAnon.functions.invoke('proxy-api', { body: payload });
            return { tool_call_id: tc.id, role: "tool", name: tc.function.name, content: JSON.stringify(error ? { error: error.message } : (data.data || data)) };
          });
          const toolResponses = await Promise.all(toolPromises);
          const historyForSecondCall = [...newHistory, ...toolResponses];
          setMessageHistory(historyForSecondCall);
          setAiResponse("");
          const secondReqBody = { model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...historyForSecondCall.slice(-currentSettings.conversation_memory_length)], stream: true };
          const secondRes = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` }, body: JSON.stringify(secondReqBody) });
          if (!secondRes.ok) throw new Error(`OpenAI API Error: ${(await secondRes.json()).error?.message}`);
          const secondReader = secondRes.body!.getReader();
          let finalResponse = "";
          while (true) {
            const { done, value } = await secondReader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                const dataStr = line.substring(6);
                if (dataStr === "[DONE]") break;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.choices[0]?.delta?.content) { finalResponse += data.choices[0].delta.content; setAiResponse(c => c + data.choices[0].delta.content); }
                } catch (e) { console.error("Failed to parse second stream chunk:", dataStr, e); }
              }
            }
          }
          setMessageHistory(p => [...p, { role: "assistant", content: finalResponse }]);
          speak(finalResponse);
        });
      } else {
        speak(fullResponse);
      }
    } catch (e: any) {
      speak(`Desculpe, não consegui processar sua solicitação.`);
      showError(`Erro na conversa: ${e.message}`);
    }
  }, [speak, stopListening]);

  const initializeAssistant = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setMicPermission("denied"); return; }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";
    recognitionRef.current.onstart = () => { isListeningRef.current = true; setIsListening(true); };
    recognitionRef.current.onend = () => { isListeningRef.current = false; setIsListening(false); if (!isSpeakingRef.current && !stopPermanentlyRef.current) startListening(); };
    recognitionRef.current.onerror = (e: any) => { if (e.error === "not-allowed") { setMicPermission("denied"); setIsPermissionModalOpen(true); } };
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      const currentSettings = settingsRef.current;
      if (!currentSettings) return;
      if (isOpenRef.current) {
        if (currentSettings.deactivation_phrases?.some((p: string) => transcript.includes(p.toLowerCase()))) {
          setIsOpen(false); stopSpeaking(); return;
        }
        const action = clientActionsRef.current.find(a => transcript.includes(a.trigger_phrase.toLowerCase()));
        if (action) executeClientAction(action);
        else runConversation(transcript);
      } else {
        if (currentSettings.activation_phrases?.some((p: string) => transcript.includes(p.toLowerCase()))) {
          fetchAllAssistantData().then(latestSettings => {
            if (!latestSettings) return;
            setIsOpen(true);
            speak(hasBeenActivatedRef.current ? latestSettings.continuation_phrase : latestSettings.welcome_message);
            setHasBeenActivated(true);
          });
        }
      }
    };
    if ("speechSynthesis" in window) synthRef.current = window.speechSynthesis;
  }, [executeClientAction, runConversation, speak, startListening, stopSpeaking, fetchAllAssistantData]);

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setMicPermission(permission.state);
      if (permission.state === "granted") {
        if (!recognitionRef.current) initializeAssistant();
        startListening();
      } else {
        setIsPermissionModalOpen(true);
      }
      permission.onchange = () => setMicPermission(permission.state);
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
    if (micPermission !== "granted") checkAndRequestMicPermission();
    else {
      fetchAllAssistantData().then(latestSettings => {
        if (!latestSettings) return;
        setIsOpen(true);
        speak(hasBeenActivatedRef.current ? latestSettings.continuation_phrase : latestSettings.welcome_message);
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
    if (!audioContextRef.current) audioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    fetchAllAssistantData().then(() => checkAndRequestMicPermission());
    return () => {
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, [fetchAllAssistantData, checkAndRequestMicPermission]);

  if (isLoading || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal isOpen={isPermissionModalOpen} onAllow={handleAllowMic} onClose={() => setIsPermissionModalOpen(false)} permissionState={micPermission as 'prompt' | 'denied' | 'checking'} />
      {imageToShow && <ImageModal imageUrl={imageToShow.imageUrl} altText={imageToShow.altText} onClose={() => { setImageToShow(null); startListening(); }} />}
      {urlToOpenInIframe && <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); startListening(); }} />}
      <div className={cn("fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 transition-opacity duration-500", isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
        <div className="absolute inset-0 -z-20 pointer-events-none bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
        <div className="absolute inset-0 -z-10 pointer-events-none"><Orb audioIntensity={audioIntensity} /></div>
        <div />
        <div className="text-center select-text pointer-events-auto max-w-2xl mx-auto w-full">
          {aiResponse && <div className="bg-[rgba(30,35,70,0.5)] backdrop-blur-lg border border-cyan-400/20 rounded-xl p-6 shadow-[0_0_20px_rgba(0,255,255,0.1)]"><p className="text-white text-2xl md:text-4xl font-bold leading-tight drop-shadow-lg">{aiResponse}</p></div>}
          {transcript && <p className="text-gray-200 text-lg mt-4 drop-shadow-md">{transcript}</p>}
        </div>
        <div className="flex items-center justify-center gap-4 p-4 bg-[rgba(30,35,70,0.5)] backdrop-blur-lg border border-cyan-400/20 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.1)] pointer-events-auto">
          <AudioVisualizer isSpeaking={isSpeaking} />
          <div className="p-4 bg-cyan-900/20 rounded-full border border-cyan-400/30"><Mic className={cn("h-8 w-8 text-cyan-300 transition-all", isListening && "text-cyan-200 animate-pulse drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]")} /></div>
          <AudioVisualizer isSpeaking={isSpeaking} />
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;