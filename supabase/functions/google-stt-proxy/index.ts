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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});