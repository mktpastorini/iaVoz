import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase sem autenticação
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Usar workspace padrão (primeiro workspace criado)
    const { data: defaultWorkspace, error: dwError } = await supabaseClient
      .from('workspaces')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (dwError || !defaultWorkspace) {
      return new Response(JSON.stringify({ error: 'No workspace available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const workspaceId = defaultWorkspace.id;

    const { field_name, field_value } = await req.json();

    if (!field_name || field_value === undefined) {
      return new Response(JSON.stringify({ error: 'Missing field_name or field_value in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: fieldDefinition, error: fieldDefError } = await supabaseClient
      .from('user_data_fields')
      .select('id, type')
      .eq('workspace_id', workspaceId)
      .eq('name', field_name)
      .limit(1)
      .single();

    if (fieldDefError || !fieldDefinition) {
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
          user_id: 'anonymous', // No user id since no auth, or omit user_id if possible
          field_id: fieldDefinition.id,
          value: formattedValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,field_id' }
      );

    if (upsertError) {
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});