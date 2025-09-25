import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: defaultWorkspace, error: dwError } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (dwError || !defaultWorkspace) {
      throw new Error("Default workspace not found.");
    }
    const workspaceId = defaultWorkspace.id;

    const { data: settings } = await supabaseAdmin.from('settings').select('openai_api_key').eq('workspace_id', workspaceId).single();
    if (!settings) {
      throw new Error("Settings not found for the default workspace.");
    }
    const openaiApiKey = settings.openai_api_key;
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured for the default workspace.");
    }

    const requestBody = await req.json();

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.json();
      throw new Error(`OpenAI API failed: ${JSON.stringify(errorBody)}`);
    }

    return new Response(openaiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      status: 200,
    });

  } catch (error) {
    console.error('[openai-proxy] Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});