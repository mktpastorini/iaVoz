"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { showError } from '@/utils/toast';

export const useAssistantState = (embedWorkspaceId?: string) => {
  const { workspace: sessionWorkspace, loading: sessionLoading } = useSession();
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
    // Só toma uma decisão quando a sessão não estiver mais carregando
    if (!sessionLoading) {
      const workspaceIdToUse = embedWorkspaceId || sessionWorkspace?.id || null;
      setCurrentWorkspaceId(workspaceIdToUse);
    }
  }, [embedWorkspaceId, sessionWorkspace, sessionLoading]);

  useEffect(() => {
    if (currentWorkspaceId) {
      fetchAllAssistantData(currentWorkspaceId);
    } else if (!sessionLoading) {
      // Se não houver workspaceId e a sessão já foi verificada, para de carregar.
      setIsLoading(false);
    }
  }, [currentWorkspaceId, fetchAllAssistantData, sessionLoading]);

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