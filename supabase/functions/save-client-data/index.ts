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

    const { name, email, whatsapp, city, state, custom_fields } = await req.json();
    if (!name) {
      return new Response(JSON.stringify({ error: 'Client name is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

    // Tenta encontrar um cliente existente pelo nome
    let { data: existingClient, error: findError } = await supabaseClient
      .from('clients')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('name', name)
      .limit(1)
      .single();

    let clientId;
    const clientData = {
      workspace_id: workspaceId,
      name,
      email: email || existingClient?.email,
      whatsapp: whatsapp || existingClient?.whatsapp,
      city: city || existingClient?.city,
      state: state || existingClient?.state,
      updated_at: new Date().toISOString(),
    };

    if (existingClient) {
      // Atualiza cliente existente
      const { data, error } = await supabaseClient.from('clients').update(clientData).eq('id', existingClient.id).select('id').single();
      if (error) throw error;
      clientId = data.id;
    } else {
      // Cria novo cliente
      const { data, error } = await supabaseClient.from('clients').insert(clientData).select('id').single();
      if (error) throw error;
      clientId = data.id;
    }

    // Processa campos customizados
    if (custom_fields && typeof custom_fields === 'object' && Object.keys(custom_fields).length > 0) {
      const { data: fieldDefs, error: fieldDefError } = await supabaseClient
        .from('user_data_fields')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .in('name', Object.keys(custom_fields));

      if (fieldDefError) throw fieldDefError;

      const valuesToUpsert = fieldDefs.map(def => ({
        client_id: clientId,
        field_id: def.id,
        value: String(custom_fields[def.name]),
        updated_at: new Date().toISOString(),
      }));

      if (valuesToUpsert.length > 0) {
        const { error: upsertError } = await supabaseClient.from('client_field_values').upsert(valuesToUpsert, { onConflict: 'client_id,field_id' });
        if (upsertError) throw upsertError;
      }
    }

    return new Response(JSON.stringify({ message: `Client '${name}' saved successfully.`, clientId }), {
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