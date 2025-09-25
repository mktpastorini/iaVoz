import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TTS_API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

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
      .select('google_tts_api_key, google_tts_voice_name, google_tts_speaking_rate, google_tts_pitch')
      .eq('workspace_id', workspaceId)
      .single();

    const googleApiKey = settings?.google_tts_api_key;
    if (!googleApiKey) throw new Error("Google TTS API key not configured for the default workspace.");

    const { text } = await req.json();
    if (!text) throw new Error("Text is required for TTS.");

    const requestBody = {
      input: { text },
      voice: {
        languageCode: 'pt-BR',
        name: settings.google_tts_voice_name || 'pt-BR-Wavenet-A',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: settings.google_tts_speaking_rate || 1.0,
        pitch: settings.google_tts_pitch || 0.0,
      },
    };

    const response = await fetch(`${GOOGLE_TTS_API_URL}?key=${googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Google TTS API failed: ${JSON.stringify(errorBody)}`);
    }

    const responseData = await response.json();
    const audioContent = atob(responseData.audioContent);
    const audioBytes = new Uint8Array(audioContent.length);
    for (let i = 0; i < audioContent.length; i++) {
      audioBytes[i] = audioContent.charCodeAt(i);
    }

    return new Response(audioBytes.buffer, {
      headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg' },
      status: 200,
    });

  } catch (error) {
    console.error('[google-tts-proxy] Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});