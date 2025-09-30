"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { showError } from "@/utils/toast";
import { supabaseAnon } from "@/integrations/supabase/client";
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
import { createClient, LiveClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { useAssistantState } from "@/hooks/useAssistantState";

// As funções auxiliares de conversão de schema podem ser movidas para um arquivo utils/ai.ts no futuro
const mapOpenAITypeToGemini = (type: string) => {
  const typeMap: { [key: string]: string } = { string: 'STRING', number: 'NUMBER', boolean: 'BOOLEAN', object: 'OBJECT', array: 'ARRAY' };
  return typeMap[type?.toLowerCase()] || 'STRING';
};
const mapOpenAIPropertiesToGemini = (properties: any): any => {
  if (!properties) return {};
  return Object.entries(properties).reduce((acc, [key, prop]: [string, any]) => {
    acc[key] = { ...prop, type: mapOpenAITypeToGemini(prop.type) };
    if (prop.properties) acc[key].properties = mapOpenAIPropertiesToGemini(prop.properties);
    return acc;
  }, {} as { [key: string]: any });
};
const mapOpenAIToGeminiSchema = (openaiSchema: any) => {
  if (!openaiSchema || openaiSchema.type !== 'object') return { type: 'OBJECT', properties: {} };
  return { type: 'OBJECT', properties: mapOpenAIPropertiesToGemini(openaiSchema.properties), required: openaiSchema.required || [] };
};
const mapToGeminiHistory = (history: any[]) => {
  return history.filter(msg => msg.role !== 'system').map(msg => {
    let role = msg.role === 'assistant' ? 'model' : 'user';
    let parts = [];
    if (msg.role === 'tool') {
      role = 'tool';
      try { parts.push({ functionResponse: { name: msg.name, response: JSON.parse(msg.content) } }); }
      catch (e) { parts.push({ functionResponse: { name: msg.name, response: { content: msg.content } } }); }
    } else {
      if (msg.content) parts.push({ text: msg.content });
      if (msg.tool_calls) {
        parts.push(...msg.tool_calls.map((tc: any) => {
          try { return { functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) } }; }
          catch (e) { console.error("Argumentos de função inválidos:", tc.function.arguments); return null; }
        }).filter(Boolean));
      }
    }
    return { role, parts };
  });
};

const ImageModal = ({ imageUrl, altText, onClose }: { imageUrl: string, altText: string, onClose: () => void }) => (
  <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80" onClick={onClose}><div className="relative max-w-4xl max-h-[80vh] p-4" onClick={(e) => e.stopPropagation()}><img src={imageUrl} alt={altText} className="w-full h-full object-contain rounded-lg" /><Button variant="destructive" size="icon" className="absolute top-6 right-6 rounded-full" onClick={onClose}><X className="h-4 w-4" /></Button></div></div>
);

interface SophisticatedVoiceAssistantProps {
  embedWorkspaceId?: string;
}

