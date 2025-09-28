"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserData = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setWorkspace(null);
      setRole(null);
      return;
    }

    // Busca os dados em paralelo para otimizar
    const [profileResult, workspaceResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', currentUser.id).single(),
      supabase.rpc('create_workspace_for_user', { p_user_id: currentUser.id })
    ]);

    const { data: profileData, error: profileError } = profileResult;
    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Profile fetch error:", profileError);
    }
    setProfile(profileData);

    const { data: workspaceData, error: workspaceError } = workspaceResult;
    if (workspaceError) {
      showError('Erro ao garantir workspace.');
      setWorkspace(null);
    } else {
      setWorkspace(workspaceData);
      if (workspaceData) {
        const { data: memberData } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('user_id', currentUser.id)
          .eq('workspace_id', workspaceData.id)
          .single();
        setRole(memberData?.role as 'admin' | 'member' || null);
      }
    }
  }, []);

  useEffect(() => {
    const initializeAndListen = async () => {
      // 1. Pega a sessão inicial
      const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Error getting initial session:", sessionError);
        setLoading(false);
        return;
      }

      // 2. Define o estado inicial e busca os dados do usuário
      setSession(initialSession);
      const initialUser = initialSession?.user ?? null;
      setUser(initialUser);
      await fetchUserData(initialUser);
      setLoading(false); // O carregamento inicial está completo

      // 3. Ouve por mudanças futuras na autenticação
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);

        if (_event === 'PASSWORD_RECOVERY') {
          navigate('/update-password', { replace: true });
        } else {
          // Busca os dados novamente sempre que a sessão mudar
          await fetchUserData(currentUser);
        }
      });

      return () => subscription.unsubscribe();
    };

    initializeAndListen();
  }, [navigate, fetchUserData]);

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