import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error("A chave de API do Gemini (GEMINI_API_KEY) não está configurada como um 'Secret' no seu projeto Supabase.");
    }

    const { text, model = 'tts-1' } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'O parâmetro "text" é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:synthesizeSpeech`;

    const requestBody = {
      input: { text },
      voice: {
        languageCode: "pt-BR",
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    };

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-goog-api-key': geminiApiKey
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorBody;
      try {
        errorBody = JSON.parse(errorText);
        console.error("Gemini TTS API Error (JSON):", errorBody);
        const errorMessage = errorBody?.error?.message || errorText;
        throw new Error(`Erro na API do Gemini TTS: ${errorMessage}`);
      } catch (e) {
        console.error("Gemini TTS API Error (Text):", errorText);
        throw new Error(`Erro na API do Gemini TTS: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[gemini-tts] Erro fatal na Edge Function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});