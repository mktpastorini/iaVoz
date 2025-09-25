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
    console.log("[gemini-tts] Função iniciada.");
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error("[gemini-tts] Erro: Secret GEMINI_API_KEY não encontrado.");
      return new Response(
        JSON.stringify({ 
          error: 'A chave de API do Gemini não está configurada no servidor.',
          solution: "Por favor, configure o secret 'GEMINI_API_KEY' no painel do seu projeto Supabase em 'Edge Functions'."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    console.log("[gemini-tts] Chave de API encontrada.");

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
    
    console.log(`[gemini-tts] Resposta da API do Google: Status ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[gemini-tts] Erro da API do Google: ${errorText}`);
      let errorBody;
      try {
        errorBody = JSON.parse(errorText);
        throw new Error(`Erro na API do Gemini TTS: ${errorBody.error.message}`);
      } catch (e) {
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