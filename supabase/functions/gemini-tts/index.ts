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

    const { text, model = 'gemini-1.5-flash-preview-0514' } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'O parâmetro "text" é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Usando o endpoint correto para geração de conteúdo multimodal (incluindo áudio)
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    const requestBody = {
      contents: [{
        role: "user",
        parts: [{ text }]
      }],
      generationConfig: {
        // Especifica que a resposta deve ser em áudio
        responseMimeType: "audio/mpeg",
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

    // Extrai o conteúdo de áudio da resposta multimodal
    const audioContent = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioContent) {
      console.error("Resposta da API do Google não continha 'audioContent':", JSON.stringify(data, null, 2));
      throw new Error("A resposta da API do Google não continha o conteúdo de áudio esperado.");
    }

    // Retorna no formato que o frontend espera
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