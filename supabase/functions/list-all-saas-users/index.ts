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
    // Use o SERVICE_ROLE_KEY para ter acesso total
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Obter todos os usuários do sistema
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) throw usersError;

    const userIds = users.map(u => u.id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Obter todos os perfis correspondentes
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .in('id', userIds);
    if (profilesError) throw profilesError;

    // 3. Obter a associação de workspace e a função de cada usuário
    const { data: members, error: membersError } = await supabaseAdmin
      .from('workspace_members')
      .select('user_id, role, workspace_id')
      .in('user_id', userIds);
    if (membersError) throw membersError;

    // 4. Combinar todas as informações
    const combinedUsers = users.map(user => {
      const profile = profiles?.find(p => p.id === user.id);
      const memberInfo = members?.find(m => m.user_id === user.id);
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        avatar_url: profile?.avatar_url || null,
        role: memberInfo?.role || 'member', // Default to member if not found
        workspace_id: memberInfo?.workspace_id || null,
      };
    });

    return new Response(JSON.stringify(combinedUsers), {
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