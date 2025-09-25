import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('A chave de API do Google (GOOGLE_API_KEY) não está configurada como um secret na Supabase.');
    }

    const { text, voiceName, speakingRate, pitch } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'O parâmetro "text" é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const languageCode = voiceName ? voiceName.split('-').slice(0, 2).join('-') : 'pt-BR';

    const requestBody = {
      input: { text },
      voice: {
        languageCode: languageCode,
        name: voiceName || 'pt-BR-Wavenet-A',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: speakingRate || 1.0,
        pitch: pitch || 0.0,
      },
    };

    const response = await fetch(`${GOOGLE_API_URL}?key=${googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Google TTS API Error:", errorBody);
      throw new Error(`Erro na API do Google TTS: ${errorBody.error.message}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[google-tts] Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});