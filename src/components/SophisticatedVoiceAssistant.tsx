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
  gemini_api_key: string; // Adicionado gemini_api_key
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
  content: string | null; // Content can be null for tool calls
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
const GOOGLE_GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

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
  const audioContextUnlocked = useRef(false); // Ref para o problema de autoplay

  const displayedAiResponse = useTypewriter(aiResponse, 40);

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

  const startListening = useCallback(() => {
    console.log(`[VA] startListening chamado. isListeningRef.current: ${isListeningRef.current}, isSpeakingRef.current: ${isSpeakingRef.current}, isOpenRef.current: ${isOpenRef.current}`);
    if (recognitionRef.current && !isListeningRef.current && !isSpeakingRef.current && isOpenRef.current) {
      try {
        recognitionRef.current.start();
        console.log("[VA] recognition.start() chamado com sucesso.");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'InvalidStateError')) {
          console.error("[VA] Erro ao iniciar reconhecimento (recognition.start()):", error);
        } else {
          console.warn("[VA] Tentativa de iniciar reconhecimento em estado inválido (já ativo?).");
        }
      }
    } else {
      console.log("[VA] startListening não executado devido a condições: recognitionRef.current:", !!recognitionRef.current, "isListeningRef.current:", isListeningRef.current, "isSpeakingRef.current:", isSpeakingRef.current, "isOpenRef.current:", isOpenRef.current);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
      console.log("[VA] recognition.stop() chamado.");
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) {
      synthRef.current.cancel();
      console.log("[VA] SpeechSynthesis cancelado.");
    }
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      console.log("[VA] Audio HTML pausado.");
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }

    stopSpeaking();
    setIsSpeaking(true);
    stopListening(); // Parar de ouvir antes de falar
    setAiResponse(text);
    console.log(`[VA] Preparando para falar: "${text}"`);

    const onSpeechEnd = () => {
      setIsSpeaking(false);
      onEndCallback?.();
      if (isOpenRef.current) {
        console.log("[VA] speak: Finalizou a fala. Tentando reiniciar escuta em 100ms...");
        // Adicionar um pequeno atraso para garantir que o estado isSpeaking seja totalmente atualizado no ref
        setTimeout(() => {
          if (isOpenRef.current && !isSpeakingRef.current) { // Verificar novamente antes de iniciar
            startListening();
          } else {
            console.log("[VA] speak: Não reiniciou a escuta (assistente fechado ou ainda falando).");
          }
        }, 100); // Pequeno atraso
      }
    };

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = (event) => {
          console.error('[VA] SpeechSynthesisUtterance error:', event);
          onSpeechEnd();
        };
        synthRef.current.speak(utterance);
        console.log("[VA] Usando o modelo de voz do navegador.");
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
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.onerror = () => {
          console.error('[VA] HTMLAudioElement error playing TTS.');
          onSpeechEnd();
          URL.revokeObjectURL(audioUrl);
        };
        await audioRef.current.play();
        console.log("[VA] Usando o modelo de voz OpenAI TTS.");
      } else {
        console.warn("[VA] Modelo de voz não configurado ou chave API ausente. Apenas exibindo texto.");
        onSpeechEnd();
      }
    } catch (error) {
      console.error("[VA] Erro durante a fala:", error);
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening]);

  const runConversation = useCallback(async (userInput: string) => {
    const currentSettings = settingsRef.current;
    const currentPowers = powersRef.current;
    const currentSystemVariables = systemVariablesRef.current;
    const currentSession = sessionRef.current;

    if (!currentSettings || (!currentSettings.openai_api_key && !currentSettings.gemini_api_key)) {
      speak("Chave API OpenAI ou Gemini não configurada.");
      return;
    }
    stopListening();
    setTranscript(userInput);
    setAiResponse("Pensando...");
    console.log(`[VA] Executando conversa com entrada: "${userInput}"`);
    
    const newHistory = [...messageHistoryRef.current, { role: "user" as const, content: userInput }];
    setMessageHistory(newHistory);

    const isGeminiModel = currentSettings.ai_model?.startsWith("gemini-");

    // Prepare tools for both OpenAI and Gemini
    const tools = currentPowers.map(p => ({ type: 'function' as const, function: { name: p.name, description: p.description, parameters: p.parameters_schema } }));
    const geminiTools = tools.length > 0 ? [{ functionDeclarations: tools.map(t => t.function) }] : undefined;

    // Prepare messages for OpenAI
    const openAIMessages = [
      { role: "system" as const, content: currentSettings.system_prompt },
      { role: "assistant" as const, content: currentSettings.assistant_prompt },
      ...newHistory.slice(-currentSettings.conversation_memory_length) 
    ].filter(msg => msg.content);

    // Prepare messages for Gemini
    // Gemini does not have a 'system' role. System prompts are usually prepended to the first user message.
    // Also, Gemini expects 'user' and 'model' roles, not 'assistant'.
    const geminiContents: any[] = [];
    if (currentSettings.system_prompt) {
      geminiContents.push({ role: "user", parts: [{ text: currentSettings.system_prompt }] });
      geminiContents.push({ role: "model", parts: [{ text: "Ok, entendi." }] }); // Acknowledge system prompt
    }
    if (currentSettings.assistant_prompt) {
      geminiContents.push({ role: "user", parts: [{ text: currentSettings.assistant_prompt }] });
      geminiContents.push({ role: "model", parts: [{ text: "Certo, estou pronto para ajudar." }] }); // Acknowledge assistant prompt
    }

    newHistory.slice(-currentSettings.conversation_memory_length).forEach(msg => {
      if (msg.content) {
        if (msg.role === "user") {
          geminiContents.push({ role: "user", parts: [{ text: msg.content }] });
        } else if (msg.role === "assistant") {
          geminiContents.push({ role: "model", parts: [{ text: msg.content }] });
        } else if (msg.role === "tool" && msg.tool_call_id && msg.name) {
          // Gemini tool response format
          geminiContents.push({
            role: "function",
            parts: [{
              functionResponse: {
                name: msg.name,
                response: JSON.parse(msg.content) // Assuming content is stringified JSON
              }
            }]
          });
        }
      }
    });

    try {
      let response;
      let responseMessage: any;

      if (isGeminiModel) {
        if (!currentSettings.gemini_api_key) {
          speak("Chave API Google Gemini não configurada.");
          return;
        }
        console.log("[VA] Enviando requisição para Google Gemini Chat Completions...");
        const geminiModelId = currentSettings.ai_model;
        response = await fetch(`${GOOGLE_GEMINI_API_BASE_URL}${geminiModelId}:generateContent?key=${currentSettings.gemini_api_key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: geminiContents,
            tools: geminiTools,
          }),
        });
        if (!response.ok) {
          const errorBody = await response.json();
          console.error("Erro da API Google Gemini:", errorBody);
          throw new Error("Erro na API Google Gemini");
        }
        const data = await response.json();
        responseMessage = data.candidates?.[0]?.content;
        console.log("[VA] Resposta recebida da Google Gemini:", responseMessage);

        if (responseMessage?.parts?.[0]?.functionCall) {
          responseMessage.tool_calls = responseMessage.parts.map((part: any) => ({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate a unique ID
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args),
            },
          }));
          responseMessage.content = null; // Clear content for tool calls
        } else if (responseMessage?.parts?.[0]?.text) {
          responseMessage.content = responseMessage.parts[0].text;
        } else {
          responseMessage.content = "Não consegui gerar uma resposta.";
        }

      } else { // OpenAI models
        if (!currentSettings.openai_api_key) {
          speak("Chave API OpenAI não configurada.");
          return;
        }
        console.log("[VA] Enviando requisição para OpenAI Chat Completions...");
        response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: currentSettings.ai_model, messages: openAIMessages, tools: tools.length > 0 ? tools : undefined, tool_choice: tools.length > 0 ? 'auto' : undefined }),
        });
        if (!response.ok) {
          const errorBody = await response.json();
          console.error("Erro da API OpenAI:", errorBody);
          throw new Error("Erro na API OpenAI");
        }
        const data = await response.json();
        responseMessage = data.choices?.[0]?.message;
        console.log("[VA] Resposta recebida da OpenAI:", responseMessage);
      }

      if (responseMessage.tool_calls) {
        setAiResponse("Executando ação...");
        const historyWithToolCall = [...newHistory, { ...responseMessage, content: responseMessage.content || "" }];
        setMessageHistory(historyWithToolCall);
        console.log("[VA] Chamada de ferramenta detectada. Executando ferramentas...");

        const toolOutputs = await Promise.all(responseMessage.tool_calls.map(async (toolCall: any) => {
          console.log(`[VA] Executando ferramenta: ${toolCall.function.name}`);
          const power = currentPowers.find(p => p.name === toolCall.function.name);
          if (!power) {
            console.error(`[VA] Poder '${toolCall.function.name}' não encontrado.`);
            return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: 'Poder não encontrado.' };
          }
          
          const args = JSON.parse(toolCall.function.arguments);
          
          let processedUrl = replacePlaceholders(power.url || '', { ...currentSystemVariables, ...args });
          let processedHeaders = power.headers ? JSON.parse(replacePlaceholders(JSON.stringify(power.headers), { ...currentSystemVariables, ...args })) : {};
          let processedBody = (power.body && (power.method === "POST" || power.method === "PUT" || power.method === "PATCH")) 
            ? JSON.parse(replacePlaceholders(JSON.stringify(power.body), { ...currentSystemVariables, ...args })) 
            : args; // Passar args como body se não houver body pré-definido

          const supabaseAccessToken = currentSession?.access_token;
          if (!supabaseAccessToken) {
            console.error("[VA] Erro: Usuário não autenticado para chamada de ferramenta.");
            return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: 'Erro: Usuário não autenticado.' };
          }
          
          const headersWithAuth = {
            ...processedHeaders,
            'Authorization': `Bearer ${supabaseAccessToken}`,
            'apikey': supabase.anonKey // CORREÇÃO AQUI: Usando supabase.anonKey
          };

          const payload = { url: processedUrl, method: power.method, headers: headersWithAuth, body: processedBody };
          console.log(`[VA] Invocando 'proxy-api' para poder '${power.name}' com payload:`, payload);
          
          const { data, error } = await supabase.functions.invoke('proxy-api', { body: payload });
          
          if (error || (data && !data.ok)) {
            console.error(`[VA] Erro ao invocar poder '${power.name}':`, error || data.data);
            return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: JSON.stringify({ error: (error?.message || data?.data?.error || 'Erro desconhecido na execução do poder.') }) };
          }
          console.log(`[VA] Resultado da ferramenta '${power.name}':`, data);
          return { tool_call_id: toolCall.id, role: 'tool' as const, name: power.name, content: JSON.stringify(data.data) };
        }));

        console.log("[VA] Execução da ferramenta finalizada. Enviando resultados de volta para a IA...");
        const historyWithToolResults = [...historyWithToolCall, ...toolOutputs];
        setMessageHistory(historyWithToolResults);
        
        let finalResponseMessage;
        if (isGeminiModel) {
          const geminiToolResponseContents: any[] = [];
          // Reconstruct Gemini history including tool outputs
          geminiContents.forEach(content => geminiToolResponseContents.push(content)); // Add previous history
          toolOutputs.forEach(output => {
            geminiToolResponseContents.push({
              role: "function",
              parts: [{
                functionResponse: {
                  name: output.name,
                  response: JSON.parse(output.content)
                }
              }]
            });
          });

          const secondResponse = await fetch(`${GOOGLE_GEMINI_API_BASE_URL}${currentSettings.ai_model}:generateContent?key=${currentSettings.gemini_api_key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: geminiToolResponseContents,
              tools: geminiTools,
            }),
          });
          if (!secondResponse.ok) throw new Error("Erro na 2ª chamada Google Gemini");
          const secondData = await secondResponse.json();
          finalResponseMessage = secondData.candidates?.[0]?.content?.parts?.[0]?.text;
        } else { // OpenAI
          const secondResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
            body: JSON.stringify({ model: currentSettings.ai_model, messages: historyWithToolResults }),
          });
          if (!secondResponse.ok) throw new Error("Erro na 2ª chamada OpenAI");
          const secondData = await secondResponse.json();
          finalResponseMessage = secondData.choices?.[0]?.message?.content;
        }
        
        setMessageHistory(prev => [...prev, { role: 'assistant', content: finalResponseMessage }]);
        speak(finalResponseMessage);
        console.log("[VA] Resposta final recebida da IA:", finalResponseMessage);
      } else {
        const assistantMessage = responseMessage.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
        speak(assistantMessage);
      }
    } catch (error) {
      console.error('[VA] Erro no fluxo da conversa:', error);
      speak("Desculpe, ocorreu um erro.");
    }
  }, [speak, stopListening, setMessageHistory]);

  const executeClientAction = useCallback((action: ClientAction) => {
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado.");
      setMicPermission('denied');
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";
    console.log("[VA] Inicializando assistente...");

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      console.log("[VA] Reconhecimento de voz iniciado.");
    };
    
    recognitionRef.current.onend = () => {
      setIsListening(false);
      console.log("[VA] Reconhecimento de voz finalizado (onend).");
      if (isOpenRef.current && !stopPermanentlyRef.current) {
        console.log("[VA] onend: Assistente aberto, tentando reiniciar escuta em 100ms...");
        // Adicionar um pequeno atraso para garantir que o estado isSpeaking seja totalmente atualizado no ref
        setTimeout(() => {
          if (isOpenRef.current && !isSpeakingRef.current) { // Verificar novamente antes de iniciar
            startListening();
          } else {
            console.log("[VA] onend: Não reiniciou a escuta (assistente fechado ou falando).");
          }
        }, 100); // Pequeno atraso
      } else {
        console.log("[VA] onend: Reconhecimento encerrado intencionalmente ou assistente fechado.");
      }
    };

    recognitionRef.current.onerror = (e) => {
      setIsListening(false); // Garantir que o estado de escuta seja falso em caso de erro
      if (e.error === 'no-speech') {
        console.warn("[VA] Erro no reconhecimento de voz: Nenhuma fala detectada.");
      } else if (e.error === 'aborted') {
        console.log("[VA] Reconhecimento de voz abortado.");
      } else {
        console.error(`[VA] Erro no reconhecimento de voz: ${e.error}`);
        showError(`Erro no microfone: ${e.error}. Verifique suas permissões.`);
      }

      // Tentar reiniciar a escuta em caso de erro, se o assistente estiver aberto e não estiver falando
      if (isOpenRef.current && !isSpeakingRef.current && !stopPermanentlyRef.current) {
        console.log("[VA] onerror: Assistente aberto e não falando, tentando reiniciar escuta em 100ms...");
        setTimeout(() => startListening(), 100);
      }
    };
    
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      const closePhrases = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];
      console.log(`[VA] Transcrição ouvida: "${transcript}"`);

      if (isOpenRef.current) {
        if (closePhrases.some(phrase => transcript.includes(phrase))) {
          setIsOpen(false);
          setAiResponse("");
          setTranscript("");
          stopSpeaking();
          stopListening();
          console.log("[VA] Frase de fechamento detectada. Fechando assistente.");
          return;
        }
        const matchedAction = clientActionsRef.current.find(a => transcript.includes(a.trigger_phrase));
        if (matchedAction) {
          console.log("[VA] Ação do cliente correspondida. Executando ação.");
          executeClientAction(matchedAction);
          return;
        }
        console.log("[VA] Nenhuma ação do cliente correspondida. Iniciando turno da conversa.");
        runConversation(transcript);
      } else {
        if (settingsRef.current && transcript.includes(settingsRef.current.activation_phrase.toLowerCase())) {
          setIsOpen(true);
          const messageToSpeak = hasBeenActivatedRef.current && settingsRef.current.continuation_phrase
            ? settingsRef.current.continuation_phrase
            : settingsRef.current.welcome_message;
          
          console.log("[VA] Frase de ativação detectada. Abrindo assistente.");
          speak(messageToSpeak || "");
          setHasBeenActivated(true);
        }
      }
    };

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      console.log("[VA] Síntese de voz inicializada.");
    } else {
      showError("Síntese de voz não suportada.");
    }
  }, [speak, startListening, stopSpeaking, stopListening, runConversation, executeClientAction, setIsOpen, setAiResponse, setTranscript, setHasBeenActivated]);

  const checkAndRequestMicPermission = useCallback(async () => {
    console.log("[VA] Verificando permissão do microfone...");
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setMicPermission(permissionStatus.state);
      console.log(`[VA] Status da permissão: ${permissionStatus.state}`);

      if (permissionStatus.state === 'granted') {
        initializeAssistant();
        startListening();
      } else if (permissionStatus.state === 'prompt') {
        setIsPermissionModalOpen(true);
      } else {
        showError("Permissão para microfone negada. Habilite nas configurações do seu navegador.");
      }
      permissionStatus.onchange = () => {
        setMicPermission(permissionStatus.state);
        if (permissionStatus.state === 'granted') {
          initializeAssistant();
          startListening();
        }
      };
    } catch (error) {
      console.error("[VA] Não foi possível verificar a permissão do microfone.", error);
      showError("Não foi possível verificar a permissão do microfone.");
    }
  }, [initializeAssistant, startListening]);

  const unlockAudio = () => {
    if (audioContextUnlocked.current) return;
    const sound = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
    sound.play().catch(() => {});
    audioContextUnlocked.current = true;
  };

  const handleAllowMic = async () => {
    setIsPermissionModalOpen(false);
    unlockAudio(); // Desbloqueia o áudio na interação
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');
      initializeAssistant();

      if (activationRequestedViaButton.current) {
        activationRequestedViaButton.current = false;
        setTimeout(() => {
          setIsOpen(true);
          const messageToSpeak = hasBeenActivatedRef.current && settingsRef.current?.continuation_phrase
            ? settingsRef.current.continuation_phrase
            : settingsRef.current?.welcome_message;
          speak(messageToSpeak);
          setHasBeenActivated(true);
        }, 100);
      } else {
        startListening();
      }
    } catch (error) {
      setMicPermission('denied');
      showError("Você precisa permitir o uso do microfone para continuar.");
    }
  };

  const handleManualActivation = useCallback(() => {
    unlockAudio(); // Desbloqueia o áudio na interação
    if (isOpenRef.current) return;

    if (micPermission !== 'granted') {
      activationRequestedViaButton.current = true;
      checkAndRequestMicPermission();
    } else {
      setIsOpen(true);
      const messageToSpeak = hasBeenActivatedRef.current && settingsRef.current?.continuation_phrase
        ? settingsRef.current.continuation_phrase
        : settingsRef.current?.welcome_message;
      speak(messageToSpeak);
      setHasBeenActivated(true);
    }
  }, [micPermission, checkAndRequestMicPermission, speak, setIsOpen, setHasBeenActivated]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

  useEffect(() => {
    if (isLoading) return;
    console.log("[VA] Configurações carregadas. Iniciando verificação de permissão.");
    checkAndRequestMicPermission();
    return () => {
      stopPermanentlyRef.current = true;
      recognitionRef.current?.abort();
      if (synthRef.current?.speaking) synthRef.current.cancel();
    };
  }, [isLoading, checkAndRequestMicPermission]);

  useEffect(() => {
    if (workspace?.id) {
      console.log("[VA] Workspace detectado. Buscando poderes e ações do cliente...");
      const fetchPowers = async () => {
        const { data, error } = await supabase.from('powers').select('*').eq('workspace_id', workspace.id);
        if (error) showError("Erro ao carregar os poderes da IA.");
        else setPowers(data || []);
      };
      const fetchClientActions = async () => {
        const { data, error } = await supabase.from('client_actions').select('*').eq('workspace_id', workspace.id);
        if (error) showError("Erro ao carregar ações do cliente.");
        else setClientActions(data || []);
      };
      fetchPowers();
      fetchClientActions();
    }
  }, [workspace]);

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