const SophisticatedVoiceAssistant: React.FC<SophisticatedVoiceAssistantProps> = ({ embedWorkspaceId }) => {
  const { systemVariables } = useSystem();
  const { activationTrigger } = useVoiceAssistant();
  const {
    settings, powers, clientActions, isLoading,
    settingsRef, powersRef, clientActionsRef, fetchAllAssistantData
  } = useAssistantState(embedWorkspaceId);

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState<any[]>([]);
  const [imageToShow, setImageToShow] = useState<any>(null);
  const [urlToOpenInIframe, setUrlToOpenInIframe] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState("checking");
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [hasBeenActivated, setHasBeenActivated] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [accumulatedTranscript, setAccumulatedTranscript] = useState("");

  const isSpeakingRef = useRef(isSpeaking);
  const systemVariablesRef = useRef(systemVariables);
  const messageHistoryRef = useRef(messageHistory);
  const recognitionRef = useRef<any>(null);
  const interruptRecognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const deepgramConnectionRef = useRef<LiveClient | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const elevenlabsSocketRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingAudioRef = useRef(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedTranscriptRef = useRef("");

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { systemVariablesRef.current = systemVariables; }, [systemVariables]);
  useEffect(() => { messageHistoryRef.current = messageHistory; }, [messageHistory]);
  useEffect(() => { accumulatedTranscriptRef.current = accumulatedTranscript; }, [accumulatedTranscript]);

  const stopListening = useCallback(() => {
    if (settingsRef.current?.streaming_stt_provider === 'deepgram') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
      if (deepgramConnectionRef.current) {
        deepgramConnectionRef.current.finish();
        deepgramConnectionRef.current = null;
      }
    } else {
      if (recognitionRef.current) recognitionRef.current.stop();
    }
  }, []);

  const connectToDeepgram = useCallback(async () => {
    const apiKey = settingsRef.current?.deepgram_api_key;
    if (!apiKey || apiKey.trim() === "") {
      showError("A chave de API da Deepgram não está configurada. Por favor, adicione-a no painel de configurações.");
      setIsListening(false);
      return;
    }
    const deepgram = createClient(apiKey);
    const connection = deepgram.listen.live({ model: settingsRef.current.deepgram_stt_model || 'nova-2-general', language: 'pt-BR', smart_format: true, interim_results: true });
    connection.on(LiveTranscriptionEvents.Open, () => {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => connection.send(e.data);
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      });
    });
    connection.on(LiveTranscriptionEvents.Transcript, data => {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript) {
        handleDeepgramTranscript(transcript.toLowerCase(), data.is_final);
      }
    });
    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error("Deepgram STT Error:", error);
      showError(`Erro na transcrição Deepgram. Verifique sua chave de API e a conexão com a internet.`);
    });
    connection.on(LiveTranscriptionEvents.Close, () => setIsListening(false));
    deepgramConnectionRef.current = connection;
  }, []);

  const startListening = useCallback(() => {
    if (isListening || isSpeakingRef.current || stopPermanentlyRef.current) return;
    if (settingsRef.current?.streaming_stt_provider === 'deepgram') {
      connectToDeepgram();
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn("Recognition start error (might be safe to ignore):", e);
        }
      }
    }
  }, [isListening, connectToDeepgram]);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) synthRef.current.cancel();
    if (audioRef.current && !audioRef.current.paused) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (elevenlabsSocketRef.current) { elevenlabsSocketRef.current.close(); elevenlabsSocketRef.current = null; }
    if (interruptRecognitionRef.current) interruptRecognitionRef.current.stop();
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setAudioIntensity(0);
    setIsSpeaking(false);
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
  }, []);

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) { onEndCallback?.(); return; }
    const onSpeechEnd = () => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      if (interruptRecognitionRef.current) interruptRecognitionRef.current.stop();
      setIsSpeaking(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setAudioIntensity(0);
      onEndCallback?.();
    };
    stopSpeaking();
    stopListening();
    setIsSpeaking(true);
    setAiResponse(text);
    if (currentSettings.interrupt_phrase && interruptRecognitionRef.current) {
      interruptRecognitionRef.current.start();
    }
    speechTimeoutRef.current = setTimeout(onSpeechEnd, (text.length / 15) * 1000 + 5000);
    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (e) => { console.error("SpeechSynthesis Error:", e); onSpeechEnd(); };
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        const response = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` }, body: JSON.stringify({ model: "tts-1", voice: currentSettings.openai_tts_voice || "alloy", input: text }) });
        if (!response.ok) throw new Error("Falha na API OpenAI TTS");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
      } else if (currentSettings.voice_model === "deepgram-tts" && currentSettings.deepgram_api_key) {
        const response = await fetch(`https://api.deepgram.com/v1/speak?model=${currentSettings.deepgram_tts_model}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Token ${currentSettings.deepgram_api_key}` }, body: JSON.stringify({ text }) });
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ err_msg: `Request failed with status ${response.status}` }));
          const errorMessage = errorBody.err_msg || errorBody.reason || JSON.stringify(errorBody);
          if (response.status === 401) throw new Error("Falha na API Deepgram TTS: Chave de API inválida ou incorreta.");
          throw new Error(`Falha na API Deepgram TTS: ${errorMessage}`);
        }
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
      } else if (currentSettings.voice_model === "elevenlabs-tts" && currentSettings.elevenlabs_api_key) {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const voiceId = currentSettings.elevenlabs_voice_id || "21m00Tcm4TlvDq8ikWAM";
        const socket = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_multilingual_v2`);
        elevenlabsSocketRef.current = socket;
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => {
          socket.send(JSON.stringify({ text: " ", voice_settings: { stability: 0.5, similarity_boost: 0.8 }, xi_api_key: currentSettings.elevenlabs_api_key }));
          socket.send(JSON.stringify({ text, try_trigger_generation: true }));
          socket.send(JSON.stringify({ text: "" }));
        };
        socket.onmessage = (event) => {
          const audioData = event.data;
          if (audioData instanceof ArrayBuffer) {
            audioQueueRef.current.push(audioData);
            if (!isPlayingAudioRef.current) playAudioQueue(onSpeechEnd);
          }
        };
        socket.onerror = (error) => { console.error("ElevenLabs WebSocket Error:", error); onSpeechEnd(); };
        socket.onclose = () => { if (audioQueueRef.current.length === 0 && !isPlayingAudioRef.current) onSpeechEnd(); };
      } else { onSpeechEnd(); }
    } catch (e: any) { showError(`Erro na síntese de voz: ${e.message}`); onSpeechEnd(); }
  }, [stopSpeaking, stopListening]);

  const playAudioQueue = useCallback(async (onEnd: () => void) => {
    if (isPlayingAudioRef.current || audioQueueRef.current.length === 0) return;
    isPlayingAudioRef.current = true;
    const audioData = audioQueueRef.current.shift();
    if (!audioData || !audioContextRef.current) { isPlayingAudioRef.current = false; return; }
    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        isPlayingAudioRef.current = false;
        if (audioQueueRef.current.length > 0) {
          playAudioQueue(onEnd);
        } else if (elevenlabsSocketRef.current?.readyState === WebSocket.CLOSED) {
          onEnd();
        }
      };
      source.start();
    } catch (error) {
      console.error("Error decoding audio data:", error);
      isPlayingAudioRef.current = false;
    }
  }, []);

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
    const isGemini = currentSettings?.ai_model?.startsWith('gemini');
    if (!currentSettings || (isGemini && !currentSettings.gemini_api_key) || (!isGemini && !currentSettings.openai_api_key)) {
      const errorMsg = `Chave da API para ${isGemini ? 'Gemini' : 'OpenAI'} não configurada.`;
      speak(errorMsg); showError(errorMsg); return;
    }
    const systemPrompt = replacePlaceholders(currentSettings.system_prompt, systemVariablesRef.current);
    const tools = powersRef.current.map(p => ({ type: "function", function: { name: p.name, description: p.description, parameters: p.parameters_schema || { type: "object", properties: {} } } }));
    const executeTools = async (toolCalls: any[]) => {
      return Promise.all(toolCalls.map(async (toolCall) => {
        const { name, arguments: args } = toolCall.function;
        const functionArgs = JSON.parse(args);
        const power = powersRef.current.find(p => p.name === name);
        if (!power) throw new Error(`Power "${name}" not found.`);
        const allVars = { ...systemVariablesRef.current, ...functionArgs };
        const payload = { url: replacePlaceholders(power.url, allVars), method: power.method, headers: JSON.parse(replacePlaceholders(JSON.stringify(power.headers || {}), allVars)), body: { ...(power.body || {}), ...functionArgs } };
        const { data, error } = await supabaseAnon.functions.invoke('proxy-api', { body: payload });
        if (error) throw new Error(`Error invoking function ${name}: ${error.message}`);
        return { tool_call_id: toolCall.id, role: "tool", name, content: JSON.stringify(data.data || data) };
      }));
    };
    try {
      let response;
      if (isGemini) {
        const geminiTools = tools.length > 0 ? [{ functionDeclarations: tools.map(t => ({ name: t.function.name, description: t.function.description, parameters: mapOpenAIToGeminiSchema(t.function.parameters) })) }] : undefined;
        const body = { systemInstruction: { parts: [{ text: systemPrompt }] }, contents: mapToGeminiHistory(currentHistory.slice(-currentSettings.conversation_memory_length)), tools: geminiTools };
        response = await fetch(`${GEMINI_API_BASE_URL}${currentSettings.ai_model}:streamGenerateContent?key=${currentSettings.gemini_api_key}&alt=sse`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        const body = { model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...currentHistory.slice(-currentSettings.conversation_memory_length)], tools: tools.length > 0 ? tools : undefined, tool_choice: tools.length > 0 ? "auto" : undefined, stream: true };
        response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` }, body: JSON.stringify(body) });
      }
      if (!response.ok) { const err = await response.json(); throw new Error(`API Error: ${err.error?.message || JSON.stringify(err)}`); }
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
              if (isGemini) {
                const part = data.candidates?.[0]?.content?.parts?.[0];
                if (part?.text) { fullResponse += part.text; setAiResponse(c => c + part.text); }
                if (part?.functionCall) toolCalls.push({ id: `call_${Math.random().toString(36).substring(2)}`, type: 'function', function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) } });
              } else {
                const delta = data.choices[0]?.delta;
                if (delta?.content) { fullResponse += delta.content; setAiResponse(c => c + delta.content); }
                if (delta?.tool_calls) delta.tool_calls.forEach((tc: any) => {
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
      const aiMessage = { role: "assistant", content: fullResponse || null, tool_calls: toolCalls.length > 0 ? toolCalls : undefined };
      const newHistory = [...currentHistory, aiMessage];
      setMessageHistory(newHistory);
      if (aiMessage.tool_calls?.length) {
        speak(`Ok, um momento.`, async () => {
          const toolResponses = await executeTools(aiMessage.tool_calls!);
          const historyForNextCall = [...newHistory, ...toolResponses];
          setMessageHistory(historyForNextCall);
          setAiResponse("");
          let secondResponse;
          if (isGemini) {
            const geminiTools = tools.length > 0 ? [{ functionDeclarations: tools.map(t => ({ name: t.function.name, description: t.function.description, parameters: mapOpenAIToGeminiSchema(t.function.parameters) })) }] : undefined;
            const body = { systemInstruction: { parts: [{ text: systemPrompt }] }, contents: mapToGeminiHistory(historyForNextCall.slice(-currentSettings.conversation_memory_length)), tools: geminiTools };
            secondResponse = await fetch(`${GEMINI_API_BASE_URL}${currentSettings.ai_model}:streamGenerateContent?key=${currentSettings.gemini_api_key}&alt=sse`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          } else {
            const body = { model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...historyForNextCall.slice(-currentSettings.conversation_memory_length)], stream: true };
            secondResponse = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` }, body: JSON.stringify(body) });
          }
          if (!secondResponse.ok) { const err = await secondResponse.json(); throw new Error(`API Error: ${err.error?.message || JSON.stringify(err)}`); }
          const secondReader = secondResponse.body!.getReader();
          let finalResponseText = "";
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
                  const delta = isGemini ? data.candidates?.[0]?.content?.parts?.[0]?.text || "" : data.choices[0]?.delta?.content || "";
                  if (delta) { finalResponseText += delta; setAiResponse(c => c + delta); }
                } catch (e) { console.error("Failed to parse second stream chunk:", dataStr, e); }
              }
            }
          }
          setMessageHistory(p => [...p, { role: "assistant", content: finalResponseText }]);
          speak(finalResponseText);
        });
      } else { speak(fullResponse); }
    } catch (e: any) { speak(`Desculpe, não consegui processar.`); showError(`Erro na conversa: ${e.message}`); }
  }, [speak, stopListening]);

  const processFinalTranscript = useCallback((finalTranscript: string) => {
    if (!finalTranscript) return;
    const currentSettings = settingsRef.current;
    if (!currentSettings) return;
    if (isOpen) {
      if (currentSettings.deactivation_phrases?.some((p: string) => finalTranscript.includes(p))) {
        setIsOpen(false); setAiResponse(""); setTranscript(""); stopSpeaking(); return;
      }
      const action = clientActionsRef.current.find(a => finalTranscript.includes(a.trigger_phrase.toLowerCase()));
      if (action) { executeClientAction(action); return; }
      runConversation(finalTranscript);
    } else {
      if (currentSettings.activation_phrases?.some((p: string) => finalTranscript.includes(p))) {
        if (!currentSettings) return;
        setIsOpen(true);
        speak(hasBeenActivatedRef.current && currentSettings.continuation_phrase ? currentSettings.continuation_phrase : currentSettings.welcome_message);
        setHasBeenActivated(true);
      }
    }
  }, [executeClientAction, runConversation, speak, stopSpeaking, isOpen]);

  const handleDeepgramTranscript = (transcript: string, isFinal: boolean) => {
    if (isFinal) {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      const newAccumulated = (accumulatedTranscriptRef.current + " " + transcript).trim();
      setAccumulatedTranscript(newAccumulated);
      setTranscript(newAccumulated);
      processingTimeoutRef.current = setTimeout(() => {
        processFinalTranscript(accumulatedTranscriptRef.current);
        setAccumulatedTranscript("");
      }, 1500);
    } else {
      const interimText = (accumulatedTranscriptRef.current + " " + transcript).trim();
      setTranscript(interimText);
    }
  };

  const initializeInterruptRecognizer = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";
    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      const interruptPhrase = settingsRef.current?.interrupt_phrase?.toLowerCase();
      if (interruptPhrase && transcript.includes(interruptPhrase)) {
        stopSpeaking();
        speak(settingsRef.current.continuation_phrase || "Pois não?");
      }
    };
    interruptRecognitionRef.current = recognition;
  }, [speak, stopSpeaking]);

  const initializeAssistant = useCallback(() => {
    if (settingsRef.current?.streaming_stt_provider === 'deepgram') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setMicPermission("denied"); return; }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "pt-BR";
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onerror = (e: any) => { 
      console.error('SpeechRecognition Error:', e.error);
      setIsListening(false);
      if (e.error === "not-allowed") { 
        setMicPermission("denied"); 
        setIsPermissionModalOpen(true); 
      } 
    };
    recognitionRef.current.onresult = (event: any) => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      let fullTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      fullTranscript = fullTranscript.trim().toLowerCase();
      setTranscript(fullTranscript);
      processingTimeoutRef.current = setTimeout(() => {
        processFinalTranscript(fullTranscript);
      }, 1500);
    };
    if ("speechSynthesis" in window) synthRef.current = window.speechSynthesis;
    initializeInterruptRecognizer();
  }, [processFinalTranscript, initializeInterruptRecognizer]);

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setMicPermission(permission.state);
      if (permission.state === "granted") { initializeAssistant(); }
      else setIsPermissionModalOpen(true);
      permission.onchange = () => setMicPermission(permission.state);
    } catch (e) { setMicPermission("denied"); }
  }, [initializeAssistant]);

  const handleAllowMic = useCallback(async () => {
    setIsPermissionModalOpen(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      initializeAssistant();
    } catch (e) { setMicPermission("denied"); setIsPermissionModalOpen(true); }
  }, [initializeAssistant]);

  const handleManualActivation = useCallback(() => {
    if (isOpen) return;
    if (micPermission !== "granted") checkAndRequestMicPermission();
    else {
      if (!settings) return;
      setIsOpen(true);
      speak(hasBeenActivatedRef.current && settings.continuation_phrase ? settings.continuation_phrase : settings.welcome_message);
      setHasBeenActivated(true);
    }
  }, [isOpen, micPermission, checkAndRequestMicPermission, speak, settings, hasBeenActivated]);

  useEffect(() => { if (activationTrigger > activationTriggerRef.current) { activationTriggerRef.current = activationTrigger; handleManualActivation(); } }, [activationTrigger, handleManualActivation]);
  useEffect(() => { if (!isLoading) checkAndRequestMicPermission(); return () => { stopPermanentlyRef.current = true; stopListening(); stopSpeaking(); }; }, [isLoading, checkAndRequestMicPermission]);

  // Supervisor Effect: The single source of truth for starting the microphone.
  useEffect(() => {
    const shouldBeListening = micPermission === 'granted' && !isListening && !isSpeaking && !stopPermanentlyRef.current;
    if (shouldBeListening) {
      const timer = setTimeout(() => startListening(), 100);
      return () => clearTimeout(timer);
    }
  }, [isListening, isSpeaking, micPermission, startListening]);

  if (isLoading || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal isOpen={isPermissionModalOpen} onAllow={handleAllowMic} onClose={() => setIsPermissionModalOpen(false)} permissionState={micPermission as any} />
      {imageToShow && <ImageModal imageUrl={imageToShow.imageUrl} altText={imageToShow.altText} onClose={() => { setImageToShow(null); startListening(); }} />}
      {urlToOpenInIframe && <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); startListening(); }} />}
      
      {/* Modal Principal do Assistente */}
      <div className={cn("fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 transition-opacity duration-500", isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}>
        <div className="absolute inset-0 -z-20 pointer-events-none bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
        <div className="absolute inset-0 -z-10 pointer-events-none"><Orb audioIntensity={audioIntensity} /></div>
        <div />
        <div className="text-center select-text pointer-events-auto max-w-2xl mx-auto w-full">
          {aiResponse && <div className="bg-[rgba(30,35,70,0.5)] backdrop-blur-lg border border-cyan-400/20 rounded-xl p-6 shadow-[0_0_20px_rgba(0,255,255,0.1)]"><p className="text-white text-xl md:text-3xl font-bold leading-tight drop-shadow-lg">{aiResponse}</p></div>}
          {transcript && <p className="text-gray-200 text-lg mt-4 drop-shadow-md">{transcript}</p>}
        </div>
        <div className="flex items-center justify-center gap-4 p-4 bg-[rgba(30,35,70,0.5)] backdrop-blur-lg border border-cyan-400/20 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.1)] pointer-events-auto">
          <AudioVisualizer isSpeaking={isSpeaking} />
          <div className="p-4 bg-cyan-900/20 rounded-full border border-cyan-400/30"><Mic className={cn("h-8 w-8 text-cyan-300 transition-all", isListening && "text-cyan-200 animate-pulse drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]")} /></div>
          <AudioVisualizer isSpeaking={isSpeaking} />
        </div>
      </div>

      {/* Widget Flutuante (Orb) */}
      {!isOpen && (
        <div
          onClick={handleManualActivation}
          className="fixed bottom-8 right-8 z-50 flex flex-col items-center cursor-pointer group"
        >
          <div className="w-24 h-24 transition-transform duration-300 group-hover:scale-110">
            <Orb audioIntensity={0} />
          </div>
          <p className="mt-2 text-sm text-cyan-300 transition-all duration-300 group-hover:text-cyan-100 group-hover:scale-105">
            Clique para falar com IAM
          </p>
        </div>
      )}
    </>
  );
};

export default SophisticatedVoiceAssistant;