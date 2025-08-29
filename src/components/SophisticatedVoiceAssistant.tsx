"use client";

import React, { useState, useEffect, useRef } from "react";
import { showSuccess, showError } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionContext";
import { useSystem } from "@/contexts/SystemContext";
import { replacePlaceholders } from "@/lib/utils";
import { useTypewriter } from "@/hooks/useTypewriter";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, X, Link as LinkIcon } from "lucide-react";

// Types
type AssistantState = "IDLE" | "LISTENING" | "PROCESSING" | "SPEAKING" | "ACTION_PENDING";

interface VoiceAssistantProps {
  welcomeMessage?: string;
  openAiApiKey: string;
  systemPrompt?: string;
  assistantPrompt?: string;
  model?: string;
  conversationMemoryLength: number;
  voiceModel: "browser" | "openai-tts" | "gemini-tts";
  openaiTtsVoice?: string;
  activationPhrase: string;
}

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
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
  action_type: 'OPEN_URL' | 'SHOW_IMAGE';
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
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={onClose}>
    <div className="relative max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
      <img src={imageUrl} alt={altText || 'Imagem exibida pelo assistente'} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 rounded-full z-10" onClick={onClose}><X /></Button>
    </div>
  </div>
);

// Main Component
const SophisticatedVoiceAssistant: React.FC<VoiceAssistantProps> = ({
  welcomeMessage = "Bem-vindo ao site! Diga 'ativar' para começar a conversar.",
  openAiApiKey,
  systemPrompt,
  assistantPrompt,
  model = "gpt-4o-mini",
  conversationMemoryLength,
  voiceModel,
  openaiTtsVoice = "alloy",
  activationPhrase,
}) => {
  const { workspace } = useSession();
  const { systemVariables } = useSystem();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [assistantState, setAssistantState] = useState<AssistantState>("IDLE");
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [powers, setPowers] = useState<Power[]>([]);
  const [clientActions, setClientActions] = useState<ClientAction[]>([]);
  const [imageToShow, setImageToShow] = useState<ClientAction['action_payload'] | null>(null);
  const [linkToShow, setLinkToShow] = useState<{ url: string; triggerPhrase: string } | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const displayedAiResponse = useTypewriter(aiResponse, 40);
  const isSpeaking = assistantState === "SPEAKING";
  const isListening = assistantState === "LISTENING";

  useEffect(() => {
    if (workspace?.id) {
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

  const startListening = () => {
    if (recognitionRef.current && assistantState !== 'LISTENING') {
      try {
        setAssistantState('LISTENING');
        recognitionRef.current.start();
      } catch (error) {
        console.error("[VA] Erro ao iniciar reconhecimento:", error);
        setAssistantState('IDLE');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && assistantState === 'LISTENING') {
      recognitionRef.current.stop();
      setAssistantState('IDLE');
    }
  };

  const speak = async (text: string) => {
    return new Promise<void>((resolve) => {
      if (!text) {
        resolve();
        return;
      }
      setAssistantState('SPEAKING');
      setAiResponse(text);

      const onEnd = () => {
        setAssistantState('IDLE');
        resolve();
      };

      if (voiceModel === "browser" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onEnd;
        utterance.onerror = () => { console.error("Erro na síntese de voz."); onEnd(); };
        window.speechSynthesis.speak(utterance);
      } else if (voiceModel === "openai-tts" && openAiApiKey) {
        fetch(OPENAI_TTS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiApiKey}` },
          body: JSON.stringify({ model: "tts-1", voice: openaiTtsVoice || "alloy", input: text }),
        })
        .then(response => {
          if (!response.ok) throw new Error("Falha na API OpenAI TTS");
          return response.blob();
        })
        .then(audioBlob => {
          const audioUrl = URL.createObjectURL(audioBlob);
          audioRef.current = new Audio(audioUrl);
          audioRef.current.onended = () => { URL.revokeObjectURL(audioUrl); onEnd(); };
          audioRef.current.play();
        })
        .catch(error => { console.error(error); onEnd(); });
      } else {
        setTimeout(onEnd, 1000); // Fallback for no voice
      }
    });
  };

  const executeClientAction = async (action: ClientAction) => {
    setAssistantState('ACTION_PENDING');
    switch (action.action_type) {
      case 'OPEN_URL':
        if (action.action_payload.url) {
          await speak("Claro, aqui está o link que você pediu.");
          setLinkToShow({ url: action.action_payload.url!, triggerPhrase: action.trigger_phrase });
        }
        break;
      case 'SHOW_IMAGE':
        if (action.action_payload.imageUrl) {
          await speak("Ok, mostrando a imagem.");
          setImageToShow(action.action_payload);
        }
        break;
    }
  };

  const runConversation = async (userInput: string) => {
    setAssistantState('PROCESSING');
    // ... (código da runConversation permanece o mesmo, mas no final...)
    // ... no final de todos os 'try/catch' e 'if/else' da runConversation:
    // await speak(finalMessage);
    // setAssistantState('LISTENING'); // O useEffect vai cuidar disso
  };

  useEffect(() => {
    if (isInitialized && isOpen && assistantState === 'IDLE') {
      startListening();
    }
  }, [isInitialized, isOpen, assistantState]);

  useEffect(() => {
    if (!isInitialized) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError("Reconhecimento de voz não suportado.");
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "pt-BR";

    recognitionRef.current.onstart = () => {};
    recognitionRef.current.onend = () => {
      if (assistantState === 'LISTENING') setAssistantState('IDLE');
    };
    recognitionRef.current.onerror = (e) => { console.error(`Erro de reconhecimento: ${e.error}`); };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      setAssistantState('PROCESSING'); // Importante: para de ouvir assim que tem um resultado

      if (isOpen) {
        if (transcript.includes("fechar")) {
          setIsOpen(false);
          setAssistantState('IDLE');
          return;
        }
        const matchedAction = clientActions.find(a => transcript.includes(a.trigger_phrase));
        if (matchedAction) {
          executeClientAction(matchedAction);
        } else {
          runConversation(transcript);
        }
      } else {
        if (transcript.includes(activationPhrase.toLowerCase())) {
          setIsOpen(true);
          speak(welcomeMessage).then(() => setAssistantState('IDLE'));
        } else {
          setAssistantState('IDLE'); // Volta a escutar
        }
      }
    };

    return () => { recognitionRef.current?.abort(); };
  }, [isInitialized, isOpen, activationPhrase, welcomeMessage, powers, clientActions, systemVariables]);

  const handleInit = () => {
    setIsInitialized(true);
    showSuccess("Assistente ativado! Diga a palavra de ativação.");
  };

  if (!isInitialized) {
    return (
      <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50">
        <Button onClick={handleInit} size="lg" className="rounded-full w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 shadow-lg transform hover:scale-110 transition-transform duration-200 flex items-center justify-center">
          <Mic size={32} />
        </Button>
      </div>
    );
  }

  return (
    <>
      {imageToShow && (
        <ImageModal
          imageUrl={imageToShow.imageUrl!}
          altText={imageToShow.altText}
          onClose={() => {
            setImageToShow(null);
            setAssistantState('IDLE');
          }}
        />
      )}
      <div className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center p-4 md:p-8 transition-all duration-500",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => { setIsOpen(false); setAssistantState('IDLE'); }}></div>
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-center">
          {linkToShow ? (
            <Card className="w-full max-w-md bg-background/90">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Ação: {linkToShow.triggerPhrase}</span>
                  <Button variant="ghost" size="icon" onClick={() => { setLinkToShow(null); setAssistantState('IDLE'); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <p>Clique no botão abaixo para abrir o link solicitado.</p>
                <Button asChild size="lg" className="w-full">
                  <a href={linkToShow.url} target="_blank" rel="noopener noreferrer" onClick={() => { setLinkToShow(null); setAssistantState('IDLE'); }}>
                    <LinkIcon className="mr-2 h-5 w-5" />
                    Abrir {linkToShow.url}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <p className="text-white text-3xl md:text-5xl font-bold leading-tight drop-shadow-lg">
                {displayedAiResponse}
              </p>
            </div>
          )}
          <AudioVisualizer isSpeaking={isSpeaking} />
          <div className="h-16">
            <p className="text-gray-400 text-lg md:text-xl">{isListening ? "Ouvindo..." : transcript}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SophisticatedVoiceAssistant;