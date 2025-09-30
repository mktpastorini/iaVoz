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

    const { email, workspace_id, role } = await req.json();
    if (!email || !workspace_id || !role) {
      throw new Error("Email, workspace ID, and role are required.");
    }

    // Define a URL de redirecionamento para a página de criação de senha
    const redirectTo = 'https://assistenteia.intrategica.com.br/update-password';

    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: redirectTo } // Adiciona a opção de redirecionamento aqui
    );
    if (inviteError) throw inviteError;

    const { error: memberError } = await supabaseAdmin
      .from('workspace_members')
      .insert({
        user_id: data.user.id,
        workspace_id: workspace_id,
        role: role,
      });
    if (memberError) throw memberError;

    return new Response(JSON.stringify({ message: "User invited successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});