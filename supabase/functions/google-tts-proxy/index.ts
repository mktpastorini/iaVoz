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
      .select('google_tts_api_key, google_tts_voice_name, google_tts_speaking_rate, google_tts_pitch')
      .eq('workspace_id', workspaceId)
      .single();

    const googleApiKey = settings?.google_tts_api_key;
    if (!googleApiKey) throw new Error("Google TTS API key not configured.");

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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});