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
      throw new Error('A chave de API do Gemini (GEMINI_API_KEY) não está configurada como um secret na Supabase.');
    }

    const { text, model = 'gemini-2.5-flash-preview-tts' } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'O parâmetro "text" é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateSpeech?key=${geminiApiKey}`;

    const requestBody = { text };

    const response = await fetch(GOOGLE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Gemini TTS API Error:", errorBody);
      throw new Error(`Erro na API do Gemini TTS: ${errorBody.error.message}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[gemini-tts] Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});