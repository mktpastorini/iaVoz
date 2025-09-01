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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cria um cliente Supabase autenticado com o token do usuário
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Obtém o usuário a partir do cliente autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[set-user-field] Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { field_name, field_value } = await req.json();

    if (!field_name || field_value === undefined) {
      return new Response(JSON.stringify({ error: 'Missing field_name or field_value in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: workspaceMember, error: wmError } = await supabaseClient
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (wmError || !workspaceMember) {
      console.error("[set-user-field] Error fetching workspace for user:", wmError?.message);
      return new Response(JSON.stringify({ error: 'User not associated with a workspace' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const workspaceId = workspaceMember.workspace_id;

    const { data: fieldDefinition, error: fieldDefError } = await supabaseClient
      .from('user_data_fields')
      .select('id, type')
      .eq('workspace_id', workspaceId)
      .eq('name', field_name)
      .limit(1)
      .single();

    if (fieldDefError || !fieldDefinition) {
      console.error("[set-user-field] Error fetching field definition:", fieldDefError?.message);
      return new Response(JSON.stringify({ error: `Field '${field_name}' not found or not defined for this workspace.` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let formattedValue: string;
    switch (fieldDefinition.type) {
      case 'number':
        if (typeof field_value !== 'number' && !/^-?\d+(\.\d+)?$/.test(String(field_value))) {
          return new Response(JSON.stringify({ error: `Invalid value for number field '${field_name}'. Expected a number.` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        formattedValue = String(field_value);
        break;
      case 'boolean':
        if (typeof field_value !== 'boolean' && !['true', 'false'].includes(String(field_value).toLowerCase())) {
          return new Response(JSON.stringify({ error: `Invalid value for boolean field '${field_name}'. Expected 'true' or 'false'.` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        formattedValue = String(field_value).toLowerCase();
        break;
      case 'string':
      default:
        formattedValue = String(field_value);
        break;
    }

    const { error: upsertError } = await supabaseClient
      .from('user_field_values')
      .upsert(
        {
          user_id: user.id,
          field_id: fieldDefinition.id,
          value: formattedValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,field_id' }
      );

    if (upsertError) {
      console.error("[set-user-field] Error upserting field value:", upsertError?.message);
      return new Response(JSON.stringify({ error: 'Error saving field value.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ message: `Field '${field_name}' updated successfully.`, value: formattedValue }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[set-user-field] Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});