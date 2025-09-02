"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { showSuccess, showError } from "@/utils/toast";
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

// Interfaces
interface Settings {
  welcome_message?: string;
  openai_api_key: string;
  system_prompt?: string;
  assistant_prompt?: string;
  ai_model?: string;
  conversation_memory_length: number;
  voice_model: "browser" | "openai-tts" | "gemini-tts";
  openai_tts_voice?: string;
  activation_phrase: string;
  continuation_phrase?: string;
}

interface VoiceAssistantProps {
  settings: Settings | null;
  isLoading: boolean;
}

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

interface Power {
  id: string;
  name: string;
  description: string | null;
  method: string;
  url: string | null;
  headers: Record<string, string> | null;
  body: Record<string, any> | null;
  api_key_id: string | null;
  parameters_schema: Record<string, any> | null;
}

interface ClientAction {
  id: string;
  trigger_phrase: string;
  action_type: 'OPEN_URL' | 'SHOW_IMAGE' | 'OPEN_IFRAME_URL';
  action_payload: {
    url?: string;
    imageUrl?: string;
    altText?: string;
  };
}

// Constants
const OPENAI_TTS_API_URL = "https://api.openai.com/v1/audio/speech";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

// Modal Component
const ImageModal = ({ imageUrl, altText, onClose }: { imageUrl: string; altText?: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70" onClick={onClose}>
    <div className="relative max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
      <img src={imageUrl} alt={altText || 'Imagem exibida pelo assistente'} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 rounded-full" onClick={onClose}><X /></Button>
    </div>
  </div>
);

// Main Component
const SophisticatedVoiceAssistant: React.FC<VoiceAssistantProps> = ({
  settings,
  isLoading,
}) => {
  const { workspace, session } = useSession();
  const { systemVariables } = useSystem();
  const { activationTrigger } = useVoiceAssistant();

  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [powers, setPowers] = useState<Power[]>([]);
  const [clientActions, setClientActions] = useState<ClientAction[]>([]);
  const [imageToShow, setImageToShow] = useState<ClientAction['action_payload'] | null>(null);
  const [urlToOpenInIframe, setUrlToOpenInIframe] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [hasBeenActivated, setHasBeenActivated] = useState(false);

  // Refs para estados e props dinâmicos
  const settingsRef = useRef(settings);
  const isOpenRef = useRef(isOpen);
  const isListeningRef = useRef(isListening);
  const isSpeakingRef = useRef(isSpeaking);
  const hasBeenActivatedRef = useRef(hasBeenActivated);
  const powersRef = useRef(powers);
  const clientActionsRef = useRef(clientActions);
  const messageHistoryRef = useRef(messageHistory);
  const systemVariablesRef = useRef(systemVariables);
  const sessionRef = useRef(session);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const activationRequestedViaButton = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Novo ref para o timeout de reinício

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Efeitos para sincronizar refs com estados/props
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { hasBeenActivatedRef.current = hasBeenActivated; }, [hasBeenActivated]);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { clientActionsRef.current = clientActions; }, [clientActions]);
  useEffect(() => { messageHistoryRef.current = messageHistory; }, [messageHistory]);
  useEffect(() => { systemVariablesRef.current = systemVariables; }, [systemVariables]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const scheduleRestartListening = useCallback((delay: number) => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      console.log('[VA] Timeout de reinício anterior cancelado.');
    }
    if (!stopPermanentlyRef.current) {
      restartTimeoutRef.current = setTimeout(() => {
        console.log(`[VA] Agendamento de reinício executado após ${delay}ms.`);
        startListening();
        restartTimeoutRef.current = null;
      }, delay);
      console.log(`[VA] Reinício da escuta agendado para ${delay}ms.`);
    } else {
      console.log('[VA] Não agendando reinício: assistente parado permanentemente.');
    }
  }, []);

  const startListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
      console.log('[VA] Timeout de reinício cancelado ao iniciar escuta.');
    }

    if (recognitionRef.current && !stopPermanentlyRef.current) {
      if (recognitionRef.current.recognizing) {
        console.log('[VA] Reconhecimento já ativo, parando antes de reiniciar.');
        recognitionRef.current.stop();
      }
      try {
        console.log('[VA] Tentando iniciar a escuta...');
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
      } catch (error) {
        console.error("[VA] Erro ao iniciar reconhecimento:", error);
        // Se houver um erro ao iniciar, agendamos um novo reinício
        scheduleRestartListening(2000);
      }
    } else {
      console.log('[VA] Não foi possível iniciar a escuta: parado permanentemente ou reconhecimento não inicializado.');
    }
  }, [scheduleRestartListening]);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
      console.log('[VA] Timeout de reinício cancelado ao parar escuta.');
    }
    if (recognitionRef.current && recognitionRef.current.recognizing) {
      console.log('[VA] Parando a escuta...');
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
    } else if (isListeningRef.current) {
      console.log('[VA] Reconhecimento não estava ativo, mas o estado indicava escuta. Sincronizando estado.');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) {
      console.log('[VA] Parando a síntese de voz do navegador.');
      synthRef.current.cancel();
    }
    if (audioRef.current && !audioRef.current.paused) {
      console.log('[VA] Parando o áudio do OpenAI TTS.');
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, []);

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }
    console.log(`[VA] Preparando para falar: "${text}"`);
    stopListening();
    stopSpeaking();
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setAiResponse(text);

    const onSpeechEnd = () => {
      console.log('[VA] Finalizou a fala.');
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      onEndCallback?.();
      if (isOpenRef.current && !stopPermanentlyRef.current) {
        console.log('[VA] Assistente aberto após fala, agendando reinício da escuta.');
        scheduleRestartListening(500);
      }
    };

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        console.log('[VA] Usando o modelo de voz do navegador.');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        console.log('[VA] Usando o modelo de voz OpenAI TTS.');
        const response = await fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: "tts-1", voice: currentSettings.openai_tts_voice || "alloy", input: text }),
        });
        if (!response.ok) throw new Error("Falha na API OpenAI TTS");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
      } else {
        console.warn('[VA] Nenhum modelo de voz válido configurado. Pulando a fala.');
        onSpeechEnd();
      }
    } catch (error) {
      console.error("[VA] Erro durante a fala:", error);
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, scheduleRestartListening]);

  const runConversation = useCallback(async (userInput: string) => {
    const currentSettings = settingsRef.current;
    const currentPowers = powersRef.current;
    const currentSystemVariables = systemVariablesRef.current;
    const currentMessageHistory = messageHistoryRef.current;

    if (!currentSettings || !currentSettings.openai_api_key) {
      speak("Chave API OpenAI não configurada.", startListening);
      return;
    }
    console.log(`[VA] Executando conversa com entrada: "${userInput}"`);
    stopListening();
    setTranscript(userInput);
    setAiResponse("Pensando...");
    
    const newHistory = [...currentMessageHistory, { role: "user" as const, content: userInput }];
    setMessageHistory(newHistory);

    const tools = currentPowers.map(p => {
      let parameters: Record<string, any> = {};
      try {
        parameters = p.parameters_schema ? p.parameters_schema : { type: "object", properties: {} };
      } catch (e) {
        console.error(`[VA] Erro ao parsear parameters_schema para o poder '${p.name}':`, e);
        parameters = { type: "object", properties: {} };
      }
      return { type: 'function' as const, function: { name: p.name, description: p.description, parameters: parameters } };
    });
    
    const messagesForApi = [
      { role: "system" as const, content: currentSettings.system_prompt },
      { role: "assistant" as const, content: currentSettings.assistant_prompt },
      ...newHistory.slice(-currentSettings.conversation_memory_length) 
    ];

    try {
      console.log('[VA] Enviando requisição para OpenAI Chat Completions...');
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
        body: JSON.stringify({ model: currentSettings.ai_model, messages: messagesForApi, tools: tools.length > 0 ? tools : undefined, tool_choice: tools.length > 0 ? 'auto' : undefined }),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        console.error("[VA] Erro detalhado da API OpenAI:", errorBody);
        throw new Error(`Erro na API OpenAI: ${errorBody.error?.message || response.statusText}`);
      }
      const data = await response.json();
      const responseMessage = data.choices?.[0]?.message;
      console.log('[VA] Resposta recebida da OpenAI:', responseMessage);

      if (responseMessage.tool_calls) {
        console.log('[VA] Chamada de ferramenta detectada. Executando ferramentas...');
        setAiResponse("Executando ação...");
        const historyWithToolCall = [...newHistory, responseMessage];
        setMessageHistory(historyWithToolCall);

        const toolOutputs = await Promise.all(responseMessage.tool_calls.map(async (toolCall: any) => {
          console.log(`[VA] Executando ferramenta: ${toolCall.function.name}`);
          const power = currentPowers.find(p => p.name === toolCall.function.name);
          if (!power) {
            console.error(`[VA] Poder '${toolCall.function.name}' não encontrado.`);
            return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: 'Poder não encontrado.' };
          }
          
          const args = JSON.parse(toolCall.function.arguments);
          
          const isInternalFunction = power.url?.includes('supabase.co/functions/v1/');
          const functionName = isInternalFunction ? power.url.split('/functions/v1/')[1] : null;

          let toolResult, invokeError;

          if (isInternalFunction && functionName && (functionName === 'set-user-field' || functionName === 'get-user-field' || functionName === 'get-client-data' || functionName === 'save-client-data')) {
            console.log(`[VA] Invocando função interna '${functionName}' diretamente com args:`, args);
            
            // Para usuários anônimos, não passamos o token de autenticação
            const headers: Record<string, string> = {};
            if (sessionRef.current?.access_token) {
              headers.Authorization = `Bearer ${sessionRef.current.access_token}`;
            }
            
            const { data, error } = await supabase.functions.invoke(functionName, { 
              body: args,
              headers: Object.keys(headers).length > 0 ? headers : undefined,
            });
            
            if (error) {
              invokeError = error;
              toolResult = { ok: false, status: 500, data: { error: error.message } };
            } else {
              invokeError = null;
              toolResult = { ok: true, status: 200, data: data };
            }
          } else {
            let processedUrl = replacePlaceholders(power.url || '', { ...currentSystemVariables, ...args });
            let processedHeaders = power.headers ? JSON.parse(replacePlaceholders(JSON.stringify(power.headers), { ...currentSystemVariables, ...args })) : {};
            let processedBody = (power.body && (power.method === "POST" || power.method === "PUT" || power.method === "PATCH")) 
              ? JSON.parse(replacePlaceholders(JSON.stringify(power.body), { ...currentSystemVariables, ...args })) 
              : undefined;

            const payload = { url: processedUrl, method: power.method, headers: processedHeaders, body: processedBody };
            
            console.log(`[VA] Invocando 'proxy-api' para poder '${power.name}' com payload:`, payload);
            const { data, error } = await supabase.functions.invoke('proxy-api', { body: payload });
            toolResult = data;
            invokeError = error;
          }
          
          if (invokeError) {
            console.error(`[VA] Erro ao invocar função para poder '${power.name}':`, invokeError);
            return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: JSON.stringify({ error: invokeError.message }) };
          }
          console.log(`[VA] Resultado da ferramenta '${power.name}':`, toolResult);
          return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: JSON.stringify(toolResult) };
        }));

        console.log('[VA] Execução da ferramenta finalizada. Enviando resultados de volta para a OpenAI...');
        const historyWithToolResults = [...historyWithToolCall, ...toolOutputs];
        setMessageHistory(historyWithToolResults);
        
        const secondResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: currentSettings.ai_model, messages: historyWithToolResults }),
        });
        if (!secondResponse.ok) {
          const errorBody = await secondResponse.json();
          console.error("[VA] Erro detalhado na 2ª chamada OpenAI:", errorBody);
          throw new Error(`Erro na 2ª chamada OpenAI: ${errorBody.error?.message || secondResponse.statusText}`);
        }
        const secondData = await secondResponse.json();
        const finalMessage = secondData.choices?.[0]?.message?.content;
        console.log('[VA] Resposta final recebida da OpenAI:', finalMessage);
        setMessageHistory(prev => [...prev, { role: 'assistant', content: finalMessage }]);
        speak(finalMessage, startListening);
      } else {
        const assistantMessage = responseMessage.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
        speak(assistantMessage, startListening);
      }
    } catch (error: any) {
      console.error('[VA] Erro no fluxo da conversa:', error);
      showError(error.message || "Desculpe, ocorreu um erro.");
      speak("Desculpe, ocorreu um erro.", startListening);
    }
  }, [speak, startListening, stopListening, setMessageHistory]);

  const executeClientAction = useCallback((action: ClientAction) => {
    console.log(`[VA] Executando ação do cliente: ${action.action_type}`);
    stopListening();
    switch (action.action_type) {
      case 'OPEN_URL':
        if (action.action_payload.url) {
          speak(`Abrindo ${action.action_payload.url}`, () => {
            window.open(action.action_payload.url, '_blank');
            startListening();
          });
        }
        break;
      case 'OPEN_IFRAME_URL':
        if (action.action_payload.url) {
          speak("Ok, abrindo conteúdo.", () => setUrlToOpenInIframe(action.action_payload.url!));
        }
        break;
      case 'SHOW_IMAGE':
        if (action.action_payload.imageUrl) {
          speak("Claro, aqui está a imagem.", () => setImageToShow(action.action_payload));
        }
        break;
    }
  }, [speak, startListening, stopListening]);

  const initializeAssistant = useCallback(() => {
    console.log('[VA] Inicializando assistente...');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado.");
      setMicPermission('denied');
      console.error('[VA] API de Reconhecimento de Fala não suportada neste navegador.');
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";

    recognitionRef.current.onstart = () => {
      console.log('[VA] Reconhecimento de voz iniciado.');
      setIsListening(true);
      isListeningRef.current = true;
    };
    
    recognitionRef.current.onend = () => {
      console.log('[VA] Reconhecimento de voz finalizado.');
      setIsListening(false);
      isListeningRef.current = false;
      if (!isSpeakingRef.current && !stopPermanentlyRef.current) {
        console.log('[VA] Reiniciando escuta após onend (não estava falando)...');
        scheduleRestartListening(1000);
      }
    };
    
    recognitionRef.current.onerror = (e) => {
      console.log(`[VA] Erro no reconhecimento de voz: ${e.error}`);
      setIsListening(false);
      isListeningRef.current = false;
      if ((e.error === 'no-speech' || e.error === 'audio-capture' || e.error === 'network') && !isSpeakingRef.current && !stopPermanentlyRef.current) {
        console.log('[VA] Reiniciando escuta após erro esperado...');
        scheduleRestartListening(2000);
      } else if (!stopPermanentlyRef.current) {
        console.error(`[VA] Erro crítico no reconhecimento de voz: ${e.error}. Tentando reiniciar...`);
        scheduleRestartListening(5000);
      }
    };
    
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      console.log(`[VA] Transcrição ouvida: "${transcript}"`);
      const closePhrases = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];

      const currentIsOpen = isOpenRef.current;
      const currentSettings = settingsRef.current;
      const currentClientActions = clientActionsRef.current;
      const currentHasBeenActivated = hasBeenActivatedRef.current;

      if (currentIsOpen) {
        if (closePhrases.some(phrase => transcript.includes(phrase))) {
          console.log('[VA] Frase de encerramento detectada. Fechando assistente.');
          setIsOpen(false);
          setAiResponse("");
          setTranscript("");
          stopSpeaking();
          stopListening();
          scheduleRestartListening(1000); // Reinicia a escuta passiva após fechar
          return;
        }
        const matchedAction = currentClientActions.find(a => transcript.includes(a.trigger_phrase));
        if (matchedAction) {
          console.log(`[VA] Ação do cliente correspondida: ${matchedAction.trigger_phrase}.`);
          executeClientAction(matchedAction);
          return;
        }
        console.log('[VA] Nenhuma ação do cliente correspondida. Iniciando turno da conversa.');
        runConversation(transcript);
      } else {
        if (currentSettings && transcript.includes(currentSettings.activation_phrase.toLowerCase())) {
          console.log('[VA] Frase de ativação detectada. Abrindo assistente.');
          setIsOpen(true);
          const messageToSpeak = currentHasBeenActivated && currentSettings.continuation_phrase
            ? currentSettings.continuation_phrase
            : currentSettings.welcome_message;
          speak(messageToSpeak, startListening);
          setHasBeenActivated(true);
        }
      }
    };

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      console.log('[VA] Síntese de voz inicializada.');
    } else {
      showError("Síntese de voz não suportada.");
      console.error('[VA] API de Síntese de Fala não suportada neste navegador.');
    }
  }, [speak, startListening, stopSpeaking, stopListening, runConversation, executeClientAction, setIsOpen, setAiResponse, setTranscript, setHasBeenActivated, scheduleRestartListening]);

  const checkAndRequestMicPermission = useCallback(async () => {
    console.log('[VA] Verificando permissão do microfone...');
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log(`[VA] Status da permissão: ${permissionStatus.state}`);
      setMicPermission(permissionStatus.state);

      if (permissionStatus.state === 'granted') {
        initializeAssistant();
        if (!isOpenRef.current && !isSpeakingRef.current && !isListeningRef.current) {
          scheduleRestartListening(1000);
        }
      } else if (permissionStatus.state === 'prompt') {
        setIsPermissionModalOpen(true);
      } else {
        showError("Permissão para microfone negada. Habilite nas configurações do seu navegador.");
      }
      permissionStatus.onchange = () => {
        console.log(`[VA] Status da permissão alterado para: ${permissionStatus.state}`);
        setMicPermission(permissionStatus.state);
        if (permissionStatus.state === 'granted') {
          initializeAssistant();
          if (!isListeningRef.current) {
            scheduleRestartListening(1000);
          }
        }
      };
    } catch (error) {
      console.error("[VA] Erro ao verificar permissão do microfone:", error);
      showError("Não foi possível verificar a permissão do microfone.");
      setMicPermission('denied');
    }
  }, [initializeAssistant, scheduleRestartListening]);

  const handleAllowMic = async () => {
    console.log('[VA] Usuário clicou em "Permitir Microfone".');
    setIsPermissionModalOpen(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[VA] Acesso ao microfone concedido pelo usuário.');
      setMicPermission('granted');
      initializeAssistant();

      if (activationRequestedViaButton.current) {
        activationRequestedViaButton.current = false;
        setTimeout(() => {
          const currentSettings = settingsRef.current;
          const currentHasBeenActivated = hasBeenActivatedRef.current;
          setIsOpen(true);
          const messageToSpeak = currentHasBeenActivated && currentSettings?.continuation_phrase
            ? currentSettings.continuation_phrase
            : currentSettings?.welcome_message;
          speak(messageToSpeak, startListening);
          setHasBeenActivated(true);
        }, 100);
      } else {
        if (!isListeningRef.current) {
          scheduleRestartListening(1000);
        }
      }
    } catch (error) {
      console.error("[VA] Usuário negou a permissão do microfone:", error);
      setMicPermission('denied');
      showError("Você precisa permitir o uso do microfone para continuar.");
    }
  };

  const handleManualActivation = useCallback(() => {
    const currentIsOpen = isOpenRef.current;
    const currentSettings = settingsRef.current;
    const currentHasBeenActivated = hasBeenActivatedRef.current;

    if (currentIsOpen) return;

    if (micPermission !== 'granted') {
      activationRequestedViaButton.current = true;
      checkAndRequestMicPermission();
    } else {
      setIsOpen(true);
      const messageToSpeak = currentHasBeenActivated && currentSettings?.continuation_phrase
        ? currentSettings.continuation_phrase
        : currentSettings?.welcome_message;
      speak(messageToSpeak, startListening);
      setHasBeenActivated(true);
    }
  }, [micPermission, checkAndRequestMicPermission, speak, startListening, setIsOpen, setHasBeenActivated]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    if (isLoading) return;
    console.log('[VA] Configurações carregadas. Iniciando verificação de permissão.');
    checkAndRequestMicPermission();
    return () => {
      console.log('[VA] Desmontando componente. Limpando...');
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
    };
  }, [isLoading, checkAndRequestMicPermission]);

  useEffect(() => {
    // Buscar poderes e ações do cliente do workspace padrão (para usuários anônimos) ou do workspace do usuário
    console.log('[VA] Buscando poderes e ações do cliente...');
    const fetchPowers = async () => {
      const { data, error } = await supabase.from('powers').select('*').order('created_at', { ascending: true }).limit(100);
      if (error) {
        console.error("Erro ao carregar os poderes da IA:", error);
        showError("Erro ao carregar os poderes da IA.");
      } else {
        setPowers(data || []);
      }
    };
    const fetchClientActions = async () => {
      const { data, error } = await supabase.from('client_actions').select('*').order('created_at', { ascending: true }).limit(100);
      if (error) {
        console.error("Erro ao carregar ações do cliente:", error);
        showError("Erro ao carregar ações do cliente.");
      } else {
        setClientActions(data || []);
      }
    };
    fetchPowers();
    fetchClientActions();
  }, []);

  if (isLoading || !settings) {
    return null;
  }

  return (
    <>
      <MicrophonePermissionModal
        isOpen={isPermissionModalOpen}
        onAllow={handleAllowMic}
        onClose={() => setIsPermissionModalOpen(false)}
      />
      {micPermission !== 'granted' && micPermission !== 'checking' && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
          <Button onClick={checkAndRequestMicPermission} size="lg" className="rounded-full w-16 h-16 md:w-20 md-h-20 bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 shadow-lg transform hover:scale-110 transition-transform duration-200 flex items-center justify-center">
            <Mic size={32} />
          </Button>
        </div>
      )}
      {imageToShow && (
        <ImageModal
          imageUrl={imageToShow.imageUrl!}
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
      <div className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center p-4 md:p-8 transition-all duration-500",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-center">
          <div className="flex-grow flex items-center justify-center">
            <p className="text-white text-3xl md:text-5xl font-bold leading-tight drop-shadow-lg">
              {displayedAiResponse}
            </p>
          </div>
          <AudioVisualizer isSpeaking={isSpeaking} />
          <div className="h-16">
            <p className="text-gray-400 text-lg md:text-xl">{transcript}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;