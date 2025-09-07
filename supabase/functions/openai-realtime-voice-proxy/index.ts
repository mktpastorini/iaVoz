import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Request isn't trying to upgrade to a websocket.", { status: 400 });
  }
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const { data: workspace, error: wsError } = await supabaseClient
    .from('workspaces')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (wsError || !workspace) {
    console.error("Proxy Error: Não foi possível encontrar o workspace padrão.", wsError);
    clientSocket.close(1011, "Não foi possível encontrar o workspace padrão.");
    return response;
  }

  const { data: settings, error: settingsError } = await supabaseClient
    .from('settings')
    .select('openai_api_key')
    .eq('workspace_id', workspace.id)
    .single();

  if (settingsError || !settings?.openai_api_key) {
    console.error("Proxy Error: Chave da API OpenAI não configurada.", settingsError);
    clientSocket.close(1011, "Chave da API OpenAI não configurada.");
    return response;
  }

  const openaiApiKey = settings.openai_api_key;

  // URL WebSocket da API de voz em tempo real da OpenAI (exemplo fictício, ajuste conforme documentação oficial)
  const openaiWsUrl = "wss://api.openai.com/v1/voice/stream";

  let openaiSocket: WebSocket | null = null;

  clientSocket.onopen = () => {
    console.log("WebSocket do cliente conectado para OpenAI Real-time Voice.");
    openaiSocket = new WebSocket(openaiWsUrl, {
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
    });

    openaiSocket.onopen = () => {
      console.log("WebSocket da OpenAI Real-time Voice conectado.");

      // Encaminha mensagens do cliente para a OpenAI
      clientSocket.onmessage = (event) => {
        if (openaiSocket?.readyState === WebSocket.OPEN) {
          openaiSocket.send(event.data);
        }
      };
    };

    // Encaminha mensagens da OpenAI para o cliente
    openaiSocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data);
      }
    };

    openaiSocket.onclose = (event) => {
      console.log("WebSocket da OpenAI Real-time Voice fechado:", event.code, event.reason);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(event.code, "Conexão com OpenAI Real-time Voice fechada.");
      }
    };

    openaiSocket.onerror = (error) => {
      console.error("Erro no WebSocket da OpenAI Real-time Voice:", error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1011, "Erro na conexão com OpenAI Real-time Voice.");
      }
    };
  };

  clientSocket.onclose = (event) => {
    console.log("WebSocket do cliente fechado para OpenAI Real-time Voice:", event.code, event.reason);
    if (openaiSocket?.readyState === WebSocket.OPEN) {
      openaiSocket.close();
    }
  };

  clientSocket.onerror = (error) => {
    console.error("Erro no WebSocket do cliente para OpenAI Real-time Voice:", error);
    if (openaiSocket?.readyState === WebSocket.OPEN) {
      openaiSocket.close();
    }
  };

  return response;
});