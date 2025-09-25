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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: defaultWorkspace, error: dwError } = await supabaseClient
      .from('workspaces')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (dwError || !defaultWorkspace) {
      throw new Error("Default workspace not found.");
    }
    const workspaceId = defaultWorkspace.id;

    const { data: settings } = await supabaseClient
      .from('settings')
      .select('deepgram_api_key, deepgram_tts_model')
      .eq('workspace_id', workspaceId)
      .single();

    const deepgramApiKey = settings?.deepgram_api_key;
    if (!deepgramApiKey) throw new Error("Deepgram API key not configured for the default workspace.");

    const { action, text, user_id } = await req.json(); // user_id can be passed for comment

    if (action === 'get_key') {
      const response = await fetch(`${DEEPGRAM_API_URL}/keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: `Temporary key for user ${user_id || 'anonymous'}`,
          scopes: ["usage:write"],
          time_to_live_in_seconds: 60,
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