"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useSession } from './SessionContext';
import { replacePlaceholders } from '@/lib/utils';

interface SystemContextType {
  systemVariables: Record<string, any>;
  loadingSystemContext: boolean;
  refreshSystemVariables: () => void;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

const GET_CLIENT_IP_FUNCTION_URL = `https://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/get-client-ip`;

export const SystemContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { workspace, loading: sessionLoading } = useSession();
  const [systemVariables, setSystemVariables] = useState<Record<string, any>>({});
  const [loadingSystemContext, setLoadingSystemContext] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSystemData = async () => {
    if (!workspace?.id) {
      setLoadingSystemContext(false);
      return;
    }

    setLoadingSystemContext(true);
    try {
      const newSystemVariables: Record<string, any> = {};

      // 1. Carregar Produtos e Serviços
      const { data: products, error: productsError } = await supabase
        .from('products_services')
        .select('*')
        .eq('workspace_id', workspace.id);

      if (productsError) {
        console.error("[SystemContext] Erro ao carregar produtos/serviços:", productsError);
        showError("Erro ao carregar dados de produtos.");
      } else {
        products?.forEach(item => {
          if (item.item_key) {
            newSystemVariables[`${item.item_key}_name`] = item.name;
            newSystemVariables[`${item.item_key}_description`] = item.description;
            newSystemVariables[`${item.item_key}_page_url`] = item.page_url;
            newSystemVariables[`${item.item_key}_image_url`] = item.image_url;
            newSystemVariables[`${item.item_key}_video_url`] = item.video_url;
            // Chave geral com um resumo
            newSystemVariables[item.item_key] = `Item: ${item.name}. Descrição: ${item.description || 'N/A'}. Página: ${item.page_url || 'N/A'}`;
          }
        });
      }

      // 2. Carregar e Executar Poderes do Sistema
      const { data: enabledPowers, error: powersError } = await supabase
        .from('system_powers')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('enabled', true)
        .order('created_at', { ascending: true });

      if (powersError) {
        console.error("[SystemContext] Erro ao carregar poderes do sistema:", powersError);
        showError("Erro ao carregar automações do sistema.");
      } else {
        for (const power of enabledPowers || []) {
          if (!power.url) continue;
          try {
            let data, invokeError;
            const isGetClientIpPower = power.url === GET_CLIENT_IP_FUNCTION_URL;

            if (isGetClientIpPower) {
              const response = await fetch(GET_CLIENT_IP_FUNCTION_URL, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              data = await response.json();
              invokeError = null;
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
              console.error(`[SystemContext] Erro ao executar poder '${power.name}':`, invokeError);
              newSystemVariables[power.output_variable_name] = { error: invokeError.message };
            } else {
              newSystemVariables[power.output_variable_name] = data?.data || data;
            }
          } catch (execError: any) {
            console.error(`[SystemContext] Erro inesperado ao executar poder '${power.name}':`, execError);
            newSystemVariables[power.output_variable_name] = { error: execError.message };
          }
        }
      }

      setSystemVariables(newSystemVariables);
      console.log("[SystemContext] Final systemVariables:", newSystemVariables);
    } catch (globalError: any) {
      console.error("[SystemContext] Erro global ao processar dados do sistema:", globalError);
      showError("Erro ao processar dados do sistema.");
    } finally {
      setLoadingSystemContext(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      loadSystemData();
    }
  }, [workspace, sessionLoading, refreshKey]);

  const refreshSystemVariables = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <SystemContext.Provider value={{ systemVariables, loadingSystemContext, refreshSystemVariables }}>
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