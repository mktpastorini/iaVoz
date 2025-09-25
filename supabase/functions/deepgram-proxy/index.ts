import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEEPGRAM_API_URL = "https://api.deepgram.com/v1";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Use the anon key as this function might be called by unauthenticated users
    // Security is handled by checking for a valid user session if needed
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the user to find their workspace settings
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data: workspaceMember } = await supabaseClient
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();
    
    const workspaceId = workspaceMember?.workspace_id;
    if (!workspaceId) throw new Error("Workspace not found for user");

    const { data: settings } = await supabaseClient
      .from('settings')
      .select('deepgram_api_key, deepgram_tts_model')
      .eq('workspace_id', workspaceId)
      .single();

    const deepgramApiKey = settings?.deepgram_api_key;
    if (!deepgramApiKey) throw new Error("Deepgram API key not configured for this workspace.");

    const { action, text } = await req.json();

    if (action === 'get_key') {
      // Generate a short-lived key for the client-side STT WebSocket
      const response = await fetch(`${DEEPGRAM_API_URL}/keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: `Temporary key for user ${user.id}`,
          scopes: ["usage:write"],
          time_to_live_in_seconds: 60, // Key is valid for 1 minute
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Deepgram key creation failed: ${JSON.stringify(errorBody)}`);
      }

      const keyData = await response.json();
      return new Response(JSON.stringify(keyData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (action === 'tts') {
      // Handle Text-to-Speech request and stream audio back
      const ttsModel = settings.deepgram_tts_model || 'aura-asteria-pt';
      const ttsUrl = `${DEEPGRAM_API_URL}/speak?model=${ttsModel}&encoding=mp3&sample_rate=24000`;

      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(`Deepgram TTS failed: ${JSON.stringify(errorBody)}`);
      }

      // Stream the audio response directly to the client
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
        },
        status: 200,
      });
    } else {
      throw new Error("Invalid action specified.");
    }

  } catch (error) {
    console.error('[deepgram-proxy] Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});