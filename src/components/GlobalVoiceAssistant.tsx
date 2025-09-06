"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSystem } from "@/contexts/SystemContext";

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

const GlobalVoiceAssistant: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activationPhrase, setActivationPhrase] = useState("ativar");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isMounted = useRef(true);
  const { systemVariables } = useSystem();

  // Busca a frase de ativação do Supabase
  useEffect(() => {
    const fetchActivationPhrase = async () => {
      const { data, error } = await supabase.from("settings").select("activation_phrase").limit(1).single();
      if (!error && data?.activation_phrase) {
        setActivationPhrase(data.activation_phrase.toLowerCase());
      }
    };
    fetchActivationPhrase();
  }, []);

  // Para parar a fala atual
  const stopSpeaking = useCallback(() => {
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
      if (isMounted.current) setIsSpeaking(false);
      if (currentUtteranceRef.current) {
        currentUtteranceRef.current.onend = null;
        currentUtteranceRef.current.onerror = null;
        currentUtteranceRef.current = null;
      }
    }
  }, []);

  // Função para falar texto, suporta múltiplos modelos (browser por enquanto)
  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!synthRef.current) {
      onDone?.();
      return;
    }

    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";

    // Configura voz OpenAI TTS ou Gemini TTS aqui se implementar futuramente
    // Por enquanto, usa voz padrão do navegador

    utterance.onstart = () => {
      if (isMounted.current) setIsSpeaking(true);
    };
    utterance.onend = () => {
      if (isMounted.current) setIsSpeaking(false);
      onDone?.();
      currentUtteranceRef.current = null;
    };
    utterance.onerror = (event) => {
      console.error("SpeechSynthesisUtterance error:", event);
      if (isMounted.current) setIsSpeaking(false);
      onDone?.();
      currentUtteranceRef.current = null;
    };
    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [stopSpeaking]);

  // Processa o comando de voz (aqui você pode integrar com IA ou APIs)
  const processCommand = useCallback(async (command: string) => {
    if (!isMounted.current) return;

    if (isMounted.current) setIsProcessing(true);
    console.log("Processando comando:", command);

    // Exemplo simples: ecoa o comando e inclui variável do sistema se existir
    let responseText = `Você disse: "${command}".`;

    if (systemVariables && Object.keys(systemVariables).length > 0) {
      responseText += " Variáveis do sistema disponíveis: " + Object.keys(systemVariables).join(", ") + ".";
    }

    // Simula delay de processamento
    await new Promise((r) => setTimeout(r, 1000));

    speak(responseText, () => {
      if (isMounted.current) setIsProcessing(false);
    });
  }, [speak, systemVariables]);

  // Inicia o reconhecimento de voz
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        if (isMounted.current) setIsListening(true);
      } catch (e) {
        console.error("Erro ao iniciar reconhecimento:", e);
      }
    }
  }, [isListening]);

  // Para o reconhecimento de voz
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      if (isMounted.current) setIsListening(false);
    }
  }, [isListening]);

  // Configura reconhecimento de voz e eventos
  useEffect(() => {
    isMounted.current = true;

    synthRef.current = window.speechSynthesis;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "pt-BR";

      recognition.onstart = () => {
        if (isMounted.current) setIsListening(true);
        console.log("Reconhecimento de voz iniciado.");
      };

      recognition.onresult = (event) => {
        if (!isMounted.current) return;

        stopSpeaking();

        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.toLowerCase().trim();
        console.log("Comando recebido:", transcript);

        if (transcript.length < 3) {
          console.log("Comando muito curto, ignorando:", transcript);
          return;
        }

        if (transcript.includes(activationPhrase)) {
          speak("Ok, entendi!", () => {
            const command = transcript.replace(activationPhrase, "").trim();
            if (command.length > 0) {
              processCommand(command);
            } else {
              setIsProcessing(false);
            }
          });
        } else {
          console.log("Frase de ativação não detectada, ignorando.");
        }
      };

      recognition.onend = () => {
        if (isMounted.current) setIsListening(false);
        console.log("Reconhecimento de voz encerrado.");
      };

      recognition.onerror = (event) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        if (isMounted.current) setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("API de Reconhecimento de Fala não suportada neste navegador.");
    }

    return () => {
      isMounted.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
      }
      stopSpeaking();
    };
  }, [activationPhrase, processCommand, speak, stopSpeaking]);

  // Alterna entre ouvir e parar de ouvir
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={toggleListening}
        className={cn(
          "p-4 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center text-white select-none",
          isListening ? "bg-red-600 hover:bg-red-700" : "bg-cyan-500 hover:bg-cyan-600"
        )}
        disabled={isProcessing}
        aria-label={isListening ? "Parar de ouvir" : "Começar a ouvir"}
        title={isListening ? "Clique para parar de ouvir" : "Clique para começar a ouvir"}
      >
        {isProcessing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
        <span className="ml-2 hidden md:inline font-semibold select-text">
          {isProcessing ? "Processando..." : isListening ? "Parar" : "Ouvir"}
        </span>
      </button>
      {isSpeaking && (
        <div className="absolute bottom-full right-0 mb-2 p-2 bg-purple-800 text-white text-sm rounded-md shadow-md animate-pulse select-none">
          Falando...
        </div>
      )}
    </div>
  );
};

export default GlobalVoiceAssistant;