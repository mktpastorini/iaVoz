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

    const { client_code, name, email, whatsapp, city, state, custom_fields, agendamento_solicitado } = await req.json();
    if (!name && !client_code) {
      return new Response(JSON.stringify({ error: 'Client name or code is required to save data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    let existingClientQuery = supabaseClient
      .from('clients')
      .select('id, client_code, agendamento_solicitado')
      .eq('workspace_id', workspaceId);

    if (client_code) {
      existingClientQuery = existingClientQuery.eq('client_code', client_code);
    } else if (name) {
      existingClientQuery = existingClientQuery.eq('name', name);
    }

    let { data: existingClient } = await existingClientQuery.limit(1).single();

    let savedClient;
    const clientData = {
      workspace_id: workspaceId,
      name: name || existingClient?.name,
      email: email,
      whatsapp: whatsapp,
      city: city,
      state: state,
      agendamento_solicitado: agendamento_solicitado,
      updated_at: new Date().toISOString(),
    };

    if (existingClient) {
      const { data, error } = await supabaseClient.from('clients').update(clientData).eq('id', existingClient.id).select('id, client_code').single();
      if (error) throw error;
      savedClient = data;
    } else {
      // Novo cliente: Adiciona lógica de re-tentativa para garantir código único
      const MAX_RETRIES = 3;
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          // O client_code será gerado automaticamente pela função DEFAULT do banco de dados
          const { data, error } = await supabaseClient.from('clients').insert(clientData).select('id, client_code').single();
          if (error) {
            // Se o erro for de violação de unicidade (código 23505), tenta novamente
            if (error.code === '23505' && error.message.includes('clients_workspace_id_client_code_key')) {
              console.warn(`[save-client-data] Código de cliente duplicado gerado, re-tentando... Tentativa ${i + 1}`);
              continue; // Tenta novamente com um novo código gerado pelo DB
            }
            throw error; // Outro tipo de erro, re-lança
          }
          savedClient = data;
          break; // Sucesso, sai do loop
        } catch (e) {
          if (i === MAX_RETRIES - 1) {
            throw e; // Re-lança o erro se todas as re-tentativas falharem
          }
          // Para outros erros ou se for uma duplicata e não a última re-tentativa, continua
        }
      }
      if (!savedClient) {
        throw new Error('Falha ao criar cliente após múltiplas re-tentativas devido a código de cliente duplicado.');
      }
    }

    if (custom_fields && typeof custom_fields === 'object' && Object.keys(custom_fields).length > 0) {
      const { data: fieldDefs, error: fieldDefError } = await supabaseClient
        .from('user_data_fields')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .in('name', Object.keys(custom_fields));

      if (fieldDefError) throw fieldDefError;

      const valuesToUpsert = fieldDefs.map(def => ({
        client_id: savedClient.id,
        field_id: def.id,
        value: String(custom_fields[def.name]),
        updated_at: new Date().toISOString(),
      }));

      if (valuesToUpsert.length > 0) {
        const { error: upsertError } = await supabaseClient.from('client_field_values').upsert(valuesToUpsert, { onConflict: 'client_id,field_id' });
        if (upsertError) throw upsertError;
      }
    }

    return new Response(JSON.stringify({ message: `Client '${clientData.name}' saved successfully.`, client_code: savedClient.client_code }), {
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