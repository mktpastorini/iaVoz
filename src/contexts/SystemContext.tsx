"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useSession } from './SessionContext';
import { replacePlaceholders } from '@/lib/utils';

interface Workspace {
  id: string;
  name: string;
}

interface Power {
  id: string;
  name: string;
  // Add other power fields as needed
}

interface SystemContextType {
  systemVariables: Record<string, any>;
  loadingSystemContext: boolean;
  refreshSystemVariables: () => void;
  effectiveWorkspace: Workspace | null;
  powers: Power[];
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

const GET_CLIENT_IP_FUNCTION_URL = `https://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/get-client-ip`;

export const SystemContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { workspace, user, loading: sessionLoading } = useSession();
  const [systemVariables, setSystemVariables] = useState<Record<string, any>>({});
  const [loadingSystemContext, setLoadingSystemContext] = useState(true);
  const [effectiveWorkspace, setEffectiveWorkspace] = useState<Workspace | null>(null);
  const [powers, setPowers] = useState<Power[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const determineEffectiveWorkspace = async () => {
      if (sessionLoading) return;

      if (user && workspace) {
        setEffectiveWorkspace(workspace);
      } else {
        const { data: defaultWorkspace, error } = await supabase
          .from('workspaces')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        
        if (error) {
          showError("Erro ao carregar workspace padrão.");
          console.error("[SystemContext] Error fetching default workspace:", error);
        } else {
          setEffectiveWorkspace(defaultWorkspace);
        }
      }
    };
    determineEffectiveWorkspace();
  }, [workspace, user, sessionLoading]);

  useEffect(() => {
    const executeSystemAndFetchPowers = async () => {
      if (!effectiveWorkspace?.id) {
        setLoadingSystemContext(false);
        return;
      }

      setLoadingSystemContext(true);
      
      const { data: powersData, error: powersError } = await supabase
        .from('powers')
        .select('*')
        .eq('workspace_id', effectiveWorkspace.id);
      
      if (powersError) {
        showError("Erro ao carregar poderes do assistente.");
      } else {
        setPowers(powersData || []);
      }

      const { data: enabledPowers, error } = await supabase
        .from('system_powers')
        .select('*')
        .eq('workspace_id', effectiveWorkspace.id)
        .eq('enabled', true)
        .order('created_at', { ascending: true });

      if (error) {
        showError("Erro ao carregar automações do sistema.");
        setLoadingSystemContext(false);
        return;
      }

      const newSystemVariables: Record<string, any> = {};
      for (const power of enabledPowers || []) {
        if (!power.url) continue;
        try {
          let data, invokeError;
          if (power.url === GET_CLIENT_IP_FUNCTION_URL) {
            const response = await fetch(GET_CLIENT_IP_FUNCTION_URL, { method: 'GET' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            data = await response.json();
          } else {
            const processedUrl = replacePlaceholders(power.url, newSystemVariables);
            const payload = { url: processedUrl, method: power.method, headers: power.headers, body: power.body };
            const { data: proxyData, error: proxyError } = await supabase.functions.invoke('proxy-api', { body: payload });
            data = proxyData;
            invokeError = proxyError;
          }
          if (invokeError) throw invokeError;
          newSystemVariables[power.output_variable_name] = data?.data || data;
        } catch (execError: any) {
          newSystemVariables[power.output_variable_name] = { error: execError.message };
        }
      }
      setSystemVariables(newSystemVariables);
      console.log("[SystemContext] Final systemVariables:", newSystemVariables);
      setLoadingSystemContext(false);
    };

    executeSystemAndFetchPowers();
  }, [effectiveWorkspace, refreshKey]);

  const refreshSystemVariables = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <SystemContext.Provider value={{ systemVariables, loadingSystemContext, refreshSystemVariables, effectiveWorkspace, powers }}>
      {children}
    </SystemContext.Provider>
  );
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemContextProvider');
  }
  return context;
};