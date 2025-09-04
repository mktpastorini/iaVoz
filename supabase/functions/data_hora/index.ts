import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Ajuste para seu domínio em produção
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    // Responde ao preflight CORS com status 204 No Content
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Sua lógica da função data_hora aqui
    const now = new Date().toISOString();

    return new Response(
      JSON.stringify({ datetime: now }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Edge Function Error (data_hora):', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});