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

    const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Profile fetch error:", profileError);
    }
    setProfile(profileData);

    const { data: workspaceData, error: workspaceError } = await supabase.rpc('create_workspace_for_user', { p_user_id: currentUser.id });
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
    const handleAuthChange = async (_event: string, currentSession: Session | null) => {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);

      if (_event === 'PASSWORD_RECOVERY') {
        navigate('/update-password', { replace: true });
      }
      
      // Busca os dados sempre que a autenticação mudar
      await fetchUserData(currentUser);
    };

    // Configura o listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Busca a sessão inicial e os dados do usuário
    const initializeSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      const initialUser = initialSession?.user ?? null;
      setUser(initialUser);
      await fetchUserData(initialUser);
      setLoading(false); // Marca o fim do carregamento inicial
    };

    initializeSession();

    return () => subscription.unsubscribe();
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