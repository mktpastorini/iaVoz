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
import { useIsMobile } from "@/hooks/use-mobile";
import { OrbScene } from "./OrbScene"; // Importar o novo OrbScene

const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";
const STREAMING_STT_FUNCTION_URL = `wss://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/streaming-stt`;

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
  const isMobile = useIsMobile(); // Mantido caso precise para outros elementos da UI

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
  const [interimTranscript, setInterimTranscript] = useState("");

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

  // Streaming Refs
  const sttSocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isStreamingRef = useRef(false);

  // Web Audio API refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

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
      const { data: settingsData, error } = await supabase
        .from("settings")
        .select("*")
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;

      setSettings(settingsData);
      console.log("[ASSISTANT] Settings loaded:", settingsData);

      const { data: powersData } = await supabase.from("powers").select("*");
      setPowers(powersData || []);
      console.log("[ASSISTANT] Powers loaded:", powersData);

      const { data: actionsData } = await supabase.from("client_actions").select("*");
      setClientActions(actionsData || []);
      console.log("[ASSISTANT] Client Actions loaded:", actionsData);

      return settingsData;
    } catch (error) {
      console.error("[ERROR] Failed to fetch assistant data:", error);
      showError("Erro ao carregar dados do assistente.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      console.log("[SPEECH] Stopping local listening.");
      recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    if (isListeningRef.current || isSpeakingRef.current || stopPermanentlyRef.current || !recognitionRef.current) {
      return;
    }
    try {
      console.log("[SPEECH] Starting local listening.");
      recognitionRef.current.start();
    } catch (e) {
      console.error("[ERROR] Error starting local recognition:", e);
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

  const speak = useCallback(async (text, onEndCallback) => {
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
          if (settingsRef.current?.input_mode === 'streaming') {
            startStreaming();
          } else {
            startListening();
          }
        }
      }
    };

    stopSpeaking();
    stopListening();
    stopStreaming();

    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setAiResponse(text);
    console.log(`[SPEECH] Speaking: "${text}"`);

    const estimatedSpeechTime = (text.length / 15) * 1000 + 3000;
    speechTimeoutRef.current = setTimeout(onSpeechEnd, estimatedSpeechTime);

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        console.log("[SPEECH] Using browser Web Speech API for synthesis.");
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (e) => { console.error("[ERROR] SpeechSynthesis Error:", e); onSpeechEnd(); };
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        console.log("[SPEECH] Using OpenAI TTS API for synthesis.");
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
        audioRef.current.onerror = (e) => { console.error("[ERROR] HTML Audio Element Error:", e); onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
        runAudioAnalysis();
      } else {
        console.warn("[SPEECH] No voice model configured. Skipping speech.");
        onSpeechEnd();
      }
    } catch (e: any) {
      console.error("[ERROR] Speech synthesis failed:", e);
      showError(`Erro na síntese de voz: ${e.message}`);
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening, setupAudioAnalysis, runAudioAnalysis, startStreaming]);

  const executeClientAction = useCallback((action) => {
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

  const runConversation = useCallback(async (userMessage) => {
    if (!userMessage) return;
    console.log(`[AI] Starting conversation with user message: "${userMessage}"`);
    setTranscript(userMessage);
    setAiResponse("");
    stopListening();
    stopStreaming(); // Garante que o streaming pare ao iniciar a conversa

    const currentHistory = [...messageHistoryRef.current, { role: "user", content: userMessage }];
    setMessageHistory(currentHistory);
    
    const currentSettings = settingsRef.current;
    if (!currentSettings || !currentSettings.openai_api_key) {
      const errorMsg = "Desculpe, a chave da API OpenAI não está configurada.";
      console.error("[ERROR] OpenAI API key is not configured.");
      speak(errorMsg);
      showError("Chave da API OpenAI não configurada.");
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

    console.log("[AI] Sending request to OpenAI with streaming:", requestBody);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API Error: ${errorData.error?.message || JSON.stringify(errorData)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let toolCalls = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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
              }
              if (delta?.tool_calls) {
                delta.tool_calls.forEach(toolCall => {
                  if (!toolCalls[toolCall.index]) {
                    toolCalls[toolCall.index] = { id: "", type: "function", function: { name: "", arguments: "" } };
                  }
                  if (toolCall.id) toolCalls[toolCall.index].id = toolCall.id;
                  if (toolCall.function.name) toolCalls[toolCall.index].function.name = toolCall.function.name;
                  if (toolCall.function.arguments) toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                });
              }
            } catch (e) {
              console.error("[ERROR] Failed to parse stream chunk:", dataStr, e);
            }
          }
        }
      }

      const aiMessage = { role: "assistant", content: fullResponse, tool_calls: toolCalls.length > 0 ? toolCalls : undefined };
      const newHistoryWithAIMessage = [...currentHistory, aiMessage];
      setMessageHistory(newHistoryWithAIMessage);

      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        console.log("[AI] Tool call requested:", aiMessage.tool_calls);
        speak(`Ok, um momento enquanto eu acesso minhas ferramentas.`, async () => {
            let toolResponses;
            try {
                const toolPromises = aiMessage.tool_calls.map(async (toolCall) => {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);
                    
                    const power = powersRef.current.find(p => p.name === functionName);
                    if (!power) throw new Error(`Power "${functionName}" not found.`);

                    console.log(`[TOOL] Executing power: ${functionName} via proxy-api with args:`, functionArgs);

                    const allVariables = { ...systemVariablesRef.current, ...functionArgs };
                    const processedUrl = replacePlaceholders(power.url, allVariables);
                    const processedHeaders = JSON.parse(replacePlaceholders(JSON.stringify(power.headers || {}), allVariables));
                    const templateBody = power.body || {};
                    const finalBody = { ...templateBody, ...functionArgs };

                    const payload = { url: processedUrl, method: power.method, headers: processedHeaders, body: finalBody };
                    const { data: functionResult, error: functionError } = await supabaseAnon.functions.invoke('proxy-api', { body: payload });

                    if (functionError) {
                        console.error(`[ERROR] Error invoking tool ${functionName} via proxy:`, functionError);
                        throw new Error(`Error invoking function ${functionName}: ${functionError.message}`);
                    }
                    console.log(`[TOOL] Tool ${functionName} returned:`, functionResult);
                    return { tool_call_id: toolCall.id, role: "tool", name: functionName, content: JSON.stringify(functionResult.data || functionResult) };
                });
                toolResponses = await Promise.all(toolPromises);
            } catch (e: any) {
                console.error("[ERROR] A tool execution failed:", e);
                toolResponses = aiMessage.tool_calls.map(toolCall => ({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: toolCall.function.name,
                    content: JSON.stringify({ error: "Failed to execute tool.", details: e.message }),
                }));
                speak(`Desculpe, houve um erro ao usar minhas ferramentas.`);
            }

            const historyForSecondCall = [...newHistoryWithAIMessage, ...toolResponses];
            setMessageHistory(historyForSecondCall);

            setAiResponse(""); 
            
            const secondRequestBody = { model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...historyForSecondCall.slice(-currentSettings.conversation_memory_length)], stream: true };
            console.log("[AI] Sending second request to OpenAI with tool results:", secondRequestBody);

            const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
                body: JSON.stringify(secondRequestBody),
            });
            if (!secondResponse.ok) { const errorData = await secondResponse.json(); throw new Error(`OpenAI API Error: ${errorData.error?.message || JSON.stringify(errorData)}`); }
            
            const secondReader = secondResponse.body.getReader();
            let finalResponseText = "";
            while (true) {
                const { done, value } = await secondReader.read();
                if (done) break;
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
                            }
                        } catch (e) {
                            console.error("[ERROR] Failed to parse second stream chunk:", dataStr, e);
                        }
                    }
                }
            }
            setMessageHistory(prev => [...prev, { role: "assistant", content: finalResponseText }]);
            speak(finalResponseText);
        });
      } else {
        console.log("[AI] No tool call, speaking response directly.");
        speak(fullResponse);
      }
    } catch (e: any) {
      console.error("[ERROR] Error in runConversation:", e);
      const errorMsg = `Desculpe, não consegui processar sua solicitação.`;
      speak(errorMsg);
      showError(`Erro na conversa: ${e.message}`);
    }
  }, [speak, stopListening, stopStreaming]);

  const stopStreaming = useCallback(() => {
    if (isStreamingRef.current) {
      console.log("[STREAMING] Stopping stream...");
      isStreamingRef.current = false;
      setIsListening(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (sttSocketRef.current && sttSocketRef.current.readyState === WebSocket.OPEN) {
        sttSocketRef.current.close();
      }
      mediaRecorderRef.current = null;
      sttSocketRef.current = null;
    }
  }, []);

  const startStreaming = useCallback(async () => {
    if (isStreamingRef.current || isSpeakingRef.current || stopPermanentlyRef.current) {
      return;
    }
    console.log("[STREAMING] Starting stream...");
    isStreamingRef.current = true;
    setIsListening(true);
    setTranscript("");
    setInterimTranscript("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      sttSocketRef.current = new WebSocket(STREAMING_STT_FUNCTION_URL);

      sttSocketRef.current.onopen = () => {
        console.log("[STREAMING] WebSocket connected. Starting media recorder.");
        mediaRecorderRef.current?.start(250); // Send audio data every 250ms
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && sttSocketRef.current?.readyState === WebSocket.OPEN) {
          sttSocketRef.current.send(event.data);
        }
      };

      sttSocketRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'transcript') {
          const transcriptData = message.data;
          const newTranscript = transcriptData.channel.alternatives[0].transcript;
          if (transcriptData.is_final) {
            setTranscript(prev => (prev + " " + newTranscript).trim());
            setInterimTranscript("");
            if (transcriptData.speech_final) {
              const finalUtterance = (transcript + " " + newTranscript).trim();
              console.log(`[STREAMING] Final utterance received: "${finalUtterance}"`);
              stopStreaming();
              runConversation(finalUtterance);
            }
          } else {
            setInterimTranscript(newTranscript);
          }
        } else if (message.type === 'error') {
          console.error("[STREAMING] Error from Edge Function:", message.message);
          showError(`Erro no streaming: ${message.message}`);
          stopStreaming();
        }
      };

      sttSocketRef.current.onclose = () => console.log("[STREAMING] WebSocket closed.");
      sttSocketRef.current.onerror = (err) => { console.error("[STREAMING] WebSocket error:", err); stopStreaming(); };

    } catch (err) {
      console.error("[STREAMING] Error starting stream:", err);
      showError("Não foi possível iniciar o microfone para streaming.");
      isStreamingRef.current = false;
      setIsListening(false);
    }
  }, [stopStreaming, runConversation, transcript]);

  const initializeAssistant = useCallback(() => {
    console.log("[ASSISTANT] Initializing...");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
    recognitionRef.current.onerror = (e) => {
      console.error("[ERROR] Speech Recognition Error:", e.error, e.message);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicPermission("denied");
        setIsPermissionModalOpen(true);
      }
    };
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      console.log(`[USER] Recognized transcript: "${transcript}"`);
      
      const currentSettings = settingsRef.current;
      if (!currentSettings) return;

      if (isOpenRef.current) {
        const closePhrases = currentSettings.deactivation_phrases || [];
        if (closePhrases.some((phrase) => transcript.includes(phrase.toLowerCase()))) {
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
        if (activationPhrases.some(phrase => transcript.includes(phrase.toLowerCase()))) {
          console.log(`[USER] Activation phrase detected.`);
          // Correção: Parar de ouvir para evitar múltiplos gatilhos antes de ativar
          stopListening();
          handleManualActivation();
        }
      }
    };
    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      console.log("[ASSISTANT] Speech Synthesis initialized.");
    }
  }, [executeClientAction, runConversation, speak, startListening, stopSpeaking, fetchAllAssistantData, startStreaming, handleManualActivation]);

  const checkAndRequestMicPermission = useCallback(async () => {
    console.log("[ASSISTANT] Checking microphone permission...");
    try {
      const permissionStatus = await navigator.permissions.query({ name: "microphone" });
      console.log(`[ASSISTANT] Microphone permission status: ${permissionStatus.state}`);
      setMicPermission(permissionStatus.state);
      if (permissionStatus.state === "granted") {
        if (!recognitionRef.current) initializeAssistant();
        // Decide whether to start local listening or streaming based on settings
        if (settingsRef.current?.input_mode === 'streaming') {
          startStreaming();
        } else {
          startListening();
        }
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
  }, [initializeAssistant, startListening, startStreaming]);

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
      // Decide whether to start local listening or streaming based on settings
      if (settingsRef.current?.input_mode === 'streaming') {
        startStreaming();
      } else {
        startListening();
      }
    } catch(e) {
      console.error("[ERROR] User denied microphone access or an error occurred:", e);
      setMicPermission("denied");
      setIsPermissionModalOpen(true);
    }
  }, [initializeAssistant, startListening, startStreaming]);

  const handleManualActivation = useCallback(() => {
    console.log("[USER] Manually activating assistant.");
    if (isOpenRef.current) return;
    
    // Resume AudioContext on user interaction
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      console.log("[AUDIO] Resuming AudioContext due to user gesture.");
      audioContextRef.current.resume();
    }

    if (micPermission !== "granted") {
      checkAndRequestMicPermission();
    } else {
      fetchAllAssistantData().then((latestSettings) => {
        if (!latestSettings) return;
        setIsOpen(true);
        const messageToSpeak = hasBeenActivatedRef.current && latestSettings.continuation_phrase ? latestSettings.continuation_phrase : latestSettings.welcome_message;
        speak(messageToSpeak, () => {
          if (latestSettings.input_mode === 'streaming') {
            startStreaming();
          } else {
            startListening();
          }
        });
        setHasBeenActivated(true);
      });
    }
  }, [micPermission, checkAndRequestMicPermission, speak, startListening, fetchAllAssistantData, startStreaming]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    console.log("[ASSISTANT] Component mounted.");
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    fetchAllAssistantData().then((initialSettings) => {
      // After fetching settings, then check mic permission
      settingsRef.current = initialSettings; // Ensure ref is updated immediately
      checkAndRequestMicPermission();
    });

    return () => {
      console.log("[ASSISTANT] Component unmounting. Cleaning up...");
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
      stopStreaming();
    };
  }, [fetchAllAssistantData, checkAndRequestMicPermission, stopStreaming]);

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
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
          {/* Substituído AIScene pelo novo OrbScene */}
          <OrbScene audioIntensity={audioIntensity} />
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
          {(transcript || interimTranscript) && (
            <p className="text-gray-200 text-lg mt-4 drop-shadow-md">
              {transcript} <span className="text-gray-400">{interimTranscript}</span>
            </p>
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