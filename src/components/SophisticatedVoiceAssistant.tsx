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
import { Mic, X, Send, Info } from "lucide-react";
import { UrlIframeModal } from "./UrlIframeModal";
import { MicrophonePermissionModal } from "./MicrophonePermissionModal";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
const OPENAI_WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";
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

// Função para detectar suporte à Web Speech API
const hasWebSpeechSupport = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

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
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
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
  const [useWebSpeech, setUseWebSpeech] = useState(true);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false); // Novo estado para rastrear interação

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const activationRequestedViaButton = useRef(false);
  const isInitializingRef = useRef(false);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Detecta interação do usuário para habilitar áudio
  useEffect(() => {
    const handleUserInteraction = () => {
      setUserHasInteracted(true);
      console.log('[VA] Interação do usuário detectada, áudio habilitado.');
    };

    // Adiciona listeners para vários tipos de interação
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // Função para transcrever áudio usando OpenAI Whisper
  const transcribeWithWhisper = useCallback(async (audioBlob: Blob): Promise<string> => {
    const currentSettings = settingsRef.current;
    if (!currentSettings?.openai_api_key) {
      throw new Error("Chave API OpenAI não configurada");
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const response = await fetch(OPENAI_WHISPER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentSettings.openai_api_key}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Erro na API Whisper: ${errorBody.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.text || '';
  }, []);

  // Função melhorada para iniciar gravação com timeout automático
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessingAudio(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          console.log('[VA] Transcrevendo áudio com Whisper...');
          const transcription = await transcribeWithWhisper(audioBlob);
          console.log(`[VA] Transcrição recebida: "${transcription}"`);
          handleTranscription(transcription);
        } catch (error) {
          console.error('[VA] Erro na transcrição:', error);
          showError("Erro ao transcrever áudio.");
        } finally {
          setIsProcessingAudio(false);
        }
        
        // Limpa o stream
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log('[VA] Gravação iniciada.');

      // Auto-stop após 30 segundos para evitar gravações muito longas
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('[VA] Parando gravação automaticamente após 30 segundos.');
          stopRecording();
        }
      }, 30000);

    } catch (error) {
      console.error('[VA] Erro ao iniciar gravação:', error);
      showError("Erro ao acessar o microfone.");
    }
  }, [transcribeWithWhisper]);

  // Função melhorada para parar gravação
  const stopRecording = useCallback(() => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      console.log('[VA] Gravação parada.');
    }
  }, []);

  // Função para processar transcrição (comum para ambos os métodos)
  const handleTranscription = useCallback((transcript: string) => {
    const cleanTranscript = transcript.trim().toLowerCase();
    console.log(`[VA] Processando transcrição: "${cleanTranscript}"`);
    
    const closePhrases = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];
    const currentIsOpen = isOpenRef.current;
    const currentSettings = settingsRef.current;
    const currentClientActions = clientActionsRef.current;
    const currentHasBeenActivated = hasBeenActivatedRef.current;

    if (currentIsOpen) {
      if (closePhrases.some(phrase => cleanTranscript.includes(phrase))) {
        console.log('[VA] Frase de encerramento detectada. Fechando assistente.');
        setIsOpen(false);
        setAiResponse("");
        setTranscript("");
        stopSpeaking();
        stopListening();
        // Reinicia a escuta passiva após fechar
        setTimeout(() => startListening(), 2000);
        return;
      }
      
      const matchedAction = currentClientActions.find(a => cleanTranscript.includes(a.trigger_phrase));
      if (matchedAction) {
        console.log(`[VA] Ação do cliente correspondida: ${matchedAction.trigger_phrase}.`);
        executeClientAction(matchedAction);
        return;
      }
      
      console.log('[VA] Iniciando conversa com IA.');
      runConversation(cleanTranscript);
    } else {
      if (currentSettings && cleanTranscript.includes(currentSettings.activation_phrase.toLowerCase())) {
        console.log('[VA] Frase de ativação detectada. Abrindo assistente.');
        setIsOpen(true);
        const messageToSpeak = currentHasBeenActivated && currentSettings.continuation_phrase
          ? currentSettings.continuation_phrase
          : currentSettings.welcome_message;
        speak(messageToSpeak);
        setHasBeenActivated(true);
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (stopPermanentlyRef.current || isInitializingRef.current) {
      console.log('[VA] Não iniciando escuta: parado permanentemente ou inicializando.');
      return;
    }

    if (isListeningRef.current) {
      console.log('[VA] Já está ouvindo, ignorando startListening.');
      return;
    }

    if (useWebSpeech && recognitionRef.current) {
      try {
        console.log('[VA] Iniciando escuta com Web Speech API...');
        recognitionRef.current.start();
      } catch (error) {
        console.error("[VA] Erro ao iniciar reconhecimento:", error);
      }
    } else if (!useWebSpeech) {
      // Para navegadores sem suporte, apenas marca como "ouvindo" para escuta passiva
      console.log('[VA] Modo de escuta passiva ativado (aguardando clique no botão).');
      setIsListening(true);
      isListeningRef.current = true;
    }
  }, [useWebSpeech]);

  const stopListening = useCallback(() => {
    if (useWebSpeech && recognitionRef.current && isListeningRef.current) {
      console.log('[VA] Parando a escuta Web Speech API...');
      recognitionRef.current.stop();
    } else if (!useWebSpeech) {
      console.log('[VA] Parando modo de escuta passiva...');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [useWebSpeech]);

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
      // Só reinicia a escuta se o assistente estiver aberto
      if (isOpenRef.current && !stopPermanentlyRef.current) {
        console.log('[VA] Reiniciando escuta após fala.');
        setTimeout(() => startListening(), 1000);
      }
    };

    // Função para fallback para síntese de voz do navegador
    const fallbackToBrowserSpeech = () => {
      console.log('[VA] Usando fallback para síntese de voz do navegador.');
      if (synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = onSpeechEnd;
        synthRef.current.speak(utterance);
      } else {
        console.warn('[VA] Síntese de voz do navegador não disponível.');
        onSpeechEnd();
      }
    };

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        console.log('[VA] Usando o modelo de voz do navegador.');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = onSpeechEnd;
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        console.log('[VA] Usando o modelo de voz OpenAI TTS.');
        
        // Se o usuário não interagiu ainda, usa fallback imediatamente
        if (!userHasInteracted) {
          console.log('[VA] Usuário ainda não interagiu, usando fallback para síntese do navegador.');
          fallbackToBrowserSpeech();
          return;
        }

        try {
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
          audioRef.current.onerror = (error) => { 
            console.error('[VA] Erro ao reproduzir áudio OpenAI TTS:', error);
            URL.revokeObjectURL(audioUrl);
            fallbackToBrowserSpeech();
          };
          await audioRef.current.play();
        } catch (error) {
          console.error('[VA] Erro com OpenAI TTS, usando fallback:', error);
          fallbackToBrowserSpeech();
        }
      } else {
        console.warn('[VA] Nenhum modelo de voz válido configurado. Pulando a fala.');
        onSpeechEnd();
      }
    } catch (error) {
      console.error("[VA] Erro durante a fala:", error);
      fallbackToBrowserSpeech();
    }
  }, [stopSpeaking, stopListening, startListening, userHasInteracted]);

  const runConversation = useCallback(async (userInput: string) => {
    const currentSettings = settingsRef.current;
    const currentPowers = powersRef.current;
    const currentSystemVariables = systemVariablesRef.current;
    const currentMessageHistory = messageHistoryRef.current;

    if (!currentSettings || !currentSettings.openai_api_key) {
      speak("Chave API OpenAI não configurada.");
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
        speak(finalMessage);
      } else {
        const assistantMessage = responseMessage.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
        speak(assistantMessage);
      }
    } catch (error: any) {
      console.error('[VA] Erro no fluxo da conversa:', error);
      showError(error.message || "Desculpe, ocorreu um erro.");
      speak("Desculpe, ocorreu um erro.");
    }
  }, [speak, stopListening, setMessageHistory]);

  const executeClientAction = useCallback((action: ClientAction) => {
    console.log(`[VA] Executando ação do cliente: ${action.action_type}`);
    stopListening();
    switch (action.action_type) {
      case 'OPEN_URL':
        if (action.action_payload.url) {
          speak(`Abrindo ${action.action_payload.url}`, () => {
            window.open(action.action_payload.url, '_blank');
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
  }, [speak, stopListening]);

  const initializeAssistant = useCallback(() => {
    if (isInitializingRef.current) {
      console.log('[VA] Já está inicializando, ignorando.');
      return;
    }
    
    isInitializingRef.current = true;
    console.log('[VA] Inicializando assistente...');
    
    // Determina qual método de reconhecimento usar
    const webSpeechSupported = hasWebSpeechSupport();
    const hasOpenAIKey = settingsRef.current?.openai_api_key;
    
    if (webSpeechSupported) {
      console.log('[VA] Web Speech API suportada, usando reconhecimento nativo.');
      setUseWebSpeech(true);
      setShowBrowserWarning(false);
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
          console.log('[VA] Reiniciando escuta após onend.');
          setTimeout(() => startListening(), 2000);
        }
      };
      
      recognitionRef.current.onerror = (e) => {
        console.log(`[VA] Erro no reconhecimento de voz: ${e.error}`);
        setIsListening(false);
        isListeningRef.current = false;
        
        if ((e.error === 'no-speech' || e.error === 'audio-capture') && !isSpeakingRef.current && !stopPermanentlyRef.current) {
          console.log('[VA] Reiniciando escuta após erro esperado.');
          setTimeout(() => startListening(), 3000);
        }
      };
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log(`[VA] Transcrição Web Speech: "${transcript}"`);
        handleTranscription(transcript);
      };
    } else if (hasOpenAIKey) {
      console.log('[VA] Web Speech API não suportada, usando OpenAI Whisper.');
      setUseWebSpeech(false);
      setShowBrowserWarning(true);
    } else {
      console.error('[VA] Nem Web Speech API nem OpenAI API disponíveis.');
      showError("Reconhecimento de voz não suportado neste navegador e chave OpenAI não configurada.");
      isInitializingRef.current = false;
      return;
    }

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      console.log('[VA] Síntese de voz inicializada.');
    } else {
      console.log('[VA] Síntese de voz não suportada, usando apenas OpenAI TTS.');
    }
    
    isInitializingRef.current = false;
    
    // Inicia a escuta passiva após a inicialização
    setTimeout(() => startListening(), 1000);
  }, [handleTranscription, startListening]);

  const checkAndRequestMicPermission = useCallback(async () => {
    console.log('[VA] Verificando permissão do microfone...');
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log(`[VA] Status da permissão: ${permissionStatus.state}`);
      setMicPermission(permissionStatus.state);

      if (permissionStatus.state === 'granted') {
        initializeAssistant();
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
        }
      };
    } catch (error) {
      console.error("[VA] Erro ao verificar permissão do microfone:", error);
      showError("Não foi possível verificar a permissão do microfone.");
      setMicPermission('denied');
    }
  }, [initializeAssistant]);

  const handleAllowMic = async () => {
    console.log('[VA] Usuário clicou em "Permitir Microfone".');
    setIsPermissionModalOpen(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[VA] Acesso ao microfone concedido pelo usuário.');
      setMicPermission('granted');
      setUserHasInteracted(true); // Marca que o usuário interagiu
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
          speak(messageToSpeak);
          setHasBeenActivated(true);
        }, 100);
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

    setUserHasInteracted(true); // Marca que o usuário interagiu

    if (micPermission !== 'granted') {
      activationRequestedViaButton.current = true;
      checkAndRequestMicPermission();
    } else {
      setIsOpen(true);
      const messageToSpeak = currentHasBeenActivated && currentSettings?.continuation_phrase
        ? currentSettings.continuation_phrase
        : currentSettings?.welcome_message;
      speak(messageToSpeak);
      setHasBeenActivated(true);
    }
  }, [micPermission, checkAndRequestMicPermission, speak, setIsOpen, setHasBeenActivated]);

  // Função melhorada para ativação manual via botão "Falar"
  const handleSpeakButton = useCallback(() => {
    setUserHasInteracted(true); // Marca que o usuário interagiu
    
    if (isRecording) {
      // Se está gravando, para e envia
      stopRecording();
    } else if (isProcessingAudio) {
      // Se está processando, não faz nada
      return;
    } else {
      // Se não está gravando, inicia
      startRecording();
    }
  }, [isRecording, isProcessingAudio, startRecording, stopRecording]);

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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, [isLoading, checkAndRequestMicPermission]);

  useEffect(() => {
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
      
      {/* Aviso bonito para navegadores sem Web Speech API */}
      {showBrowserWarning && micPermission === 'granted' && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 max-w-md">
          <Alert className="bg-blue-50 border-blue-200 shadow-lg">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              <strong>Modo de Áudio Manual:</strong> Seu navegador não suporta reconhecimento de voz em tempo real. 
              Use o botão "Falar" para gravar e enviar suas mensagens por áudio.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {micPermission !== 'granted' && micPermission !== 'checking' && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
          <Button onClick={checkAndRequestMicPermission} size="lg" className="rounded-full w-16 h-16 md:w-20 md-h-20 bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 shadow-lg transform hover:scale-110 transition-transform duration-200 flex items-center justify-center">
            <Mic size={32} />
          </Button>
        </div>
      )}
      
      {/* Botão "Falar" melhorado para navegadores sem Web Speech */}
      {micPermission === 'granted' && !useWebSpeech && !isOpen && (
        <div className="fixed bottom-4 left-4 md:bottom-8 md:left-8 z-50">
          <Button 
            onClick={handleSpeakButton} 
            size="lg" 
            disabled={isProcessingAudio}
            className={cn(
              "rounded-full w-16 h-16 md:w-20 md-h-20 shadow-lg transform hover:scale-110 transition-all duration-200 flex items-center justify-center",
              isRecording 
                ? "bg-red-600 hover:bg-red-700" 
                : isProcessingAudio
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-green-600 hover:bg-green-700"
            )}
          >
            {isProcessingAudio ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            ) : isRecording ? (
              <Send size={32} />
            ) : (
              <Mic size={32} />
            )}
          </Button>
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            {isProcessingAudio ? "Processando..." : isRecording ? "Clique para enviar" : "Falar"}
          </div>
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
          
          {/* Botão "Falar" quando o assistente está aberto e não usa Web Speech */}
          {!useWebSpeech && (
            <div className="mt-4">
              <Button 
                onClick={handleSpeakButton} 
                size="lg" 
                disabled={isProcessingAudio}
                className={cn(
                  "rounded-full w-16 h-16 shadow-lg transition-all duration-200 flex items-center justify-center",
                  isRecording 
                    ? "bg-red-600 hover:bg-red-700" 
                    : isProcessingAudio
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-green-600 hover:bg-green-700"
                )}
              >
                {isProcessingAudio ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : isRecording ? (
                  <Send size={24} />
                ) : (
                  <Mic size={24} />
                )}
              </Button>
              <p className="text-white text-sm mt-2">
                {isProcessingAudio ? "Processando áudio..." : isRecording ? "Clique para enviar" : "Falar"}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;