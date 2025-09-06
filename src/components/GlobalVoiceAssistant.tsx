"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client"; // Assumindo que supabase é usado para configurações ou chamadas de IA
import { Mic, MicOff, Loader2 } from "lucide-react"; // Ícones para a UI

// Define um tipo para as interfaces SpeechRecognition e SpeechSynthesis
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

const GlobalVoiceAssistant = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Novo estado para indicar processamento
  const [activationPhrase, setActivationPhrase] = useState("ativar"); // Pode ser usado para ativar o assistente
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isMounted = useRef(true); // Para prevenir atualizações de estado em componente desmontado

  // Busca a frase de ativação (se necessário, caso contrário, pode ser removido)
  useEffect(() => {
    const fetchActivationPhrase = async () => {
      const { data, error } = await supabase.from("settings").select("activation_phrase").limit(1).single();
      if (!error && data?.activation_phrase) {
        setActivationPhrase(data.activation_phrase);
      }
    };
    fetchActivationPhrase();
  }, []);

  // Função para parar qualquer fala em andamento
  const stopSpeaking = useCallback(() => {
    if (synthRef.current && synthRef.current.speaking) {
      synthRef.current.cancel();
      if (isMounted.current) setIsSpeaking(false);
      if (currentUtteranceRef.current) {
        currentUtteranceRef.current.onend = null; // Limpa onend para evitar mudanças de estado indesejadas
        currentUtteranceRef.current.onerror = null;
        currentUtteranceRef.current = null;
      }
    }
  }, []);

  // Função para falar um determinado texto
  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!synthRef.current) {
      onDone?.();
      return;
    }

    stopSpeaking(); // Garante que qualquer fala anterior seja interrompida

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.onstart = () => {
      if (isMounted.current) setIsSpeaking(true);
    };
    utterance.onend = () => {
      if (isMounted.current) setIsSpeaking(false);
      onDone?.();
      currentUtteranceRef.current = null;
    };
    utterance.onerror = (event) => {
      console.error('SpeechSynthesisUtterance error:', event);
      if (isMounted.current) setIsSpeaking(false);
      onDone?.();
      currentUtteranceRef.current = null;
    };
    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [stopSpeaking]);

  // Função para processar o comando (placeholder para a lógica real da IA)
  const processCommand = useCallback(async (command: string) => {
    if (!isMounted.current) return;

    if (isMounted.current) setIsProcessing(true);
    console.log("Processando comando:", command);

    // Simula uma resposta da IA ou chama um serviço de IA real
    // Por enquanto, apenas ecoa ou fornece uma resposta genérica
    const aiResponse = `Você disse: "${command}". Estou processando sua solicitação.`;

    // Fala a resposta da IA
    speak(aiResponse, () => {
      if (isMounted.current) setIsProcessing(false);
      // Opcionalmente, reinicia a escuta após a resposta
      // if (!isListening) startListening(); // Apenas se não estiver ouvindo
    });

    // Em um cenário real, isso envolveria uma chamada de API:
    // try {
    //   const { data } = await supabase.functions.invoke('your-ai-function', { body: { command } });
    //   speak(data.response, () => setIsProcessing(false));
    // } catch (error) {
    //   console.error("AI processing error:", error);
    //   speak("Desculpe, houve um erro ao processar sua solicitação.", () => setIsProcessing(false));
    // }
  }, [speak]);

  // Função para iniciar a escuta
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        if (isMounted.current) setIsListening(true);
      } catch (e) {
        console.error("Error starting recognition:", e);
        // Often happens if recognition is already active or in a bad state
      }
    }
  }, [isListening]);

  // Função para parar a escuta
  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      if (isMounted.current) setIsListening(false);
    }
  }, [isListening]);

  // useEffect principal para configurar SpeechRecognition e SpeechSynthesis
  useEffect(() => {
    isMounted.current = true;

    // Inicializa SpeechSynthesis
    synthRef.current = window.speechSynthesis;

    // Inicializa SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Mantém a escuta contínua
      recognition.interimResults = false; // Apenas resultados finais
      recognition.lang = 'pt-BR';

      recognition.onstart = () => {
        if (isMounted.current) setIsListening(true);
        console.log('Reconhecimento de voz iniciado.');
      };

      recognition.onresult = (event) => {
        if (!isMounted.current) return;

        // --- NOVA LÓGICA: Interrupção e Confirmação ---
        stopSpeaking(); // Interrompe qualquer fala em andamento imediatamente

        const last = event.results.length - 1;
        const command = event.results[last][0].transcript.toLowerCase().trim();
        console.log('Comando recebido:', command);

        // Se o comando for muito curto ou apenas ruído, pode-se ignorar
        if (command.length < 3) { // Exemplo: ignora comandos muito curtos
          console.log("Comando muito curto, ignorando:", command);
          return;
        }

        // Fala a confirmação e então processa o comando
        speak("ok, entendi!", () => {
          // Após "ok, entendi!" ser falado, processa o comando
          processCommand(command);
        });
      };

      recognition.onend = () => {
        if (isMounted.current) setIsListening(false);
        console.log('Reconhecimento de voz encerrado.');
        // Se `continuous` for true, ele pode reiniciar automaticamente ou precisar de reinício manual.
        // Para robustez, podemos tentar reiniciá-lo se parar inesperadamente.
        // No entanto, para evitar loops infinitos, é melhor que o usuário o ative.
      };

      recognition.onerror = (event) => {
        console.error('Erro no reconhecimento de voz:', event.error);
        if (isMounted.current) setIsListening(false);
        // Lida com erros específicos, por exemplo, 'no-speech'
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          console.log('Nenhuma fala detectada ou problema de captura de áudio.');
          // Opcionalmente, reinicia o reconhecimento se for um erro transitório
          // if (isMounted.current) startListening(); // Cuidado para não criar loops
        }
      };

      recognitionRef.current = recognition;

    } else {
      console.warn('API de Reconhecimento de Fala não suportada neste navegador.');
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
      stopSpeaking(); // Garante que toda a fala seja cancelada ao desmontar
    };
  }, [speak, stopSpeaking, processCommand]); // Dependências para useCallback

  // Função para alternar a escuta
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
        className={`p-4 rounded-full shadow-lg transition-all duration-300
          ${isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-500 hover:bg-cyan-600'}
          text-white flex items-center justify-center`}
        disabled={isProcessing} // Desabilita o botão enquanto estiver processando
      >
        {isProcessing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
        <span className="ml-2 hidden md:inline">
          {isProcessing ? 'Processando...' : isListening ? 'Parar' : 'Ouvir'}
        </span>
      </button>
      {isSpeaking && (
        <div className="absolute bottom-full right-0 mb-2 p-2 bg-purple-800 text-white text-sm rounded-md shadow-md animate-pulse">
          Falando...
        </div>
      )}
    </div>
  );
};

export default GlobalVoiceAssistant;