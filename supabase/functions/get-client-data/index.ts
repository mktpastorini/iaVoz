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
    const authHeader = req.headers.get('Authorization');
    
    // Criar cliente Supabase - pode ser com ou sem autenticação
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
    );

    let user = null;
    let workspaceId = null;

    // Tentar obter usuário autenticado, mas não falhar se não houver
    if (authHeader) {
      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
      if (!authError && authUser) {
        user = authUser;
        
        // Buscar workspace do usuário autenticado
        const { data: workspaceMember, error: wmError } = await supabaseClient
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (!wmError && workspaceMember) {
          workspaceId = workspaceMember.workspace_id;
        }
      }
    }

    // Se não há usuário autenticado, usar o workspace padrão
    if (!workspaceId) {
      const { data: defaultWorkspace, error: dwError } = await supabaseClient
        .from('workspaces')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (dwError || !defaultWorkspace) {
        return new Response(JSON.stringify({ error: 'No workspace available for anonymous users' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      workspaceId = defaultWorkspace.id;
    }

    const { name, client_code } = await req.json();
    if (!name && !client_code) {
      return new Response(JSON.stringify({ error: 'Client name or code is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    if (findError && findError.code !== 'PGRST116') {
      throw findError;
    }

    if (!client) {
      const identifier = client_code ? `código '${client_code}'` : `nome '${name}'`;
      return new Response(JSON.stringify({ 
        message: `Nenhum cliente encontrado com o ${identifier}.`,
        is_anonymous: !user 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Formatar os campos customizados
    const formattedClient = {
      ...client,
      custom_fields: client.client_field_values.reduce((acc: any, cfv: any) => {
        acc[cfv.user_data_fields.name] = cfv.value;
        return acc;
      }, {}),
      is_anonymous: !user
    };
    delete formattedClient.client_field_values;

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