"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface Workspace {
  id: string;
  name: string;
  plan: string;
  created_by: string;
}

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  workspace: Workspace | null;
  role: 'admin' | 'member' | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [role, setRole] = useState<'admin' | 'member' | null>(null);
  const [loading, setLoading] = useState(true); // Inicia como true
  const navigate = useNavigate();

  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Pega a sessão inicial para saber o estado de carregamento
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false); // O carregamento inicial está completo
    });

    // 2. Ouve por mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        navigate('/update-password', { replace: true });
      }
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    // 3. Busca os dados do usuário APENAS quando a sessão for válida
    const fetchUserData = async () => {
      if (session?.user) {
        // Evita buscas repetidas para o mesmo usuário
        if (session.user.id === lastUserIdRef.current) return;
        lastUserIdRef.current = session.user.id;

        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setProfile(profileData);

        const { data: workspaceData, error: workspaceError } = await supabase.rpc('create_workspace_for_user', { p_user_id: session.user.id });
        if (workspaceError) {
          showError('Erro ao garantir workspace.');
          setWorkspace(null);
        } else {
          setWorkspace(workspaceData);
          if (workspaceData) {
            const { data: memberData } = await supabase
              .from('workspace_members')
              .select('role')
              .eq('user_id', session.user.id)
              .eq('workspace_id', workspaceData.id)
              .single();
            setRole(memberData?.role as 'admin' | 'member' || null);
          }
        }
      } else {
        // Limpa os dados se não houver sessão
        lastUserIdRef.current = null;
        setProfile(null);
        setWorkspace(null);
        setRole(null);
      }
    };

    // Não executa a busca se ainda estiver no carregamento inicial
    if (!loading) {
      fetchUserData();
    }
  }, [session, loading]); // Depende da sessão e do estado de carregamento

  return (
    <SessionContext.Provider value={{ session, user, profile, workspace, role, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};