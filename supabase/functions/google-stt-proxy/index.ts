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
    .select('google_stt_api_key')
    .eq('workspace_id', workspace.id)
    .single();

  if (settingsError || !settings?.google_stt_api_key) {
    console.error("Proxy Error: Chave da API Google STT não configurada.", settingsError);
    clientSocket.close(1011, "Chave da API Google STT não configurada.");
    return response;
  }

  const googleApiKey = settings.google_stt_api_key;
  const googleSttUrl = `wss://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`;

  // Google Cloud Speech-to-Text API é mais complexa para streaming via WebSocket.
  // Ela espera um formato específico de JSON para configuração inicial e depois chunks de áudio.
  // Esta implementação é um placeholder e precisaria de uma biblioteca cliente do Google
  // ou de uma implementação manual mais robusta para formatar as mensagens corretamente.
  // Por enquanto, vamos simular o comportamento de proxy de áudio.

  let googleSocket: WebSocket | null = null;

  clientSocket.onopen = () => {
    console.log("WebSocket do cliente conectado para Google STT.");
    googleSocket = new WebSocket(googleSttUrl);

    googleSocket.onopen = () => {
      console.log("WebSocket do Google STT conectado.");
      // Enviar a mensagem de configuração inicial para o Google STT
      googleSocket?.send(JSON.stringify({
        config: {
          encoding: "WEBM_OPUS", // Assumindo que o MediaRecorder está gerando WebM Opus
          sampleRateHertz: 48000, // Ajuste conforme a taxa de amostragem do seu microfone
          languageCode: "pt-BR",
          interimResults: true,
        },
        singleUtterance: false,
      }));

      clientSocket.onmessage = (event) => {
        if (event.data instanceof Blob && googleSocket?.readyState === WebSocket.OPEN) {
          // Enviar o áudio bruto para o Google
          googleSocket.send(event.data);
        } else if (typeof event.data === 'string') {
          // Se receber uma mensagem de texto do cliente, pode ser um sinal de controle
          const message = JSON.parse(event.data);
          if (message.type === 'stop_audio') {
            // Sinal para o Google STT parar de processar
            googleSocket?.send(JSON.stringify({ endpointer: true }));
          }
        }
      };
    };

    googleSocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        const googleResponse = JSON.parse(event.data);
        if (googleResponse.results && googleResponse.results.length > 0) {
          const transcript = googleResponse.results[0].alternatives[0].transcript;
          const isFinal = googleResponse.results[0].isFinal;
          clientSocket.send(JSON.stringify({
            channel: {
              alternatives: [{ transcript: transcript }],
            },
            is_final: isFinal,
          }));
        }
      }
    };

    googleSocket.onclose = (event) => {
      console.log("WebSocket do Google STT fechado:", event.code, event.reason);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(event.code, "Conexão com Google STT fechada.");
      }
    };

    googleSocket.onerror = (error) => {
      console.error("Erro no WebSocket do Google STT:", error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1011, "Erro na conexão com Google STT.");
      }
    };
  };

  clientSocket.onclose = (event) => {
    console.log("WebSocket do cliente fechado para Google STT:", event.code, event.reason);
    if (googleSocket?.readyState === WebSocket.OPEN) {
      googleSocket.close();
    }
  };

  clientSocket.onerror = (error) => {
    console.error("Erro no WebSocket do cliente para Google STT:", error);
    if (googleSocket?.readyState === WebSocket.OPEN) {
      googleSocket.close();
    }
  };

  return response;
});