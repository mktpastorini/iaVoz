"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';

export const useAssistantState = (embedWorkspaceId?: string) => {
  const { workspace: sessionWorkspace } = useSession();
  const [settings, setSettings] = useState<any>(null);
  const [powers, setPowers] = useState<any[]>([]);
  const [clientActions, setClientActions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  const powersRef = useRef(powers);
  const clientActionsRef = useRef(clientActions);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { powersRef.current = powers; }, [powers]);
  useEffect(() => { clientActionsRef.current = clientActions; }, [clientActions]);

  const fetchAllAssistantData = useCallback(async (workspaceId: string) => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: settingsData } = await supabase.from("settings").select("*").eq("workspace_id", workspaceId).single();
      setSettings(settingsData);
      const { data: powersData } = await supabase.from("powers").select("*").eq("workspace_id", workspaceId);
      setPowers(powersData || []);
      const { data: actionsData } = await supabase.from("client_actions").select("*").eq("workspace_id", workspaceId);
      setClientActions(actionsData || []);
    } catch (error) {
      showError("Erro ao carregar dados do assistente.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const determineWorkspace = () => {
      // Se for um script embedado, use o ID fornecido.
      if (embedWorkspaceId) {
        setCurrentWorkspaceId(embedWorkspaceId);
        return;
      }
      // Se o usuário estiver logado, use o workspace da sessão.
      if (sessionWorkspace) {
        setCurrentWorkspaceId(sessionWorkspace.id);
        return;
      }
      // Se for público/anônimo e sem ID de embed, não faz nada.
      // Isso corrige o erro que ocorria na página de login.
      setCurrentWorkspaceId(null);
      setIsLoading(false);
    };

    determineWorkspace();
  }, [embedWorkspaceId, sessionWorkspace]);

  useEffect(() => {
    if (currentWorkspaceId) {
      fetchAllAssistantData(currentWorkspaceId);
    }
  }, [currentWorkspaceId, fetchAllAssistantData]);

  return {
    settings,
    powers,
    clientActions,
    isLoading,
    settingsRef,
    powersRef,
    clientActionsRef,
    fetchAllAssistantData,
    currentWorkspaceId,
  };
};