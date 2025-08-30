"use client";

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom"; // Importar useNavigate
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
import { IframeModal } from "./IframeModal";

// ... (Interfaces)
interface ProductService {
  id: string;
  name: string;
  description: string | null;
  page_url: string | null;
  image_url: string | null;
  video_url: string | null; // Adicionado
}

// ... (outras interfaces)

// ... (ImageModal component)

// Main Component
const SophisticatedVoiceAssistant: React.FC<VoiceAssistantProps> = ({
  // ... (props)
}) => {
  const navigate = useNavigate(); // Hook para navegação
  // ... (estados)
  const [productsServices, setProductsServices] = useState<ProductService[]>([]);

  useEffect(() => {
    if (workspace?.id) {
      // ... (fetchPowers, fetchClientActions)
      const fetchProductsServices = async () => {
        const { data, error } = await supabase.from('products_services').select('*').eq('workspace_id', workspace.id);
        if (error) showError("Erro ao carregar produtos e serviços.");
        else setProductsServices(data || []);
      };
      fetchProductsServices();
    }
  }, [workspace]);

  // ... (funções de controle de áudio)

  const executeProductServiceAction = (item: ProductService) => {
    // Prioridade: URL da página > URL do vídeo > Descrição > URL da imagem
    if (item.page_url) {
      speak(`Navegando para a página de ${item.name}.`, () => {
        // Usa o hook de navegação para mudar de página
        navigate(item.page_url!);
      });
    } else if (item.video_url) {
      speak(`Mostrando o vídeo de ${item.name}.`, () => {
        setIframeToShow({ url: item.video_url! });
      });
    } else if (item.description) {
      speak(item.description, startListening);
    } else if (item.image_url) {
      speak(`Mostrando imagem de ${item.name}.`, () => {
        setImageToShow({ imageUrl: item.image_url! });
      });
    } else {
      speak(`Não encontrei informações detalhadas para ${item.name}.`, startListening);
    }
  };

  // ... (runConversation, useEffect de reconhecimento de voz)

  useEffect(() => {
    // ... (lógica de reconhecimento)
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      // ... (lógica de fechar e ações do cliente)

      // 3. Verificar Produtos/Serviços
      const matchedProductService = productsServices.find(p => transcript.includes(p.name.toLowerCase()));
      if (matchedProductService) {
        stopListening();
        executeProductServiceAction(matchedProductService);
        return;
      }

      // 4. Se nada acima, enviar para a IA
      runConversation(transcript);
    };
    // ... (resto do useEffect)
  }, [isInitialized, isOpen, activationPhrase, welcomeMessage, powers, clientActions, productsServices, systemVariables, imageToShow, iframeToShow]);

  // ... (resto do componente)
};

export default SophisticatedVoiceAssistant;