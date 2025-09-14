import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deepgram API URL for streaming transcription with real-time parameters
const DEEPGRAM_URL = "wss://api.deepgram.com/v1/listen?model=nova-2-pt&language=pt-BR&smart_format=true&interim_results=true&endpointing=200&utterance_end_ms=1000";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  // Ensure the request is for a WebSocket upgrade
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("This endpoint requires a WebSocket connection.", { status: 400 });
  }

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  // Use the Supabase service role key to securely fetch API keys from the server-side
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let deepgramSocket: WebSocket | null = null;

  clientSocket.onopen = async () => {
    console.log("[Edge Function] Client WebSocket connected.");
    try {
      // Fetch the Deepgram API key from the settings of the default (first created) workspace
      const { data: settings, error } = await supabaseAdmin
        .from('settings')
        .select('deepgram_api_key')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error || !settings?.deepgram_api_key) {
        console.error("[Edge Function] Error fetching Deepgram API key:", error?.message || "API key not found.");
        clientSocket.send(JSON.stringify({ type: 'error', message: 'Deepgram API key not configured on the server.' }));
        clientSocket.close(1011, "Server configuration error.");
        return;
      }

      // Establish a WebSocket connection to Deepgram, authenticating with the fetched key
      deepgramSocket = new WebSocket(DEEPGRAM_URL, ["token", settings.deepgram_api_key]);

      deepgramSocket.onopen = () => {
        console.log("[Edge Function] Deepgram WebSocket connected.");
        clientSocket.send(JSON.stringify({ type: 'info', message: 'Streaming connection established.' }));
      };

      deepgramSocket.onmessage = (event) => {
        // Forward transcription results from Deepgram back to the client
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
        if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'info', message: 'Streaming connection closed.' }));
        }
        deepgramSocket = null;
      };

      deepgramSocket.onerror = (error) => {
        console.error("[Edge Function] Deepgram WebSocket error:", error);
        if (clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.send(JSON.stringify({ type: 'error', message: 'An error occurred with the streaming service.' }));
        }
      };

    } catch (e) {
      console.error("[Edge Function] Failed to initialize streaming session:", e);
      clientSocket.send(JSON.stringify({ type: 'error', message: 'Failed to initialize streaming session.' }));
      clientSocket.close(1011, "Initialization error.");
    }
  };

  clientSocket.onmessage = (event) => {
    // When the client sends audio data, forward it to Deepgram
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(event.data);
    }
  };

  clientSocket.onclose = (event) => {
    console.log(`[Edge Function] Client WebSocket closed: ${event.code} ${event.reason}`);
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
      // Gracefully close the connection to Deepgram
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