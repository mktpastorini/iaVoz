"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';

interface Settings {
  system_prompt: string;
  assistant_prompt: string;
  ai_model: string;
  voice_model: string;
  openai_tts_voice: string | null;
  voice_sensitivity: number;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  conversation_memory_length: number;
  activation_phrase: string;
  welcome_message: string | null;
  continuation_phrase: string | null;
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

export const useAssistantData = () => {
  const { session } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [powers, setPowers] = useState<Power[]>([]);
  const [clientActions, setClientActions] = useState<ClientAction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const fetchAllAssistantData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      let currentSettings: Settings | null = null;
      const currentSession = session; // Use session directly from context

      // Try to fetch workspace-specific settings first
      if (currentSession?.user?.id) {
        const { data: workspaceMember } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', currentSession.user.id)
          .limit(1)
          .single();
        
        if (workspaceMember) {
          const { data } = await supabase
            .from("settings")
            .select("*")
            .eq('workspace_id', workspaceMember.workspace_id)
            .limit(1)
            .single();
          currentSettings = data;
        }
      }
      
      // If no workspace-specific settings, fetch default (first created)
      if (!currentSettings) {
        const { data } = await supabase
          .from("settings")
          .select("*")
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        currentSettings = data;
      }
      
      setSettings(currentSettings);

      // Fetch powers and client actions
      const { data: powersData, error: powersError } = await supabase.from("powers").select("*");
      if (powersError) {
        console.error("Error fetching powers:", powersError);
        showError("Erro ao carregar poderes.");
      } else {
        setPowers(powersData || []);
      }

      const { data: actionsData, error: actionsError } = await supabase.from("client_actions").select("*");
      if (actionsError) {
        console.error("Error fetching client actions:", actionsError);
        showError("Erro ao carregar ações do cliente.");
      } else {
        setClientActions(actionsData || []);
      }

      return currentSettings;
    } catch (error) {
      console.error("Erro ao carregar dados do assistente:", error);
      showError("Erro ao carregar dados do assistente.");
      return null;
    } finally {
      setIsLoadingData(false);
    }
  }, [session]); // Depend on session to refetch when user changes

  useEffect(() => {
    fetchAllAssistantData();
  }, [fetchAllAssistantData]);

  return { settings, powers, clientActions, isLoadingData, fetchAllAssistantData };
};