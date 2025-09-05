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
import { Mic, X } from "lucide-react";
import { UrlIframeModal } from "./UrlIframeModal";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { AIScene } from "./AIScene";

const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";

const ImageModal = ({ imageUrl, altText, onClose }) => (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80" onClick={onClose}>
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

  // Refs para estados e props
  const settingsRef = useRef(settings);
  const isOpenRef = useRef(isOpen);
  const isListeningRef = useRef(isListening); // Usar para o estado interno do reconhecimento
  const isSpeakingRef = useRef(isSpeaking);   // Usar para o estado interno da fala
  const hasBeenActivatedRef = useRef(hasBeenActivated);
  const powersRef = useRef(powers);
  const clientActionsRef = useRef(clientActions);
  const systemVariablesRef = useRef(systemVariables);
  const sessionRef = useRef(session);
  const messageHistoryRef = useRef(messageHistory);

  // Refs para instâncias de APIs
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Refs para controlar o ciclo de vida e timeouts
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Sincroniza refs com estados
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

  // --- Callbacks principais (estáveis) ---

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
    }
  }, []); // Depende apenas de refs, que são estáveis

  const startListening = useCallback(() => {
    if (isListeningRef.current || isSpeakingRef.current || stopPermanentlyRef.current || !recognitionRef.current) {
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Error starting recognition:", e);
    }
  }, []); // Depende apenas de refs, que são estáveis

  const stopSpeaking = useCallback(() => {
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
  }, []); // Depende apenas de refs e setters, que são estáveis

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
  }, []); // Depende apenas de refs, que são estáveis

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
  }, []); // Depende apenas de refs e setters, que são estáveis

  // Ref para a função speak para ser usada dentro de outros callbacks
  const speakRef = useRef(speak);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  const speak = useCallback(async (text, onEndCallback) => {
    console.log("[SophisticatedVoiceAssistant] speak function called with text:", text);
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      setAiResponse("O áudio está bloqueado. Clique na tela para ativar o som e eu repetirei a mensagem.");
      const unlockAndRetry = async () => {
        await audioContextRef.current.resume();
        window.removeEventListener('click', unlockAndRetry);
        window.removeEventListener('touchstart', unlockAndRetry);
        speakRef.current(text, onEndCallback); // Usar speakRef.current
      };
      window.addEventListener('click', unlockAndRetry, { once: true });
      window.addEventListener('touchstart', unlockAndRetry, { once: true });
      return;
    }

    const onSpeechEnd = () => {
      // Always clear the timeout when onSpeechEnd is called, regardless of the source
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }

      // Only update UI state if we were actually in a speaking state
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setAudioIntensity(0);
      } else {
        console.warn("[SophisticatedVoiceAssistant] onSpeechEnd called but not in speaking state. UI state already reset.");
      }

      onEndCallback?.(); // Always call the callback to ensure flow continues

      // Always attempt to restart listening if the assistant is open and not permanently stopped
      if (isOpenRef.current && !stopPermanentlyRef.current) {
        startListening(); // Usar a função startListening estável
      }
    };

    isSpeakingRef.current = true;
    setIsSpeaking(true);
    stopListening(); // Usar a função stopListening estável
    stopSpeaking(); // Usar a função stopSpeaking estável
    setAiResponse(text);

    // Set a fallback timeout to ensure onSpeechEnd is called even if native events fail
    // Estimate time based on text length, plus a buffer
    const estimatedSpeechTime = (text.length / 15) * 1000 + 3000; // ~15 chars/sec + 3s buffer
    speechTimeoutRef.current = setTimeout(onSpeechEnd, estimatedSpeechTime);

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (e) => {
          console.error("SpeechSynthesis Error:", e);
          onSpeechEnd();
        };
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
        console.warn("[SophisticatedVoiceAssistant] No valid voice model or OpenAI API key for speech. Falling back to onEndCallback.");
        onEndCallback?.(); // If no speech, just call onEndCallback immediately
      }
    } catch (e: any) {
      showError(`Erro na síntese de voz: ${e.message}`);
      onEndCallback?.(); // Ensure callback is called even on error
    }
  }, [stopSpeaking, stopListening, startListening, setupAudioAnalysis, runAudioAnalysis]); // Depende de outras callbacks estáveis

  // Refs para outras callbacks para serem usadas dentro de onresult/onend
  const executeClientActionRef = useRef(executeClientAction);
  const runConversationRef = useRef(runConversation);
  const fetchAllAssistantDataRef = useRef(fetchAllAssistantData);

  useEffect(() => { executeClientActionRef.current = executeClientAction; }, [executeClientAction]);
  useEffect(() => { runConversationRef.current = runConversation; }, [runConversation]);
  useEffect(() => { fetchAllAssistantDataRef.current = fetchAllAssistantData; }, [fetchAllAssistantData]);


  const executeClientAction = useCallback((action) => {
    stopListening();
    speakRef.current("Ok, executando.", () => { // Usar speakRef.current
      console.log("[SophisticatedVoiceAssistant] onEndCallback for 'Ok, executando.' reached. Executing action:", action.action_type, action.action_payload);
      switch (action.action_type) {
        case 'OPEN_URL':
          window.open(action.action_payload.url, '_blank', 'noopener,noreferrer');
          break;
        case 'SHOW_IMAGE':
          setImageToShow(action.action_payload);
          break;
        case 'OPEN_IFRAME_URL':
          setUrlToOpenInIframe(action.action_payload.url);
          break;
        default:
          console.warn(`[SophisticatedVoiceAssistant] Unknown client action type: ${action.action_type}`);
          break;
      }
    });
  }, [stopListening]); // Depende apenas de stopListening (estável)

  const runConversation = useCallback(async (userMessage) => {
    if (!userMessage) {
      console.warn("runConversation called with empty message. Ignoring.");
      return;
    }
    setTranscript(userMessage);
    stopListening();

    let currentConversationHistory = [...messageHistoryRef.current, { role: "user", content: userMessage }];
    setMessageHistory(currentConversationHistory);

    const currentSettings = settingsRef.current;
    if (!currentSettings || !currentSettings.openai_api_key) {
      speakRef.current("Desculpe, a chave da API OpenAI não está configurada. Por favor, configure-a nas configurações.");
      showError("Chave da API OpenAI não configurada.");
      return;
    }

    const systemPrompt = replacePlaceholders(currentSettings.system_prompt, systemVariablesRef.current);
    
    const tools = powersRef.current.map(power => {
      let parameters = { type: "object", properties: {} };
      if (power.parameters_schema) {
        try {
          const schema = typeof power.parameters_schema === 'string'
            ? JSON.parse(power.parameters_schema)
            : power.parameters_schema;
          if (typeof schema === 'object' && schema !== null) {
            parameters = schema;
          }
        } catch (e) {
          console.warn(`[SophisticatedVoiceAssistant] Invalid parameters_schema for power "${power.name}". Using default. Error: ${e.message}`);
        }
      }
      return {
        type: "function",
        function: {
          name: power.name,
          description: power.description,
          parameters: parameters,
        },
      };
    });

    try {
      const firstResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
        body: JSON.stringify({
          model: currentSettings.ai_model,
          messages: [{ role: "system", content: systemPrompt }, ...currentConversationHistory.slice(-currentSettings.conversation_memory_length)],
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
        }),
      });
      if (!firstResponse.ok) { 
        const errorData = await firstResponse.json(); 
        console.error("OpenAI API Error Response (first call):", errorData);
        throw new Error(`OpenAI API Error: ${errorData.error?.message || JSON.stringify(errorData)}`); 
      }
      const firstData = await firstResponse.json();
      const aiMessage = firstData.choices[0].message;
      
      currentConversationHistory = [...currentConversationHistory, aiMessage];
      setMessageHistory(currentConversationHistory);

      if (aiMessage.tool_calls) {
        const toolCall = aiMessage.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        speakRef.current(`Ok, vou usar a função ${functionName}.`, async () => { // Usar speakRef.current
          console.log(`[SophisticatedVoiceAssistant] onEndCallback for 'Ok, vou usar a função ${functionName}.' reached. Invoking Supabase function: ${functionName}`);
          try {
            const { data: functionResult, error: functionError } = await supabase.functions.invoke(functionName, { body: functionArgs });
            if (functionError) {
              console.error(`[SophisticatedVoiceAssistant] Error invoking Supabase function '${functionName}':`, functionError);
              throw functionError;
            }
            const toolResponseMessage = { tool_call_id: toolCall.id, role: "tool", name: functionName, content: JSON.stringify(functionResult) };
            
            currentConversationHistory = [...currentConversationHistory, toolResponseMessage];
            setMessageHistory(currentConversationHistory);

            const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
              body: JSON.stringify({ model: currentSettings.ai_model, messages: [{ role: "system", content: systemPrompt }, ...currentConversationHistory.slice(-currentSettings.conversation_memory_length)] }),
            });
            if (!secondResponse.ok) { 
              const errorData = await secondResponse.json(); 
              console.error("OpenAI API Second Call Error Response:", errorData);
              throw new Error(`OpenAI API Error: ${errorData.error?.message || JSON.stringify(errorData)}`); 
            }
            const secondData = await secondResponse.json();
            const finalMessage = secondData.choices[0].message;
            
            currentConversationHistory = [...currentConversationHistory, finalMessage];
            setMessageHistory(currentConversationHistory);

            speakRef.current(finalMessage.content, () => { // Usar speakRef.current
              console.log("[SophisticatedVoiceAssistant] onEndCallback for final AI content reached.");
            });
          } catch (e: any) {
            console.error("Error executing tool or second OpenAI call:", e);
            speakRef.current(`Desculpe, houve um erro ao executar a função ${functionName}. Detalhes: ${e.message}`); // Usar speakRef.current
          }
        });
      } else {
        speakRef.current(aiMessage.content, () => { // Usar speakRef.current
          console.log("[SophisticatedVoiceAssistant] onEndCallback for AI content reached.");
        });
      }
    } catch (e: any) {
      console.error("Error in runConversation:", e);
      showError(`Erro na conversa: ${e.message}`);
      speakRef.current("Desculpe, não consegui processar sua solicitação."); // Usar speakRef.current
    }
  }, [stopListening, systemVariables, session]); // Depende de stopListening (estável)

  const fetchAllAssistantData = useCallback(async () => {
    setIsLoading(true);
    try {
      let settingsData = null;
      const currentSession = sessionRef.current;

      if (currentSession) {
        const { data: workspaceMember } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', currentSession.user.id)
          .limit(1)
          .single();
        
        if (workspaceMember) {
          const { data } = await supabase
            .from("settings")
            .select("*")
            .eq('workspace_id', workspaceMember.workspace_id)
            .limit(1)
            .single();
          settingsData = data;
        }
      }
      
      if (!settingsData) {
        const { data } = await supabase
          .from("settings")
          .select("*")
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        settingsData = data;
      }
      
      setSettings(settingsData);

      const { data: powersData } = await supabase.from("powers").select("*");
      setPowers(powersData || []);
      const { data: actionsData } = await supabase.from("client_actions").select("*");
      setClientActions(actionsData || []);

      return settingsData;
    } catch (error) {
      console.error("Erro ao carregar dados do assistente:", error);
      showError("Erro ao carregar dados do assistente.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []); // Depende apenas de refs e setters, que são estáveis

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: "microphone" });
      setMicPermission(permissionStatus.state);
      if (permissionStatus.state === "granted") {
        startListening(); // Usar a função startListening estável
      } else {
        setIsPermissionModalOpen(true);
      }
      permissionStatus.onchange = () => setMicPermission(permissionStatus.state);
    } catch {
      setMicPermission("denied");
    }
  }, [startListening]); // Depende de startListening (estável)

  const handleAllowMic = useCallback(async () => {
    setIsPermissionModalOpen(false);
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      startListening(); // Usar a função startListening estável
    } catch {
      setMicPermission("denied");
      setIsPermissionModalOpen(true);
    }
  }, [startListening]); // Depende de startListening (estável)

  const handleManualActivation = useCallback(() => {
    if (isOpenRef.current) return;
    if (micPermission !== "granted") {
      checkAndRequestMicPermission(); // Usar a função checkAndRequestMicPermission estável
    } else {
      fetchAllAssistantDataRef.current().then((latestSettings) => { // Usar fetchAllAssistantDataRef.current
        if (!latestSettings) return;
        setIsOpen(true);
        const messageToSpeak = hasBeenActivatedRef.current && latestSettings.continuation_phrase ? latestSettings.continuation_phrase : latestSettings.welcome_message;
        speakRef.current(messageToSpeak, () => { if (isOpenRef.current) startListening(); }); // Usar speakRef.current e startListening estável
        setHasBeenActivated(true);
      });
    }
  }, [micPermission, checkAndRequestMicPermission, startListening]); // Depende de callbacks estáveis

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation(); // Usar a função handleManualActivation estável
    }
  }, [activationTrigger, handleManualActivation]);

  // --- useEffect para inicialização do SpeechRecognition e SpeechSynthesis (executa uma vez) ---
  useEffect(() => {
    console.log("[SophisticatedVoiceAssistant] Initializing SpeechRecognition and SpeechSynthesis.");
    synthRef.current = window.speechSynthesis;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado neste navegador.");
      setMicPermission("denied");
      stopPermanentlyRef.current = true;
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "pt-BR";

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      console.log("[SophisticatedVoiceAssistant] SpeechRecognition started.");
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
      console.log("[SophisticatedVoiceAssistant] SpeechRecognition ended.");
      if (!isSpeakingRef.current && !stopPermanentlyRef.current && isOpenRef.current) {
        setTimeout(() => {
          if (!isSpeakingRef.current && !stopPermanentlyRef.current && isOpenRef.current) {
            startListening(); // Usar a função startListening estável
          }
        }, 100); // Pequeno atraso para evitar condições de corrida
      }
    };

    recognition.onerror = (e) => {
      console.error("SpeechRecognition Error:", e);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicPermission("denied");
        setIsPermissionModalOpen(true);
      }
      isListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      if (!transcript) {
        console.warn("[SophisticatedVoiceAssistant] Empty transcript received, ignoring.");
        return;
      }
      const closePhrases = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];
      if (isOpenRef.current) {
        if (closePhrases.some((phrase) => transcript.includes(phrase))) {
          setIsOpen(false);
          setAiResponse("");
          setTranscript("");
          stopSpeaking(); // Usar a função stopSpeaking estável
          return;
        }
        const matchedAction = clientActionsRef.current.find((a) => transcript.includes(a.trigger_phrase.toLowerCase()));
        if (matchedAction) {
          executeClientActionRef.current(matchedAction); // Usar executeClientActionRef.current
          return;
        }
        runConversationRef.current(transcript); // Usar runConversationRef.current
      } else {
        if (settingsRef.current && transcript.includes(settingsRef.current.activation_phrase.toLowerCase())) {
          fetchAllAssistantDataRef.current().then((latestSettings) => { // Usar fetchAllAssistantDataRef.current
            if (!latestSettings) return;
            setIsOpen(true);
            const messageToSpeak = hasBeenActivatedRef.current && latestSettings.continuation_phrase ? latestSettings.continuation_phrase : latestSettings.welcome_message;
            speakRef.current(messageToSpeak, () => { if (isOpenRef.current) startListening(); }); // Usar speakRef.current e startListening estável
            setHasBeenActivated(true);
          });
        }
      }
    };
    recognitionRef.current = recognition;

    return () => {
      console.log("[SophisticatedVoiceAssistant] Cleaning up SpeechRecognition and SpeechSynthesis.");
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, []); // Array de dependências vazio para executar apenas uma vez

  // --- useEffect para inicialização do AudioContext e busca inicial de dados ---
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    fetchAllAssistantDataRef.current().then(() => { // Usar fetchAllAssistantDataRef.current
      setIsLoading(false);
      checkAndRequestMicPermission(); // Usar a função checkAndRequestMicPermission estável
    });

    return () => {
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, []); // Array de dependências vazio para executar apenas uma vez

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
          <AIScene audioIntensity={audioIntensity} />
        </div>
        <div />
        <div className="text-center select-text pointer-events-auto max-w-2xl mx-auto w-full">
          {displayedAiResponse && (
            <div className="bg-black/40 backdrop-blur-md border border-purple-500/20 rounded-xl p-6 shadow-lg shadow-purple-500/20">
              <p className="text-white text-2xl md:text-4xl font-bold leading-tight drop-shadow-lg">
                {displayedAiResponse}
              </p>
            </div>
          )}
          {transcript && (
            <p className="text-gray-400 text-lg mt-4">{transcript}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-4 p-4 bg-black/30 backdrop-blur-md rounded-2xl border border-cyan-400/20 shadow-lg shadow-cyan-500/20 pointer-events-auto">
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