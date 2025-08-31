import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { 'x-client-info': 'supabase-edge-function' } } }
    );

    // Autenticação manual do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("[get-user-field] Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { field_name } = await req.json();

    if (!field_name) {
      return new Response(JSON.stringify({ error: 'Missing field_name in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Obter o workspace_id do usuário
    const { data: workspaceMember, error: wmError } = await supabaseClient
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (wmError || !workspaceMember) {
      console.error("[get-user-field] Error fetching workspace for user:", wmError?.message);
      return new Response(JSON.stringify({ error: 'User not associated with a workspace' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const workspaceId = workspaceMember.workspace_id;

    // 2. Encontrar a definição do campo de dados do usuário
    const { data: fieldDefinition, error: fieldDefError } = await supabaseClient
      .from('user_data_fields')
      .select('id, type')
      .eq('workspace_id', workspaceId)
      .eq('name', field_name)
      .limit(1)
      .single();

    if (fieldDefError || !fieldDefinition) {
      console.error("[get-user-field] Error fetching field definition:", fieldDefError?.message);
      return new Response(JSON.stringify({ error: `Field '${field_name}' not found or not defined for this workspace.` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Obter o valor do campo para o usuário
    const { data: fieldValue, error: fieldValueError } = await supabaseClient
      .from('user_field_values')
      .select('value')
      .eq('user_id', user.id)
      .eq('field_id', fieldDefinition.id)
      .limit(1)
      .single();

    if (fieldValueError && fieldValueError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error("[get-user-field] Error fetching field value:", fieldValueError?.message);
      return new Response(JSON.stringify({ error: 'Error retrieving field value.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let parsedValue: any = null;
    if (fieldValue?.value) {
      try {
        // Tenta parsear para o tipo correto
        if (fieldDefinition.type === 'number') {
          parsedValue = parseFloat(fieldValue.value);
          if (isNaN(parsedValue)) parsedValue = fieldValue.value; // Fallback if not a valid number
        } else if (fieldDefinition.type === 'boolean') {
          parsedValue = fieldValue.value.toLowerCase() === 'true';
        } else {
          parsedValue = fieldValue.value;
        }
      } catch (e) {
        console.warn(`[get-user-field] Could not parse value for field '${field_name}' as type '${fieldDefinition.type}'. Returning raw string.`, e);
        parsedValue = fieldValue.value;
      }
    }

    return new Response(
      JSON.stringify({ field_name, value: parsedValue }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[get-user-field] Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});