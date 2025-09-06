import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Cabeçalhos CORS definidos diretamente no arquivo para evitar erros de importação.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Lida com a requisição preflight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { history, settings, powers } = await req.json();

    const openAIKey = settings?.openai_api_key;
    if (!openAIKey) {
      return new Response(JSON.stringify({ error: "Chave da API da OpenAI não configurada nas Configurações." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Formata os "poderes" para o formato de "ferramentas" da OpenAI
    const tools = powers.map(power => ({
      type: "function",
      function: {
        name: power.name,
        description: power.description,
        parameters: power.parameters_schema,
      },
    }));

    // Monta o corpo da requisição para a OpenAI
    const body = {
      model: settings.ai_model || "gpt-4o-mini",
      messages: [
        { role: "system", content: settings.system_prompt },
        ...history,
      ],
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
    };

    // Chama a API da OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Erro da API OpenAI: ${errorBody.error.message}`);
    }

    const data = await response.json();

    // Retorna a resposta da OpenAI para o assistente
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Erro na Edge Function 'openai':", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});