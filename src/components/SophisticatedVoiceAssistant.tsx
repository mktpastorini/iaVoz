"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useSystem } from "@/contexts/SystemContext";
import { replacePlaceholders } from "@/lib/utils";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AudioVisualizer } from "@/components/AudioVisualizer";
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

const SophisticatedVoiceAssistant = ({ settings, isLoading }) => {
  const { session } = useSession();
  const { systemVariables } = useSystem();
  const { activationTrigger } = useVoiceAssistant();

  const [isOpen, setIsOpen] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
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
  const hasUserInteractedRef = useRef(hasUserInteracted);

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const audioRef = useRef(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const activationRequestedViaButton = useRef(false);
  const isTransitioningToSpeakRef = useRef(false);

  // Web Audio API refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationFrameRef = useRef(null);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Sync refs with state
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);
  useEffect(() => {
    hasBeenActivatedRef.current = hasBeenActivated;
  }, [hasBeenActivated]);
  useEffect(() => {
    powersRef.current = powers;
  }, [powers]);
  useEffect(() => {
    clientActionsRef.current = clientActions;
  }, [clientActions]);
  useEffect(() => {
    systemVariablesRef.current = systemVariables;
  }, [systemVariables]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    messageHistoryRef.current = messageHistory;
  }, [messageHistory]);
  useEffect(() => {
    hasUserInteractedRef.current = hasUserInteracted;
  }, [hasUserInteracted]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    if (
      isListeningRef.current ||
      isSpeakingRef.current ||
      stopPermanentlyRef.current ||
      !recognitionRef.current
    ) {
      return;
    }
    try {
      recognitionRef.current.start();
    } catch {}
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) {
      synthRef.current.cancel();
    }
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
      setIsSpeaking(false);
    }
  }, []);

  const setupAudioAnalysis = useCallback(() => {
    if (!audioContextRef.current && audioRef.current) {
      const context =
        new (window.AudioContext || window.webkitAudioContext)();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      const source = context.createMediaElementSource(audioRef.current);

      source.connect(analyser);
      analyser.connect(context.destination);

      audioContextRef.current = context;
      analyserRef.current = analyser;
      sourceRef.current = source;
    }
  }, []);

  const runAudioAnalysis = useCallback(() => {
    if (analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalized = Math.min(average / 128, 1.0);
      setAudioIntensity(normalized);
      animationFrameRef.current = requestAnimationFrame(runAudioAnalysis);
    }
  }, []);

  const speak = useCallback(
    async (text, onEndCallback) => {
      const currentSettings = settingsRef.current;
      if (!text || !currentSettings) {
        onEndCallback?.();
        return;
      }

      if (!hasUserInteractedRef.current) {
        // Não bloqueia, apenas não fala ainda
        console.warn("[speak] Bloqueado: usuário não interagiu ainda.");
        onEndCallback?.();
        return;
      }

      const onSpeechEnd = () => {
        isTransitioningToSpeakRef.current = false;
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setAudioIntensity(0);
        onEndCallback?.();
        if (isOpenRef.current) {
          startListening();
        }
      };

      isTransitioningToSpeakRef.current = true;
      stopListening();
      stopSpeaking();

      isSpeakingRef.current = true;
      setIsSpeaking(true);
      setAiResponse(text);

      try {
        if (
          currentSettings.voice_model === "browser" &&
          synthRef.current
        ) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = "pt-BR";
          utterance.onend = () => {
            onSpeechEnd();
          };
          utterance.onerror = () => {
            onSpeechEnd();
          };
          synthRef.current.speak(utterance);
        } else if (
          currentSettings.voice_model === "openai-tts" &&
          currentSettings.openai_api_key
        ) {
          const response = await fetch(OPENAI_TTS_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentSettings.openai_api_key}`,
            },
            body: JSON.stringify({
              model: "tts-1",
              voice: currentSettings.openai_tts_voice || "alloy",
              input: text,
            }),
          });
          if (!response.ok)
            throw new Error("Falha na API OpenAI TTS");
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          audioRef.current = new Audio(audioUrl);

          setupAudioAnalysis();

          audioRef.current.onended = () => {
            onSpeechEnd();
            URL.revokeObjectURL(audioUrl);
          };
          audioRef.current.onerror = () => {
            onSpeechEnd();
            URL.revokeObjectURL(audioUrl);
          };
          await audioRef.current.play();
          runAudioAnalysis();
        } else {
          onSpeechEnd();
        }
      } catch (e) {
        showError(`Erro na síntese de voz: ${e.message}`);
        onSpeechEnd();
      }
    },
    [
      stopSpeaking,
      stopListening,
      startListening,
      setupAudioAnalysis,
      runAudioAnalysis,
    ]
  );

  const executeClientAction = useCallback((action) => {
    stopListening();
    speak("Ok, executando.", () => {
      switch (action.action_type) {
        case 'OPEN_URL':
          window.open(action.action_payload.url, '_blank', 'noopener,noreferrer');
          startListening();
          break;
        case 'SHOW_IMAGE':
          setImageToShow(action.action_payload);
          break;
        case 'OPEN_IFRAME_URL':
          setUrlToOpenInIframe(action.action_payload.url);
          break;
        default:
          startListening();
          break;
      }
    });
  }, [speak, startListening, stopListening]);

  const runConversation = useCallback(async (userMessage) => {
    setTranscript(userMessage);
    stopListening();

    const newMessageHistory = [...messageHistoryRef.current, { role: "user", content: userMessage }];
    setMessageHistory(newMessageHistory);

    const systemPrompt = replacePlaceholders(settingsRef.current.system_prompt, systemVariablesRef.current);

    const tools = powersRef.current.map(power => ({
      type: "function",
      function: {
        name: power.name,
        description: power.description,
        parameters: power.parameters_schema || { type: "object", properties: {} },
      },
    }));

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settingsRef.current.openai_api_key}`,
        },
        body: JSON.stringify({
          model: settingsRef.current.ai_model,
          messages: [
            { role: "system", content: systemPrompt },
            ...newMessageHistory.slice(-settingsRef.current.conversation_memory_length),
          ],
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API Error: ${errorData.error.message}`);
      }

      const data = await response.json();
      const aiMessage = data.choices[0].message;

      setMessageHistory(prev => [...prev, aiMessage]);

      if (aiMessage.tool_calls) {
        const toolCall = aiMessage.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        speak(`Ok, vou usar a função ${functionName}.`, async () => {
          try {
            const { data: functionResult, error: functionError } = await supabase.functions.invoke(functionName, {
              body: functionArgs,
            });

            if (functionError) throw functionError;

            const toolResponseMessage = {
              tool_call_id: toolCall.id,
              role: "tool",
              name: functionName,
              content: JSON.stringify(functionResult),
            };

            const nextMessageHistory = [...newMessageHistory, aiMessage, toolResponseMessage];
            setMessageHistory(nextMessageHistory);

            const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${settingsRef.current.openai_api_key}`,
              },
              body: JSON.stringify({
                model: settingsRef.current.ai_model,
                messages: [
                  { role: "system", content: systemPrompt },
                  ...nextMessageHistory.slice(-settingsRef.current.conversation_memory_length),
                ],
              }),
            });

            if (!secondResponse.ok) {
              const errorData = await secondResponse.json();
              throw new Error(`OpenAI API Error: ${errorData.error.message}`);
            }

            const secondData = await secondResponse.json();
            const finalMessage = secondData.choices[0].message;
            setMessageHistory(prev => [...prev, finalMessage]);
            speak(finalMessage.content);

          } catch (e) {
            speak(`Desculpe, houve um erro ao executar a função ${functionName}.`);
          }
        });
      } else {
        speak(aiMessage.content);
      }
    } catch (e) {
      showError(`Erro na conversa: ${e.message}`);
      speak("Desculpe, não consegui processar sua solicitação.");
    }
  }, [speak, stopListening]);

  const initializeAssistant = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado.");
      setMicPermission("denied");
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      if (isTransitioningToSpeakRef.current) return;
      if (!stopPermanentlyRef.current) startListening();
    };

    recognitionRef.current.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicPermission("denied");
        showError("Permissão para microfone negada.");
      }
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      const closePhrases = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];

      if (isOpenRef.current) {
        if (closePhrases.some((phrase) => transcript.includes(phrase))) {
          setIsOpen(false);
          setAiResponse("");
          setTranscript("");
          stopSpeaking();
          return;
        }
        const matchedAction = clientActionsRef.current.find((a) =>
          transcript.includes(a.trigger_phrase.toLowerCase())
        );
        if (matchedAction) {
          executeClientAction(matchedAction);
          return;
        }
        runConversation(transcript);
      } else {
        if (
          settingsRef.current &&
          transcript.includes(settingsRef.current.activation_phrase.toLowerCase())
        ) {
          // Ativa o assistente por voz sem exigir clique, mas não fala até interação
          if (!hasUserInteractedRef.current) {
            setIsOpen(true);
            setAiResponse("Olá! Clique no botão do microfone para ativar o áudio e começar a falar comigo.");
            setTranscript("");
            return;
          }
          setIsOpen(true);
          const messageToSpeak =
            hasBeenActivatedRef.current && settingsRef.current.continuation_phrase
              ? settingsRef.current.continuation_phrase
              : settingsRef.current.welcome_message;
          speak(messageToSpeak, () => {
            if (isOpenRef.current) {
              startListening();
            }
          });
          setHasBeenActivated(true);
        }
      }
    };

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, [executeClientAction, runConversation, speak, startListening, stopSpeaking]);

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      const permissionStatus = await navigator.permissions.query({
        name: "microphone",
      });
      setMicPermission(permissionStatus.state);

      if (permissionStatus.state === "granted") {
        if (!recognitionRef.current) initializeAssistant();
        startListening();
      } else if (permissionStatus.state === "prompt") {
        setIsPermissionModalOpen(true);
      }
      permissionStatus.onchange = () => checkAndRequestMicPermission();
    } catch {
      setMicPermission("denied");
    }
  }, [initializeAssistant, startListening]);

  const handleManualActivation = useCallback(() => {
    if (isOpenRef.current) return;
    setHasUserInteracted(true);
    if (micPermission !== "granted") {
      activationRequestedViaButton.current = true;
      checkAndRequestMicPermission();
    } else {
      setIsOpen(true);
      const messageToSpeak =
        hasBeenActivatedRef.current && settingsRef.current?.continuation_phrase
          ? settingsRef.current.continuation_phrase
          : settingsRef.current?.welcome_message;
      speak(messageToSpeak, () => {
        if (isOpenRef.current) {
          startListening();
        }
      });
      setHasBeenActivated(true);
    }
  }, [micPermission, checkAndRequestMicPermission, speak, startListening]);

  const handleAllowMic = useCallback(async () => {
    setIsPermissionModalOpen(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      if (!recognitionRef.current) initializeAssistant();
      startListening();
      if (activationRequestedViaButton.current) {
        handleManualActivation();
        activationRequestedViaButton.current = false;
      }
    } catch {
      setMicPermission("denied");
      showError("Permissão para microfone negada.");
    }
  }, [initializeAssistant, startListening, handleManualActivation]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      if (hasUserInteracted) {
        handleManualActivation();
      } else {
        console.log(
          "Ignorando ativação por palavra porque o usuário ainda não interagiu."
        );
      }
    }
  }, [activationTrigger, handleManualActivation, hasUserInteracted]);

  useEffect(() => {
    if (isLoading) return;
    checkAndRequestMicPermission();
    return () => {
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, [isLoading, checkAndRequestMicPermission]);

  useEffect(() => {
    const fetchPowersAndActions = async () => {
      const { data: powersData, error: powersError } = await supabase
        .from("powers")
        .select("*");
      if (powersError) showError("Erro ao carregar os poderes da IA.");
      else setPowers(powersData || []);

      const { data: actionsData, error: actionsError } = await supabase
        .from("client_actions")
        .select("*");
      if (actionsError) showError("Erro ao carregar ações do cliente.");
      else setClientActions(actionsData || []);
    };
    fetchPowersAndActions();
  }, []);

  if (isLoading || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={handleAllowMic}
        onClose={() => setIsPermissionModalOpen(false)}
      />
      {!hasUserInteracted && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
          <Button
            onClick={handleManualActivation}
            size="lg"
            className="rounded-full w-16 h-16 shadow-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
          >
            <Mic size={32} />
          </Button>
        </div>
      )}
      {micPermission === "denied" && !isOpen && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
          <Button
            onClick={checkAndRequestMicPermission}
            size="lg"
            className="rounded-full w-16 h-16 shadow-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
          >
            <Mic size={32} />
          </Button>
        </div>
      )}
      {imageToShow && (
        <ImageModal
          imageUrl={imageToShow.imageUrl}
          altText={imageToShow.altText}
          onClose={() => {
            setImageToShow(null);
            startListening();
          }}
        />
      )}
      {urlToOpenInIframe && (
        <UrlIframeModal
          url={urlToOpenInIframe}
          onClose={() => {
            setUrlToOpenInIframe(null);
            startListening();
          }}
        />
      )}

      <div
        className={cn(
          "fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 transition-opacity duration-500",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Background and Nebula */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/60 via-blue-950/60 to-purple-950/60 backdrop-blur-xl" />
          <AIScene audioIntensity={audioIntensity} />
        </div>

        {/* Spacer for justify-between */}
        <div />

        {/* AI Response Area */}
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

        {/* Microphone Control Area */}
        <div className="flex items-center justify-center gap-4 p-4 bg-black/30 backdrop-blur-md rounded-2xl border border-cyan-400/20 shadow-lg shadow-cyan-500/20 pointer-events-auto">
          <AudioVisualizer isSpeaking={isSpeaking} />
          <div className="p-4 bg-cyan-900/20 rounded-full border border-cyan-400/30">
            <Mic
              className={cn(
                "h-8 w-8 text-cyan-300 transition-all",
                isListening &&
                  "text-cyan-200 animate-pulse drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]"
              )}
            />
          </div>
          <AudioVisualizer isSpeaking={isSpeaking} />
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;