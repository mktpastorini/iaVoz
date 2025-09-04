"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Tube } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
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

// Modal Component
const ImageModal = ({ imageUrl, altText, onClose }: { imageUrl: string; altText?: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70" onClick={onClose}>
    <div className="relative max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
      <img src={imageUrl} alt={altText || 'Imagem exibida pelo assistente'} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 rounded-full" onClick={onClose}><X /></Button>
    </div>
  </div>
);

// Layer 3: Cosmic Background - escuro e sutil
const CosmicBackground = () => {
  const particles = useMemo(() => {
    const count = 400;
    const radius = 12;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, []);

  const pointsRef = useRef<THREE.Points>(null);
  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.00005;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particles.length / 3} array={particles} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.01}
        color="#111111"
        transparent
        opacity={0.15}
        depthWrite={false}
      />
    </points>
  );
};

// Layer 2: Energy Lines - linhas elétricas dinâmicas
const EnergyLine = ({ curve, speed, birth, thickness }: { curve: THREE.CatmullRomCurve3, speed: number, birth: number, thickness: number }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity = (Math.sin(clock.elapsedTime * speed + birth) + 1) / 2 * 0.4 + 0.3;
    }
  });

  return (
    <Tube args={[curve, 64, thickness, 8, false]}>
      <meshBasicMaterial
        ref={materialRef}
        color="#00ffff"
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </Tube>
  );
};

const EnergyLines = ({ count = 10, radius = 1.5 }) => {
  const lines = useMemo(() => {
    return Array.from({ length: count }, () => {
      // Pontos aleatórios que se expandem para fora do orbe
      const points = Array.from({ length: 12 }, (_, i) => {
        const direction = new THREE.Vector3(
          (Math.random() - 0.5),
          (Math.random() - 0.5),
          (Math.random() - 0.5)
        ).normalize();
        // Para os primeiros pontos, dentro do raio, para os últimos, estender além do raio
        const scalar = i < 6 ? radius * (0.3 + Math.random() * 0.7) : radius * (1.5 + Math.random() * 3.0);
        return direction.multiplyScalar(scalar);
      });
      return {
        curve: new THREE.CatmullRomCurve3(points),
        speed: Math.random() * 0.3 + 0.15,
        birth: Math.random() * 10,
        thickness: 0.002 + Math.random() * 0.008,
      };
    });
  }, [count, radius]);

  return (
    <group>
      {lines.map((line, i) => (
        <EnergyLine key={i} {...line} />
      ))}
    </group>
  );
};

