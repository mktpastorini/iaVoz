import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEEPGRAM_URL = "wss://api.deepgram.com/v1/listen?model=nova-2-pt&language=pt-BR&smart_format=true&interim_results=true&endpointing=200&utterance_end_ms=1000";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("This endpoint requires a WebSocket connection.", { status: 400 });
  }

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let deepgramSocket: WebSocket | null = null;

  clientSocket.onopen = async () => {
    console.log("[Edge Function] Client WebSocket connected.");
    try {
      const { data: settings, error } = await supabaseAdmin
        .from('settings')
        .select('deepgram_api_key')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      // Log aprimorado para depuração da chave de API
      if (error || !settings?.deepgram_api_key) {
        const logMessage = error ? `Database error: ${error.message}` : "API key not found in settings.";
        const userMessage = "A chave de API do Deepgram não está configurada corretamente no painel de administração.";
        console.error(`[Edge Function] Error fetching Deepgram API key: ${logMessage}`);
        clientSocket.send(JSON.stringify({ type: 'error', message: userMessage }));
        clientSocket.close(1011, "Server configuration error.");
        return;
      }
      
      console.log("[Edge Function] Deepgram API key found. Connecting to Deepgram...");

      deepgramSocket = new WebSocket(DEEPGRAM_URL, ["token", settings.deepgram_api_key]);

      deepgramSocket.onopen = () => {
        console.log("[Edge Function] Deepgram WebSocket connected successfully.");
        clientSocket.send(JSON.stringify({ type: 'info', message: 'Streaming connection established.' }));
      };

      deepgramSocket.onmessage = (event) => {
        const deepgramMessage = JSON.parse(event.data);
        if (deepgramMessage.channel?.alternatives[0]?.transcript) {
            clientSocket.send(JSON.stringify({
                type: 'transcript',
                data: deepgramMessage,
            }));
        }
      };

      deepgramSocket.onclose = (event) => {
        console.log(`[Edge Function] Deepgram WebSocket closed: ${event.code} ${event.reason}`);
        // Adicionado log para erro de autenticação
        if (event.code === 4001) {
             const authErrorMessage = "Falha na autenticação com o Deepgram. Verifique se a chave de API é válida e tem permissões.";
             console.error("[Edge Function] Deepgram authentication failed (Code 4001).");
             if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({ type: 'error', message: authErrorMessage }));
             }
        } else if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'info', message: 'Streaming connection closed.' }));
        }
        deepgramSocket = null;
      };

      deepgramSocket.onerror = (error) => {
        const errorMessage = "Ocorreu um erro com o serviço de streaming. Verifique a validade da sua chave de API do Deepgram.";
        console.error("[Edge Function] Deepgram WebSocket error:", error);
        if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'error', message: errorMessage }));
        }
      };

    } catch (e) {
      console.error("[Edge Function] Failed to initialize streaming session:", e);
      clientSocket.send(JSON.stringify({ type: 'error', message: 'Failed to initialize streaming session.' }));
      clientSocket.close(1011, "Initialization error.");
    }
  };

  clientSocket.onmessage = (event) => {
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(event.data);
    }
  };

  clientSocket.onclose = (event) => {
    console.log(`[Edge Function] Client WebSocket closed: ${event.code} ${event.reason}`);
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(JSON.stringify({ type: 'CloseStream' }));
      deepgramSocket.close();
    }
  };

  clientSocket.onerror = (error) => {
    console.error("[Edge Function] Client WebSocket error:", error);
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.close(1011, "Client error.");
    }
  };

  return response;
});