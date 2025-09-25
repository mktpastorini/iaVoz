import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_STT_API_URL = "https://speech.googleapis.com/v1/speech:recognize";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Use the Service Role Key to bypass RLS for this server-to-server interaction
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: defaultWorkspace, error: dwError } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (dwError || !defaultWorkspace) {
      throw new Error("Default workspace not found.");
    }
    const workspaceId = defaultWorkspace.id;

    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('google_stt_api_key, google_stt_model, google_stt_enhanced')
      .eq('workspace_id', workspaceId)
      .single();

    const googleApiKey = settings?.google_stt_api_key;
    if (!googleApiKey) throw new Error("Google STT API key not configured.");

    const audioBlob = await req.blob();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(await audioBlob.arrayBuffer())));

    const requestBody = {
      config: {
        encoding: 'WEBM_OPUS', // MediaRecorder in Chrome often uses this
        sampleRateHertz: 48000, // Common for modern mics
        languageCode: 'pt-BR',
        model: settings.google_stt_model || 'default',
        useEnhanced: settings.google_stt_enhanced || false,
      },
      audio: {
        content: audioBase64,
      },
    };

    const response = await fetch(`${GOOGLE_STT_API_URL}?key=${googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Google STT API failed: ${JSON.stringify(errorBody)}`);
    }

    const responseData = await response.json();
    const transcript = responseData.results?.[0]?.alternatives?.[0]?.transcript || '';

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[google-stt-proxy] Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});