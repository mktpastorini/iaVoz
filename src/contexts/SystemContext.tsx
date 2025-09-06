"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  const { workspace: sessionWorkspace, loading: sessionLoading } = useSession();
  const [defaultWorkspace, setDefaultWorkspace] = useState(null);
  const [systemVariables, setSystemVariables] = useState<Record<string, any>>({});
  const [loadingSystemContext, setLoadingSystemContext] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const isExecutingRef = useRef(false);

  // Workspace efetivo: sessão ou padrão
  const effectiveWorkspace = sessionWorkspace || defaultWorkspace;

  // Buscar workspace padrão se não houver workspace da sessão
  useEffect(() => {
    const fetchDefaultWorkspace = async () => {
      if (sessionWorkspace || sessionLoading) {
        console.log("[SystemContext] Session workspace present or loading, skipping default workspace fetch.");
        return;
      }
      console.log("[SystemContext] Fetching default workspace...");
      try {
        const { data: defaultWs, error } = await supabase
          .from('workspaces')
          .select('id, name, plan, created_by')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (error) {
          console.error("[SystemContext] Error fetching default workspace:", error);
          showError("Erro ao carregar workspace padrão.");
          setDefaultWorkspace(null);
        } else {
          console.log("[SystemContext] Default workspace fetched:", defaultWs);
          setDefaultWorkspace(defaultWs);
        }
      } catch (e) {
        console.error("[SystemContext] Exception fetching default workspace:", e);
        setDefaultWorkspace(null);
      }
    };

    fetchDefaultWorkspace();
  }, [sessionWorkspace, sessionLoading]);

  // Executar poderes somente quando workspace efetivo estiver definido
  useEffect(() => {
    const executeSystemPowers = async () => {
      if (!effectiveWorkspace?.id) {
        setLoadingSystemContext(false);
        console.log("[SystemContext] No effective workspace, skipping system powers execution.");
        return;
      }

      if (isExecutingRef.current) {
        console.log("[SystemContext] Already executing system powers, skipping concurrent call.");
        return;
      }

      isExecutingRef.current = true;
      setLoadingSystemContext(true);
      console.log("[SystemContext] Starting execution of system powers...");

      try {
        const { data: enabledPowers, error } = await supabase
          .from('system_powers')
          .select('*')
          .eq('workspace_id', effectiveWorkspace.id)
          .eq('enabled', true)
          .order('created_at', { ascending: true });

        if (error) {
          console.error("[SystemContext] Error loading enabled system powers:", error);
          showError("Erro ao carregar automações do sistema.");
          setLoadingSystemContext(false);
          isExecutingRef.current = false;
          return;
        }

        console.log(`[SystemContext] Found ${enabledPowers?.length || 0} enabled system powers.`);

        const newSystemVariables: Record<string, any> = {};
        for (const power of enabledPowers || []) {
          if (!power.url) {
            console.warn(`[SystemContext] System power '${power.name}' has no URL defined. Skipping.`);
            continue;
          }

          console.log(`[SystemContext] Executing system power '${power.name}' with output variable '${power.output_variable_name}'`);

          try {
            let data, invokeError;
            const isGetClientIpPower = power.url === GET_CLIENT_IP_FUNCTION_URL;

            if (isGetClientIpPower) {
              console.log(`[SystemContext] Fetching 'get-client-ip' directly for power '${power.name}'`);
              try {
                const response = await fetch(GET_CLIENT_IP_FUNCTION_URL, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                });

                if (!response.ok) {
                  const errorBody = await response.json();
                  throw new Error(`HTTP error! status: ${response.status}, message: ${errorBody.error || response.statusText}`);
                }
                data = await response.json();
                invokeError = null;
                console.log(`[SystemContext] 'get-client-ip' response:`, data);
              } catch (e: any) {
                invokeError = e;
                data = null;
                console.error(`[SystemContext] Error fetching 'get-client-ip':`, e);
              }
            } else {
              const processedUrl = replacePlaceholders(power.url, newSystemVariables);
              const processedHeadersStr = replacePlaceholders(JSON.stringify(power.headers || {}), newSystemVariables);
              const processedBodyStr = replacePlaceholders(JSON.stringify(power.body || {}), newSystemVariables);

              const payload = {
                url: processedUrl,
                method: power.method,
                headers: JSON.parse(processedHeadersStr),
                body: JSON.parse(processedBodyStr),
              };

              console.log(`[SystemContext] Invoking 'proxy-api' for power '${power.name}' with URL: ${payload.url}`);

              try {
                const { data: proxyData, error: proxyError } = await supabase.functions.invoke('proxy-api', { body: payload, noResolveJson: true });
                if (proxyError) {
                  if (proxyError.message && proxyError.message.toLowerCase().includes('jwt')) {
                    console.warn(`[SystemContext] Ignoring JWT error for power '${power.name}':`, proxyError.message);
                    invokeError = null;
                    data = null;
                  } else {
                    invokeError = proxyError;
                    data = null;
                    console.error(`[SystemContext] Error invoking proxy-api for power '${power.name}':`, proxyError);
                  }
                } else {
                  try {
                    const jsonData = await proxyData.json();
                    data = jsonData;
                    invokeError = null;
                    console.log(`[SystemContext] proxy-api response for power '${power.name}':`, jsonData);
                  } catch {
                    const textData = await proxyData.text();
                    data = textData;
                    invokeError = null;
                    console.log(`[SystemContext] proxy-api response (text) for power '${power.name}':`, textData);
                  }
                }
              } catch (e) {
                invokeError = e;
                data = null;
                console.error(`[SystemContext] Exception invoking proxy-api for power '${power.name}':`, e);
              }
            }

            if (invokeError) {
              console.error(`[SystemContext] Error executing system power '${power.name}':`, invokeError);
              showError(`Erro na automação '${power.name}'.`);
              newSystemVariables[power.output_variable_name] = { error: invokeError.message };
            } else {
              newSystemVariables[power.output_variable_name] = data?.data || data;
              console.log(`[SystemContext] Stored result for '${power.output_variable_name}':`, newSystemVariables[power.output_variable_name]);
            }
          } catch (execError: any) {
            console.error(`[SystemContext] Unexpected error executing system power '${power.name}':`, execError);
            showError(`Erro inesperado na automação '${power.name}'.`);
            newSystemVariables[power.output_variable_name] = { error: execError.message };
          }
        }

        setSystemVariables(newSystemVariables);
        console.log("[SystemContext] Finished execution of system powers. Final systemVariables:", newSystemVariables);
      } catch (globalError: any) {
        console.error("[SystemContext] Global error processing system powers:", globalError);
        showError("Erro ao processar automações do sistema.");
      } finally {
        setLoadingSystemContext(false);
        isExecutingRef.current = false;
      }
    };

    executeSystemPowers();
  }, [effectiveWorkspace, refreshKey, sessionLoading]);

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