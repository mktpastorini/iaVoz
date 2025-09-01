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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { name, client_code } = await req.json();
    if (!name && !client_code) {
      return new Response(JSON.stringify({ error: 'Client name or code is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: workspaceMember, error: wmError } = await supabaseClient
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (wmError || !workspaceMember) {
      return new Response(JSON.stringify({ error: 'User not in a workspace' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const workspaceId = workspaceMember.workspace_id;

    let query = supabaseClient
      .from('clients')
      .select('*, client_field_values(value, user_data_fields(name))')
      .eq('workspace_id', workspaceId);

    if (client_code) {
      query = query.eq('client_code', client_code);
    } else if (name) {
      query = query.ilike('name', `%${name}%`);
    }

    const { data: client, error: findError } = await query.limit(1).single();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw findError;
    }

    if (!client) {
      const identifier = client_code ? `código '${client_code}'` : `nome '${name}'`;
      return new Response(JSON.stringify({ message: `Nenhum cliente encontrado com o ${identifier}.` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Formata os campos customizados para um objeto simples
    const formattedClient = {
      ...client,
      custom_fields: client.client_field_values.reduce((acc: any, cfv: any) => {
        acc[cfv.user_data_fields.name] = cfv.value;
        return acc;
      }, {}),
    };
    delete formattedClient.client_field_values; // Limpa o array original

    return new Response(JSON.stringify(formattedClient), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});