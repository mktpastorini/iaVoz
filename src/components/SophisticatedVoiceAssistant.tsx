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
import { Mic, X } from "lucide-react";

interface VoiceAssistantProps {
  // ... (props)
}

// ... (interfaces)
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

const ImageModal = ({ imageUrl, altText, onClose }: { imageUrl: string; altText?: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
    <div className="relative max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
      <img src={imageUrl} alt={altText || 'Imagem exibida pelo assistente'} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 rounded-full" onClick={onClose}><X /></Button>
    </div>
  </div>
);

const SophisticatedVoiceAssistant: React.FC<VoiceAssistantProps> = ({
  // ... (props destructuring)
}) => {
  // ... (state variables)
  const [clientActions, setClientActions] = useState<ClientAction[]>([]);
  const [imageToShow, setImageToShow] = useState<ClientAction['action_payload'] | null>(null);

  // ... (useEffect for powers)

  useEffect(() => {
    if (workspace?.id) {
      const fetchClientActions = async () => {
        const { data, error } = await supabase.from('client_actions').select('*').eq('workspace_id', workspace.id);
        if (error) showError("Erro ao carregar ações do cliente.");
        else setClientActions(data || []);
      };
      fetchClientActions();
    }
  }, [workspace]);

  // ... (startListening, stopListening, stopSpeaking, closeAssistant, speak functions)

  const executeClientAction = (action: ClientAction) => {
    switch (action.action_type) {
      case 'OPEN_URL':
        if (action.action_payload.url) {
          speak(`Abrindo ${action.action_payload.url}`, () => {
            window.open(action.action_payload.url, '_blank');
            startListening();
          });
        }
        break;
      case 'SHOW_IMAGE':
        if (action.action_payload.imageUrl) {
          speak("Claro, aqui está a imagem.", () => {
            setImageToShow(action.action_payload);
            // A escuta será reiniciada quando o modal for fechado
          });
        }
        break;
    }
  };

  // ... (runConversation function)

  useEffect(() => {
    // ... (SpeechRecognition setup)

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      const closePhrase = "fechar";

      if (isOpen) {
        if (transcript.includes(closePhrase)) {
          closeAssistant();
          return;
        }

        // VERIFICA AÇÕES DO CLIENTE PRIMEIRO
        const matchedAction = clientActions.find(a => transcript.includes(a.trigger_phrase));
        if (matchedAction) {
          stopListening();
          executeClientAction(matchedAction);
          return;
        }

        // Se não houver ação, continua com a IA
        runConversation(transcript);
      } else {
        if (transcript.includes(activationPhrase.toLowerCase())) {
          setIsOpen(true);
          speak(welcomeMessage, startListening);
        } else {
          startListening();
        }
      }
    };

    // ... (rest of useEffect)
  }, [isInitialized, isOpen, activationPhrase, welcomeMessage, powers, clientActions, systemVariables]);

  // ... (handleInit function)

  return (
    <>
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
      {/* ... (o resto do JSX do assistente) */}
    </>
  );
};

export default SophisticatedVoiceAssistant;