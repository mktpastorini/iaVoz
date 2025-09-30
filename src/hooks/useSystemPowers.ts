"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { replacePlaceholders } from '@/lib/utils';

const GET_CLIENT_IP_FUNCTION_URL = `https://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/get-client-ip`;

export const useSystemPowers = (workspaceId: string | null) => {
  const [systemVariables, setSystemVariables] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const executeSystemPowers = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: enabledPowers, error } = await supabase
        .from('system_powers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('enabled', true)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("[useSystemPowers] Erro ao carregar poderes do sistema:", error);
        showError("Erro ao carregar automações do sistema.");
        setLoading(false);
        return;
      }

      const newSystemVariables: Record<string, any> = {};
      for (const power of enabledPowers || []) {
        if (!power.url) continue;

        try {
          let data, invokeError;
          const isGetClientIpPower = power.url === GET_CLIENT_IP_FUNCTION_URL;

          if (isGetClientIpPower) {
            try {
              const response = await fetch(GET_CLIENT_IP_FUNCTION_URL, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
              if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorBody.error || response.statusText}`);
              }
              data = await response.json();
              invokeError = null;
            } catch (e: any) {
              invokeError = e;
              data = null;
            }
          } else {
            const processedUrl = replacePlaceholders(power.url, newSystemVariables);
            const processedHeadersStr = replacePlaceholders(JSON.stringify(power.headers || {}), newSystemVariables);
            const processedBodyStr = replacePlaceholders(JSON.stringify(power.body || {}), newSystemVariables);
            const payload = { url: processedUrl, method: power.method, headers: JSON.parse(processedHeadersStr), body: JSON.parse(processedBodyStr) };
            const { data: proxyData, error: proxyError } = await supabase.functions.invoke('proxy-api', { body: payload });
            data = proxyData;
            invokeError = proxyError;
          }

          if (invokeError) {
            console.error(`[useSystemPowers] Erro ao executar poder '${power.name}':`, invokeError);
            newSystemVariables[power.output_variable_name] = { error: invokeError.message };
          } else {
            newSystemVariables[power.output_variable_name] = data?.data || data;
          }
        } catch (execError: any) {
          console.error(`[useSystemPowers] Erro inesperado ao executar poder '${power.name}':`, execError);
          newSystemVariables[power.output_variable_name] = { error: execError.message };
        }
      }
      setSystemVariables(newSystemVariables);
    } catch (globalError: any) {
      console.error("[useSystemPowers] Erro global:", globalError);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    executeSystemPowers();
  }, [executeSystemPowers]);

  return { systemVariables, loadingSystemPowers: loading, refreshSystemVariables: executeSystemPowers };
};