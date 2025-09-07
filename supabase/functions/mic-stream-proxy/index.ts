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

  // Tenta atualizar a requisição para uma conexão WebSocket
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Request isn't trying to upgrade to a websocket.", { status: 400 });
  }
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Busca as configurações do workspace padrão para obter a chave da API do Deepgram
  // Isso permite que o assistente público funcione de forma anônima
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
    return new Response("Não foi possível encontrar o workspace padrão", { status: 500 });
  }

  const { data: settings, error: settingsError } = await supabaseClient
    .from('settings')
    .select('deepgram_api_key')
    .eq('workspace_id', workspace.id)
    .single();

  if (settingsError || !settings?.deepgram_api_key) {
    console.error("Proxy Error: Chave da API do Deepgram não configurada.", settingsError);
    clientSocket.close(1011, "Chave da API do Deepgram não configurada.");
    return response; // Retorna a resposta do upgradeWebSocket para o cliente
  }

  const deepgramApiKey = settings.deepgram_api_key;
  const deepgramUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2-pt&interim_results=true&language=pt-BR&smart_format=true';

  const deepgramSocket = new WebSocket(deepgramUrl, {
    headers: { Authorization: `Token ${deepgramApiKey}` },
  });

  clientSocket.onopen = () => {
    console.log("WebSocket do cliente conectado.");
  };

  deepgramSocket.onopen = () => {
    console.log("WebSocket do Deepgram conectado.");
    // Quando o cliente envia áudio, encaminha para o Deepgram
    clientSocket.onmessage = (event) => {
      if (deepgramSocket.readyState === WebSocket.OPEN) {
        deepgramSocket.send(event.data);
      }
    };
  };

  // Quando o Deepgram envia uma transcrição, encaminha para o cliente
  deepgramSocket.onmessage = (event) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(event.data);
    }
  };

  // Gerenciamento de fechamento e erros para ambas as conexões
  deepgramSocket.onclose = (event) => {
    console.log("WebSocket do Deepgram fechado:", event.code, event.reason);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(event.code, "Conexão com Deepgram fechada.");
    }
  };

  deepgramSocket.onerror = (error) => {
    console.error("Erro no WebSocket do Deepgram:", error);
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(1011, "Erro na conexão com Deepgram.");
    }
  };

  clientSocket.onclose = (event) => {
    console.log("WebSocket do cliente fechado:", event.code, event.reason);
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.close();
    }
  };

  clientSocket.onerror = (error) => {
    console.error("Erro no WebSocket do cliente:", error);
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.close();
    }
  };

  return response;
});