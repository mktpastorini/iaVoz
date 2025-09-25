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
    console.log("[gemini-tts] Function invoked.");
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error("A chave de API do Gemini (GEMINI_API_KEY) não está configurada como um 'Secret' no seu projeto Supabase.");
    }

    const { text, model } = await req.json();
    console.log(`[gemini-tts] Received request with text: "${text ? text.substring(0, 50) : 'EMPTY'}"`);

    if (!text) {
      return new Response(JSON.stringify({ error: 'O parâmetro "text" é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Corrigindo o endpoint. A API de TTS do Google, mesmo para modelos mais novos,
    // utiliza o endpoint 'texttospeech.googleapis.com'. O endpoint 'generativelanguage' é para o chat.
    const GOOGLE_API_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${geminiApiKey}`;

    const requestBody = {
      input: { text },
      voice: {
        languageCode: "pt-BR",
        // Usando uma voz padrão de alta qualidade. O parâmetro 'model' do cliente não é usado aqui.
        name: "pt-BR-Wavenet-A",
      },
      audioConfig: {
        audioEncoding: "MP3",
      },
    };
    
    console.log("[gemini-tts] Sending request to Google TTS API:", GOOGLE_API_URL);
    console.log("[gemini-tts] Request body:", JSON.stringify(requestBody));

    const response = await fetch(GOOGLE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    console.log(`[gemini-tts] Received status from Google API: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorBody;
      try {
        errorBody = JSON.parse(errorText);
        console.error("Google TTS API Error (JSON):", errorBody);
        const errorMessage = errorBody?.error?.message || errorText;
        throw new Error(`Erro na API do Google TTS: ${errorMessage}`);
      } catch (e) {
        console.error("Google TTS API Error (Text):", errorText);
        throw new Error(`Erro na API do Google TTS: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();
    console.log("[gemini-tts] Successfully received data from Google API.");

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[gemini-tts] Erro fatal na Edge Function:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});