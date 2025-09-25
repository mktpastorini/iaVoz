import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatToGemini(messages) {
  const geminiMessages = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      if (geminiMessages.length > 0 && geminiMessages[0].role === 'user') {
        geminiMessages[0].parts[0].text = `${msg.content}\n\n${geminiMessages[0].parts[0].text}`;
      }
    } else if (msg.role === 'user') {
      geminiMessages.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant') {
      geminiMessages.push({ role: 'model', parts: [{ text: msg.content || ' ' }] });
    }
  }
  return geminiMessages;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: defaultWorkspace, error: dwError } = await supabaseClient
      .from('workspaces')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (dwError || !defaultWorkspace) {
      throw new Error("Default workspace not found.");
    }
    const workspaceId = defaultWorkspace.id;

    const { data: settings } = await supabaseClient.from('settings').select('gemini_api_key').eq('workspace_id', workspaceId).single();
    const geminiApiKey = settings?.gemini_api_key;
    if (!geminiApiKey) throw new Error("Gemini API key not configured for the default workspace.");

    const { model, messages, tools } = await req.json();
    const formattedMessages = formatToGemini(messages);

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${geminiApiKey}`;

    const requestBody = {
      contents: formattedMessages,
      tools: tools ? [{ function_declarations: tools.map(t => t.function) }] : undefined,
    };

    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.json();
      throw new Error(`Gemini API failed: ${JSON.stringify(errorBody)}`);
    }

    return new Response(geminiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      status: 200,
    });

  } catch (error) {
    console.error('[gemini-proxy] Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});