// Layer 1: Particle Orb com partículas que se expandem e deixam rastro
const ParticleOrb = () => {
  const shaderMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const particleCount = 3000;

  // Estado para armazenar posições e velocidades das partículas
  const [positions] = useState(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      // Inicializa partículas dentro da esfera
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * 1.5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  });

  // Velocidades para expansão (direção normalizada * velocidade)
  const [velocities] = useState(() => {
    const vel = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const dir = new THREE.Vector3(x, y, z).normalize();
      const speed = 0.001 + Math.random() * 0.003;
      vel[i * 3] = dir.x * speed;
      vel[i * 3 + 1] = dir.y * speed;
      vel[i * 3 + 2] = dir.z * speed;
    }
    return vel;
  });

  // Para criar efeito de rastro, armazenamos posições anteriores
  const trailLength = 10;
  const trailPositions = useRef(new Array(trailLength).fill(null).map(() => new Float32Array(particleCount * 3)));

  // Atualiza posições e armazena histórico para rastro
  useFrame(() => {
    // Atualiza posições
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] += velocities[i * 3];
      positions[i * 3 + 1] += velocities[i * 3 + 1];
      positions[i * 3 + 2] += velocities[i * 3 + 2];

      // Se a partícula estiver muito longe, reinicia dentro da esfera
      const dist = Math.sqrt(
        positions[i * 3] ** 2 +
        positions[i * 3 + 1] ** 2 +
        positions[i * 3 + 2] ** 2
      );
      if (dist > 4) {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.random() * 1.5;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
    }

    // Atualiza histórico de posições para rastro
    trailPositions.current.pop();
    trailPositions.current.unshift(new Float32Array(positions));

    // Atualiza o atributo de posição do buffer geometry
    if (shaderMaterialRef.current) {
      shaderMaterialRef.current.uniforms.uTime.value += 0.01;
    }
  });

  // Vertex shader com efeito de rastro (fade)
  const vertexShader = `
    uniform float uTime;
    varying float vAlpha;

    void main() {
      vAlpha = 1.0;
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vec4 projectedPosition = projectionMatrix * viewPosition;
      gl_Position = projectedPosition;
      gl_PointSize = 2.0 + 2.0 * sin(uTime * 10.0 + position.x * 10.0);
    }
  `;

  const fragmentShader = `
    varying float vAlpha;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0 - dist);
    }
  `;

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderMaterialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// Main Component
const SophisticatedVoiceAssistant: React.FC<VoiceAssistantProps> = ({
  settings,
  isLoading,
}) => {
  const { session } = useSession();
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
  const systemVariablesRef = useRef(systemVariables);
  const sessionRef = useRef(session);
  const messageHistoryRef = useRef(messageHistory);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopPermanentlyRef = useRef(false);
  const activationTriggerRef = useRef(0);
  const activationRequestedViaButton = useRef(false);
  const isTransitioningToSpeakRef = useRef(false);

  const displayedAiResponse = useTypewriter(aiResponse, 40);

  // Efeitos para sincronizar refs com estados/props
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

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const startListening = useCallback(() => {
    if (isListeningRef.current || isSpeakingRef.current || stopPermanentlyRef.current || !recognitionRef.current) {
      return;
    }
    try {
      recognitionRef.current.start();
    } catch {
      // Pode ocorrer erro se já estiver parando, ignorar
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current?.speaking) {
      synthRef.current.cancel();
    }
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (isSpeakingRef.current) {
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }
    
    const onSpeechEnd = () => {
      isTransitioningToSpeakRef.current = false;
      isSpeakingRef.current = false;
      setIsSpeaking(false);
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
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = () => onSpeechEnd();
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
        audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        audioRef.current.onerror = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
        await audioRef.current.play();
      } else {
        onSpeechEnd();
      }
    } catch {
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening]);

  const runConversation = useCallback(async (userInput: string) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings || !currentSettings.openai_api_key) {
      speak("Chave API OpenAI não configurada.");
      return;
    }
    stopListening();
    setTranscript(userInput);
    setAiResponse("Pensando...");
    
    const currentHistory = messageHistoryRef.current;
    const historyForApi = [
      ...currentHistory,
      { role: "user" as const, content: userInput }
    ];
    setMessageHistory(historyForApi);

    const tools = powersRef.current.map(p => ({
      type: 'function' as const,
      function: {
        name: p.name,
        description: p.description,
        parameters: p.parameters_schema || { type: "object", properties: {} }
      }
    }));
    
    const messagesForApi = [
      { role: "system" as const, content: currentSettings.system_prompt },
      { role: "assistant" as const, content: currentSettings.assistant_prompt },
      ...historyForApi.slice(-currentSettings.conversation_memory_length) 
    ];

    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
        body: JSON.stringify({ model: currentSettings.ai_model, messages: messagesForApi, tools: tools.length > 0 ? tools : undefined, tool_choice: tools.length > 0 ? 'auto' : undefined }),
      });
      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Erro na API OpenAI: ${errorBody.error?.message || response.statusText}`);
      }
      const data = await response.json();
      const responseMessage = data.choices?.[0]?.message;

      if (responseMessage.tool_calls) {
        setAiResponse("Executando ação...");
        const historyWithToolCall = [...historyForApi, responseMessage];
        setMessageHistory(historyWithToolCall);

        const toolOutputs = await Promise.all(responseMessage.tool_calls.map(async (toolCall: any) => {
          const power = powersRef.current.find(p => p.name === toolCall.function.name);
          if (!power) return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: 'Poder não encontrado.' };
          
          const args = JSON.parse(toolCall.function.arguments);
          const isInternalFunction = power.url?.includes('supabase.co/functions/v1/');
          const functionName = isInternalFunction ? power.url.split('/functions/v1/')[1] : null;
          let toolResult, invokeError;

          if (isInternalFunction && functionName) {
            const headers: Record<string, string> = sessionRef.current?.access_token ? { Authorization: `Bearer ${sessionRef.current.access_token}` } : {};
            const { data, error } = await supabase.functions.invoke(functionName, { body: args, headers });
            invokeError = error;
            toolResult = data;
          } else {
            const processedUrl = replacePlaceholders(power.url || '', { ...systemVariablesRef.current, ...args });
            const processedHeaders = power.headers ? JSON.parse(replacePlaceholders(JSON.stringify(power.headers), { ...systemVariablesRef.current, ...args })) : {};
            const processedBody = (power.body && ["POST", "PUT", "PATCH"].includes(power.method)) ? JSON.parse(replacePlaceholders(JSON.stringify(power.body), { ...systemVariablesRef.current, ...args })) : undefined;
            const payload = { url: processedUrl, method: power.method, headers: processedHeaders, body: processedBody };
            const { data, error } = await supabase.functions.invoke('proxy-api', { body: payload });
            toolResult = data;
            invokeError = error;
          }
          
          if (invokeError) return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: JSON.stringify({ error: invokeError.message }) };
          return { tool_call_id: toolCall.id, role: 'tool' as const, name: toolCall.function.name, content: JSON.stringify(toolResult) };
        }));

        const historyWithToolResults = [...historyWithToolCall, ...toolOutputs];
        setMessageHistory(historyWithToolResults);
        
        const secondResponse = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
          body: JSON.stringify({ model: currentSettings.ai_model, messages: historyWithToolResults }),
        });
        if (!secondResponse.ok) {
          const errorBody = await secondResponse.json();
          throw new Error(`Erro na 2ª chamada OpenAI: ${errorBody.error?.message || secondResponse.statusText}`);
        }
        const secondData = await secondResponse.json();
        const finalMessage = secondData.choices?.[0]?.message?.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: finalMessage }]);
        speak(finalMessage);
      } else {
        const assistantMessage = responseMessage.content;
        setMessageHistory(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
        speak(assistantMessage);
      }
    } catch (error: any) {
      showError(error.message || "Desculpe, ocorreu um erro.");
      speak("Desculpe, ocorreu um erro.");
    }
  }, [speak, stopListening]);

  const executeClientAction = useCallback((action: ClientAction) => {
    stopListening();
    switch (action.action_type) {
      case 'OPEN_URL':
        if (action.action_payload.url) speak(`Abrindo ${action.action_payload.url}`, () => window.open(action.action_payload.url, '_blank'));
        break;
      case 'OPEN_IFRAME_URL':
        if (action.action_payload.url) speak("Ok, abrindo conteúdo.", () => setUrlToOpenInIframe(action.action_payload.url!));
        break;
      case 'SHOW_IMAGE':
        if (action.action_payload.imageUrl) speak("Claro, aqui está a imagem.", () => setImageToShow(action.action_payload));
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

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };
    
    recognitionRef.current.onend = () => {
      setIsListening(false);
      if (isTransitioningToSpeakRef.current) return;
      if (!stopPermanentlyRef.current) startListening();
    };
    
    recognitionRef.current.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setMicPermission('denied');
        showError("Permissão para microfone negada.");
      }
    };
    
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      const closePhrases = ["fechar", "feche", "encerrar", "desligar", "cancelar", "dispensar"];

      if (isOpenRef.current) {
        if (closePhrases.some(phrase => transcript.includes(phrase))) {
          setIsOpen(false);
          setAiResponse("");
          setTranscript("");
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
        if (settingsRef.current && transcript.includes(settingsRef.current.activation_phrase.toLowerCase())) {
          setIsOpen(true);
          const messageToSpeak = hasBeenActivatedRef.current && settingsRef.current.continuation_phrase
            ? settingsRef.current.continuation_phrase
            : settingsRef.current.welcome_message;
          speak(messageToSpeak);
          setHasBeenActivated(true);
        }
      }
    };

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, [speak, startListening, stopSpeaking, runConversation, executeClientAction]);

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setMicPermission(permissionStatus.state);

      if (permissionStatus.state === 'granted') {
        if (!recognitionRef.current) initializeAssistant();
        startListening();
      } else if (permissionStatus.state === 'prompt') {
        setIsPermissionModalOpen(true);
      }
      permissionStatus.onchange = () => checkAndRequestMicPermission();
    } catch {
      setMicPermission('denied');
    }
  }, [initializeAssistant, startListening]);

  const handleAllowMic = async () => {
    setIsPermissionModalOpen(false);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      if (activationRequestedViaButton.current) {
        activationRequestedViaButton.current = false;
        handleManualActivation();
      }
    } catch {
      setMicPermission('denied');
      showError("Você precisa permitir o uso do microfone para continuar.");
    }
  };

  const handleManualActivation = useCallback(() => {
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
  }, [micPermission, checkAndRequestMicPermission, speak]);

  useEffect(() => {
    if (activationTrigger > activationTriggerRef.current) {
      activationTriggerRef.current = activationTrigger;
      handleManualActivation();
    }
  }, [activationTrigger, handleManualActivation]);

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
      const { data: powersData, error: powersError } = await supabase.from('powers').select('*');
      if (powersError) showError("Erro ao carregar os poderes da IA.");
      else setPowers(powersData || []);

      const { data: actionsData, error: actionsError } = await supabase.from('client_actions').select('*');
      if (actionsError) showError("Erro ao carregar ações do cliente.");
      else setClientActions(actionsData || []);
    };
    fetchPowersAndActions();
  }, []);

  if (isLoading || !settings) return null;

  return (
    <>
      <MicrophonePermissionModal isOpen={isPermissionModalOpen} onAllow={handleAllowMic} onClose={() => setIsPermissionModalOpen(false)} />
      {micPermission === 'denied' && !isOpen && (
        <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
          <Button onClick={checkAndRequestMicPermission} size="lg" className="rounded-full w-16 h-16 shadow-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"><Mic size={32} /></Button>
        </div>
      )}
      {imageToShow && <ImageModal imageUrl={imageToShow.imageUrl!} altText={imageToShow.altText} onClose={() => { setImageToShow(null); startListening(); }} />}
      {urlToOpenInIframe && <UrlIframeModal url={urlToOpenInIframe} onClose={() => { setUrlToOpenInIframe(null); startListening(); }} />}
      
      <div className={cn("fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500", isOpen ? "opacity-100" : "opacity-0 pointer-events-auto")}>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-950 to-purple-950" onClick={() => setIsOpen(false)}></div>
        
        <div className="absolute inset-0 z-10 pointer-events-none">
          <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            
            <CosmicBackground />
            <ParticleOrb />
            <EnergyLines />

            <EffectComposer>
              <Bloom intensity={2.5} luminanceThreshold={0.05} mipmapBlur={true} />
            </EffectComposer>
          </Canvas>
        </div>

        <div className="relative z-20 flex flex-col items-center justify-between w-full h-full p-8 pointer-events-auto">
          <div /> 
          <div className="text-center select-text">
            {displayedAiResponse && (
              <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 max-w-lg mx-auto">
                <p className="text-white text-2xl md:text-4xl font-bold leading-tight drop-shadow-lg">{displayedAiResponse}</p>
              </div>
            )}
            {transcript && <p className="text-gray-400 text-lg mt-4">{transcript}</p>}
          </div>

          <div className="flex items-center justify-center gap-4 p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 pointer-events-auto">
            <AudioVisualizer isSpeaking={isSpeaking} />
            <div className="p-3 bg-white/10 rounded-full">
              <Mic className={cn("h-6 w-6 text-white", isListening && "text-cyan-400 animate-pulse")} />
            </div>
            <AudioVisualizer isSpeaking={isSpeaking} />
          </div>
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;