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

const defaultSettings = {
  system_prompt:
    `Você é Intra, a IA da Intratégica.

Regras de Clientes:
- Clientes são identificados por um 'client_code' único (ex: CL000001) ou por 'name'. Sempre dê preferência ao 'client_code' se você o conhecer, pois é mais preciso.
- Ao criar um novo cliente, um 'client_code' será gerado automaticamente. Informe o usuário sobre o código gerado.
- Se o usuário fornecer informações de um cliente em partes, colete todos os detalhes antes de chamar 'save_client_data'.
- Ao chamar 'save_client_data', inclua TODAS as informações do cliente que você coletou na conversa.

Ferramentas Disponíveis (Poderes):
- get_client_data: Use para buscar um cliente pelo 'client_code' ou 'name'.
- save_client_data: Use para criar ou ATUALIZAR um cliente. Para atualizar, use o 'client_code' se souber, ou o 'name'.
- get_user_field: Use para obter dados do usuário atual.
- set_user_field: Use para salvar dados do usuário atual.`,
  assistant_prompt:
    "Você é um assistente amigável e profissional que ajuda agências de tecnologia a automatizar processos e criar soluções de IA personalizadas.",
  ai_model: "gpt-4o-mini",
  voice_model: "browser",
  openai_tts_voice: "alloy",
  voice_sensitivity: 50,
  openai_api_key: "",
  gemini_api_key: "",
  deepgram_api_key: "",
  openai_stt_api_key: "",
  google_stt_api_key: "",
  conversation_memory_length: 5,
  activation_phrases: ["ativar"],
  deactivation_phrases: ["fechar", "encerrar"],
  welcome_message: "Bem-vindo ao site! Diga 'ativar' para começar a conversar.",
  continuation_phrase: "Pode falar.",
  show_transcript: true,
  input_mode: 'local',
  output_mode: 'buffered',
  streaming_stt_provider: 'deepgram',
};

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
  const stopListeningRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const speechTimeoutRef = useRef(null);
  const sentenceQueueRef = useRef([]);
  const speechManagerTimeoutRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Streaming refs
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef("");

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

  const fetchAllAssistantData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: settingsData, error } = await supabase.from("settings").select("*").order('created_at', { ascending: true }).limit(1).single();
      
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching settings:", error);
        showError("Erro ao carregar configurações do assistente.");
      }

      setSettings(settingsData || defaultSettings);

      const { data: powersData } = await supabase.from("powers").select("*");
      setPowers(powersData || []);
      const { data: actionsData } = await supabase.from("client_actions").select("*");
      setClientActions(actionsData || []);
      
      return settingsData || defaultSettings;
    } catch (error) {
      showError("Erro ao carregar dados do assistente.");
      setSettings(defaultSettings);
      return null;
    } finally {
      setIsLoading(false);
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
    if (isSpeakingRef.current) setIsSpeaking(false);
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

  const runConversation = useRef(async (_userMessage) => {});

  const stopListening = useCallback(() => {
    stopListeningRef.current = true;
    if (settingsRef.current?.input_mode === 'streaming') {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      audioStreamRef.current?.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
      finalTranscriptRef.current = "";
    } else {
      recognitionRef.current?.stop();
    }
    setIsListening(false);
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
        audioRef.current.onended = () => { onEndCallback(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.onerror = () => { onEndCallback(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
        runAudioAnalysis();
      } else {
        onEndCallback();
      }
    } catch (e) {
      showError(`Erro na síntese de voz: ${e.message}`);
      onEndCallback();
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
          setIsSpeaking(false);
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          setAudioIntensity(0);
        } else {
          speechManager();
        }
      });
    }
  }, [speakSingleSentence]);

  const speak = useCallback((text, onEndCallback) => {
    stopSpeaking();
    stopListening();
    setAiResponse(text);
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    sentenceQueueRef.current = sentences;
    speechManager();
    if (onEndCallback) {
      const checkCompletion = () => {
        if (!isSpeakingRef.current && sentenceQueueRef.current.length === 0) onEndCallback();
        else setTimeout(checkCompletion, 200);
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
        default: console.warn(`Ação desconhecida: ${action.action_type}`); break;
      }
    });
  }, [speak, stopListening]);

  const processCommand = useCallback((command) => {
    if (!command) return;
    const currentSettings = settingsRef.current;
    if (currentSettings?.deactivation_phrases.some(p => command.includes(p.toLowerCase()))) {
      setIsOpen(false);
      stopSpeaking();
      return;
    }
    const matchedAction = clientActionsRef.current.find(a => command.includes(a.trigger_phrase.toLowerCase()));
    if (matchedAction) {
      executeClientAction(matchedAction);
      return;
    }
    runConversation.current(command);
  }, [stopSpeaking, executeClientAction]);

  const startListening = useCallback(() => {
    const currentSettings = settingsRef.current;
    if (!currentSettings || isListeningRef.current || isSpeakingRef.current || stopPermanentlyRef.current) return;

    stopListeningRef.current = false;

    if (currentSettings.input_mode === 'streaming') {
      if (wsRef.current) return;

      let wsUrl = '';
      switch (currentSettings.streaming_stt_provider) {
        case 'deepgram':
          wsUrl = `wss://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/mic-stream-proxy`;
          break;
        case 'openai':
          wsUrl = `wss://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/openai-stt-proxy`;
          break;
        case 'google':
          wsUrl = `wss://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/google-stt-proxy`;
          break;
        default:
          showError("Provedor de streaming STT não configurado ou inválido.");
          return;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = async () => {
        console.log(`Conectado ao proxy WebSocket para ${currentSettings.streaming_stt_provider}.`);
        setIsListening(true);
        try {
          audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(audioStreamRef.current, { mimeType: 'audio/webm; codecs=opus' });
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(event.data);
            }
          };
          recorder.start(250);
        } catch (err) {
          showError("Não foi possível acessar o microfone.");
          setMicPermission("denied");
          setIsPermissionModalOpen(true);
          ws.close();
        }
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
          console.error("Erro do provedor de streaming:", data.error);
          showError(`Erro no streaming de voz: ${data.error}`);
          stopListening();
          return;
        }

        const transcriptChunk = data.channel?.alternatives?.[0]?.transcript || data.text || "";
        const isFinal = data.is_final;

        if (transcriptChunk) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            console.log("Silence detected.");
            const currentSettings = settingsRef.current;
            if (currentSettings?.streaming_stt_provider === 'openai') {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                console.log("Requesting final transcript from OpenAI proxy.");
                wsRef.current.send(JSON.stringify({ type: 'process_audio' }));
              }
            } else {
              if (finalTranscriptRef.current) {
                const commandToProcess = finalTranscriptRef.current.trim();
                finalTranscriptRef.current = "";
                stopListening();
                processCommand(commandToProcess);
              }
            }
          }, 1200);

          if (isFinal) {
            finalTranscriptRef.current += transcriptChunk + " ";
            setTranscript(finalTranscriptRef.current);

            const currentSettings = settingsRef.current;
            if (currentSettings?.streaming_stt_provider === 'openai') {
              const commandToProcess = finalTranscriptRef.current.trim();
              finalTranscriptRef.current = "";
              stopListening();
              processCommand(commandToProcess);
            }
          } else {
            setTranscript(finalTranscriptRef.current + transcriptChunk);
          }
        }
      };
      ws.onclose = () => { wsRef.current = null; setIsListening(false); console.log("WebSocket de streaming fechado."); };
      ws.onerror = (err) => { showError("Erro na conexão de streaming."); console.error("WebSocket streaming error:", err); wsRef.current = null; setIsListening(false); };
    } else {
      if (recognitionRef.current) {
        try { 
          recognitionRef.current.start(); 
        } catch (e) { 
          console.error("Erro ao iniciar reconhecimento local:", e); 
        }
      }
    }
  }, [processCommand, stopListening]);

  const runConversationFn = useCallback(async (userMessage) => {
    if (!userMessage) return;
    setTranscript(userMessage);
    setAiResponse("");
    stopListening();
    const currentHistory = [...messageHistoryRef.current, { role: "user", content: userMessage }];
    setMessageHistory(currentHistory);
    const currentSettings = settingsRef.current;
    if (!currentSettings || !currentSettings.openai_api_key) {
      speak("Chave da API OpenAI não configurada.");
      return;
    }
    const systemPrompt = replacePlaceholders(currentSettings.system_prompt, systemVariablesRef.current);
    const tools = powersRef.current.map(p => ({ type: "function", function: { name: p.name, description: p.description, parameters: p.parameters_schema || { type: "object", properties: {} } } }));
    const requestBody = { model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...currentHistory.slice(-currentSettings.conversation_memory_length)], tools: tools.length ? tools : undefined, tool_choice: tools.length ? "auto" : undefined, stream: true };
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` }, body: JSON.stringify(requestBody) });
      if (!response.ok) throw new Error(`Erro da API OpenAI: ${(await response.json()).error?.message}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "", toolCalls = [], sentenceBuffer = "";
      const processAndSpeakBuffer = (force = false) => {
        const punctuation = /[.!?]/;
        let splitPoint = force ? sentenceBuffer.length : sentenceBuffer.search(punctuation);
        if (splitPoint > -1) {
          const sentence = sentenceBuffer.substring(0, splitPoint + 1).trim();
          if (sentence) { sentenceQueueRef.current.push(sentence); speechManager(); }
          sentenceBuffer = sentenceBuffer.substring(splitPoint + 1);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) { if (sentenceBuffer.trim()) processAndSpeakBuffer(true); break; }
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6);
            if (dataStr === "[DONE]") break;
            try {
              const data = JSON.parse(dataStr);
              const delta = data.choices[0]?.delta;
              if (delta?.content) {
                fullResponse += delta.content;
                setAiResponse(curr => curr + delta.content);
                if (currentSettings.output_mode === 'streaming') { sentenceBuffer += delta.content; processAndSpeakBuffer(); }
              }
              if (delta?.tool_calls) {
                delta.tool_calls.forEach(tc => {
                  if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: "", type: "function", function: { name: "", arguments: "" } };
                  if (tc.id) toolCalls[tc.index].id = tc.id;
                  if (tc.function.name) toolCalls[tc.index].function.name = tc.function.name;
                  if (tc.function.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                });
              }
            } catch (e) { console.error("Erro ao parsear chunk:", dataStr, e); }
          }
        }
      }
      const aiMessage = { role: "assistant", content: fullResponse, tool_calls: toolCalls.length ? toolCalls : undefined };
      setMessageHistory(prev => [...prev, aiMessage]);
      if (aiMessage.tool_calls?.length) {
        speak(`Ok, um momento.`, async () => {
          const toolPromises = aiMessage.tool_calls.map(async (tc) => {
            const power = powersRef.current.find(p => p.name === tc.function.name);
            if (!power) throw new Error(`Poder "${tc.function.name}" não encontrado.`);
            const args = JSON.parse(tc.function.arguments);
            const allVars = { ...systemVariablesRef.current, ...args };
            const payload = { url: replacePlaceholders(power.url, allVars), method: power.method, headers: JSON.parse(replacePlaceholders(JSON.stringify(power.headers || {}), allVars)), body: { ...(power.body || {}), ...args } };
            const { data, error } = await supabaseAnon.functions.invoke('proxy-api', { body: payload });
            if (error) throw new Error(`Erro ao invocar ${tc.function.name}: ${error.message}`);
            return { tool_call_id: tc.id, role: "tool", name: tc.function.name, content: JSON.stringify(data.data || data) };
          });
          const toolResponses = await Promise.all(toolPromises);
          const historyForSecondCall = [...currentHistory, aiMessage, ...toolResponses];
          setMessageHistory(historyForSecondCall);
          setAiResponse("");
          const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` }, body: JSON.stringify({ model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...historyForSecondCall.slice(-currentSettings.conversation_memory_length)], stream: true }) });
          if (!secondResponse.ok) throw new Error(`Erro da API OpenAI: ${(await secondResponse.json()).error?.message}`);
          const secondReader = secondResponse.body.getReader();
          let finalResponseText = "";
          sentenceBuffer = "";
          while (true) {
            const { done, value } = await secondReader.read();
            if (done) { if (sentenceBuffer.trim()) processAndSpeakBuffer(true); break; }
            const chunk = decoder.decode(value);
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                const dataStr = line.substring(6);
                if (dataStr === "[DONE]") break;
                try {
                  const data = JSON.parse(dataStr);
                  const delta = data.choices[0]?.delta?.content;
                  if (delta) {
                    finalResponseText += delta;
                    setAiResponse(curr => curr + delta);
                    if (currentSettings.output_mode === 'streaming') { sentenceBuffer += delta; processAndSpeakBuffer(); }
                  }
                } catch (e) { console.error("Erro ao parsear chunk 2:", dataStr, e); }
              }
            }
          }
          setMessageHistory(prev => [...prev, { role: "assistant", content: finalResponseText }]);
          if (currentSettings.output_mode !== 'streaming') speak(finalResponseText);
        });
      } else {
        if (currentSettings.output_mode !== 'streaming') speak(fullResponse);
      }
    } catch (e) {
      speak(`Desculpe, não consegui processar sua solicitação.`);
      showError(`Erro na conversa: ${e.message}`);
    }
  }, [speak, stopListening, speechManager]);

  useEffect(() => {
    runConversation.current = runConversationFn;
  }, [runConversationFn]);

  const handleManualActivation = useCallback(() => {
    if (isOpenRef.current) return;
    if (micPermission !== "granted") {
      setIsPermissionModalOpen(true);
      return;
    }
    const latestSettings = settingsRef.current;
    if (!latestSettings) {
      showError("Configurações do assistente ainda não carregaram.");
      return;
    }
    
    const message = hasBeenActivatedRef.current ? latestSettings.continuation_phrase : latestSettings.welcome_message;
    
    setIsOpen(true);
    setHasBeenActivated(true);
    
    speak(message, () => {
      if (isOpenRef.current) {
        startListening();
      }
    });
  }, [micPermission, speak, startListening]);

  const initializeWebSpeech = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser");
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";
    recognitionRef.current.onstart = () => {
      console.log("Speech recognition started");
      setIsListening(true);
    };
    
    recognitionRef.current.onend = () => {
      console.log("Speech recognition ended");
      setIsListening(false);
      if (!stopListeningRef.current && !stopPermanentlyRef.current) {
        console.log("Restarting speech recognition...");
        setTimeout(() => {
          try {
            if (recognitionRef.current && !isListeningRef.current && !isSpeakingRef.current) {
              recognitionRef.current.start();
            }
          } catch (e) {
            console.error("Failed to restart recognition:", e);
          }
        }, 100);
      }
    };

    recognitionRef.current.onerror = (e) => {
      console.error("Speech recognition error:", e.error);
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        setMicPermission("denied");
        setIsPermissionModalOpen(true);
      }
    };
    
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      console.log("Recognized speech:", transcript);
      const currentSettings = settingsRef.current;
      if (!currentSettings) return;
      
      // Always process commands when assistant is open
      if (isOpenRef.current) {
        processCommand(transcript);
      } else {
        // Check for activation phrases when assistant is closed
        const activationPhrases = currentSettings.activation_phrases || ["ativar"];
        if (activationPhrases.some(p => transcript.includes(p.toLowerCase()))) {
          handleManualActivation();
        }
      }
    };
    
    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, [processCommand, handleManualActivation]);

  const handleAllowMic = useCallback(async () => {
    setIsPermissionModalOpen(false);
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      
      const currentSettings = settingsRef.current;
      if (currentSettings?.input_mode === 'local') {
        if (!recognitionRef.current) {
          initializeWebSpeech();
        }
        // Start listening if assistant is open or for continuous activation phrase detection
        if (isOpenRef.current || !isOpenRef.current) {
          startListening();
        }
      } else if (currentSettings?.input_mode === 'streaming') {
        if (isOpenRef.current) {
          startListening();
        }
      }
    } catch (e) {
      console.error("Microphone access denied:", e);
      setMicPermission("denied");
      setIsPermissionModalOpen(true);
    }
  }, [initializeWebSpeech, startListening]);

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      // Try to get permission status
      if (navigator.permissions && navigator.permissions.query) {
        const permissionStatus = await navigator.permissions.query({ name: "microphone" });
        setMicPermission(permissionStatus.state);
        
        if (permissionStatus.state === "granted") {
          const currentSettings = settingsRef.current;
          if (currentSettings?.input_mode === 'local') {
            if (!recognitionRef.current) {
              initializeWebSpeech();
            }
            // For local mode, we want to start listening when the page loads
            // but only if we have permission
            if (!isOpenRef.current) {
              startListening();
            }
          }
        } else if (permissionStatus.state === "prompt") {
          // Permission not yet granted, show modal
          setIsPermissionModalOpen(true);
        } else if (permissionStatus.state === "denied") {
          setMicPermission("denied");
          setIsPermissionModalOpen(true);
        }
        
        permissionStatus.onchange = () => {
          setMicPermission(permissionStatus.state);
          if (permissionStatus.state === "granted") {
            const currentSettings = settingsRef.current;
            if (currentSettings?.input_mode === 'local') {
              if (!recognitionRef.current) {
                initializeWebSpeech();
              }
              if (!isOpenRef.current) {
                startListening();
              }
            }
          }
        };
      } else {
        // Fallback for browsers that don't support permissions API
        setIsPermissionModalOpen(true);
      }
    } catch (e) {
      console.warn("Permissions API not supported, showing modal:", e);
      setMicPermission("denied");
      setIsPermissionModalOpen(true);
    }
  }, [initializeWebSpeech, startListening]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    const shouldBeListening = 
      (isOpen && hasBeenActivated && !isSpeaking) ||
      (!isOpen && micPermission === 'granted' && settingsRef.current?.input_mode === 'local' && !stopPermanentlyRef.current);

    if (shouldBeListening && !isListening) {
      startListening();
    } else if (!shouldBeListening && isListening) {
      stopListening();
    }
  }, [isOpen, isSpeaking, hasBeenActivated, isListening, micPermission, settings, startListening, stopListening]);

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    fetchAllAssistantData().then((fetchedSettings) => {
      if (fetchedSettings) {
        // Initialize speech recognition after settings are loaded
        if (fetchedSettings.input_mode === 'local') {
          initializeWebSpeech();
        }
        checkAndRequestMicPermission();
      }
    });
    
    return () => {
      stopPermanentlyRef.current = true;
      stopListening();
      if (synthRef.current?.speaking) synthRef.current.cancel();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
      }
    };
  }, [fetchAllAssistantData, checkAndRequestMicPermission, initializeWebSpeech, stopListening]);

  if (isLoading || !settings) return null;
  const showTranscriptUI = settings.show_transcript;

  return (
    <>
      <MicrophonePermissionModal 
        isOpen={isPermissionModalOpen} 
        onAllow={handleAllowMic} 
        onClose={() => setIsPermissionModalOpen(false)} 
        permissionState={micPermission} 
      />
      {imageToShow && (
        <ImageModal 
          imageUrl={imageToShow.imageUrl} 
          altText={imageToShow.altText} 
          onClose={() => { 
            setImageToShow(null); 
            if (isOpen) startListening(); 
          }} 
        />
      )}
      {urlToOpenInIframe && (
        <UrlIframeModal 
          url={urlToOpenInIframe} 
          onClose={() => { 
            setUrlToOpenInIframe(null); 
            if (isOpen) startListening(); 
          }} 
        />
      )}
      <div className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 transition-opacity duration-500",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
          {/* <AIScene audioIntensity={audioIntensity} isMobile={isMobile} /> */}
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
            <Mic className={cn(
              "h-8 w-8 text-cyan-300 transition-all",
              isListening && "text-cyan-200 animate-pulse drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]"
            )} />
          </div>
          <AudioVisualizer isSpeaking={isSpeaking} />
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;