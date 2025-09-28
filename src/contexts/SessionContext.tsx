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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const navigate = useNavigate();

  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      // Prioridade máxima: se for um evento de recuperação/convite, força o redirecionamento.
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/update-password', { replace: true });
        // Define a sessão para que a página de senha não reclame, mas não continua o fluxo normal.
        setSession(currentSession);
        return;
      }

      setSession(currentSession);
      if (currentSession?.user?.id !== lastUserIdRef.current) {
        setUser(currentSession?.user || null);
      }

      if (event === 'SIGNED_IN' && currentSession?.provider_token) {
        const { error: upsertError } = await supabase
          .from('user_google_tokens')
          .upsert({
            user_id: currentSession.user.id,
            access_token: currentSession.provider_token,
            refresh_token: currentSession.provider_refresh_token,
            expires_at: new Date(currentSession.expires_at! * 1000).toISOString(),
          });

        if (upsertError) {
          console.error("Error saving Google tokens:", upsertError);
          showError("Não foi possível salvar a conexão com o Google.");
        }
      }
    });

    // Verifica a sessão inicial para lidar com o primeiro carregamento da página
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user || null);
      setInitialLoadComplete(true); // Marca que o carregamento inicial terminou
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user && user.id) {
        if (user.id === lastUserIdRef.current) return;
        lastUserIdRef.current = user.id;

        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(profileData);

        const { data: workspaceData, error: workspaceError } = await supabase.rpc('create_workspace_for_user', { p_user_id: user.id });
        if (workspaceError) {
          showError('Erro ao garantir workspace.');
          setWorkspace(null);
        } else {
          setWorkspace(workspaceData);
          if (workspaceData) {
            const { data: memberData, error: memberError } = await supabase
              .from('workspace_members')
              .select('role')
              .eq('user_id', user.id)
              .eq('workspace_id', workspaceData.id)
              .single();
            
            if (memberError) {
              showError('Erro ao buscar a função do usuário.');
              setRole(null);
            } else {
              setRole(memberData.role as 'admin' | 'member');
            }
          }
        }
      } else {
        lastUserIdRef.current = null;
        setProfile(null);
        setWorkspace(null);
        setRole(null);
      }
    };

    if (initialLoadComplete) {
      fetchUserData();
    }
  }, [user, initialLoadComplete]);

  const loading = !initialLoadComplete;

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