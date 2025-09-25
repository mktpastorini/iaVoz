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

    const { text, model = 'gemini-2.5-flash-preview-tts' } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'O parâmetro "text" é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    // Usando a estrutura exata da documentação da API REST com o objeto "config".
    const requestBody = {
      contents: [{
        parts:[{
          text: text
        }]
      }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "zephyr" // Usando uma das vozes válidas como "zephyr" ou "Kore"
            }
          }
        }
      }
    };

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorBody;
      try {
        errorBody = JSON.parse(errorText);
        console.error("--> ERRO DA API GOOGLE:", JSON.stringify(errorBody, null, 2));
        const errorMessage = errorBody?.error?.message || errorText;
        throw new Error(`Erro na API do Google: ${errorMessage}`);
      } catch (e) {
        console.error("--> ERRO (TEXTO BRUTO) DA API GOOGLE:", errorText);
        throw new Error(`Erro na API do Google: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();
    const audioContent = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioContent) {
      console.error("Resposta da API do Google não continha 'audioContent':", JSON.stringify(data, null, 2));
      throw new Error("A resposta da API do Google não continha o conteúdo de áudio esperado.");
    }

    return new Response(JSON.stringify({ audioContent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[gemini-tts] Erro fatal na Edge Function:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});