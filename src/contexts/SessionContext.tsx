"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

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
  loading: boolean; // Overall loading for the session context
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const loadSessionAndUser = async () => {
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error fetching initial session:', error);
        showError('Erro ao carregar sessão inicial.');
      }
      setSession(initialSession);
      setUser(initialSession?.user || null);
      // If there's no initial session, we can consider the load complete for an anonymous user.
      if (!initialSession) {
        setInitialLoadComplete(true);
      }
    };

    loadSessionAndUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user?.id !== lastUserIdRef.current) {
        setUser(currentSession?.user || null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      // Only fetch data for authenticated, non-anonymous users
      if (user && user.id && !user.is_anonymous) {
        if (user.id === lastUserIdRef.current) {
          setInitialLoadComplete(true);
          return;
        }
        lastUserIdRef.current = user.id;

        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
            showError('Erro ao carregar perfil.');
          }
          setProfile(profileData || null);

        } catch (err) {
          console.error('Unexpected error fetching profile:', err);
          showError('Erro inesperado ao carregar perfil.');
          setProfile(null);
        }

        const { data: workspaceData, error: workspaceError } = await supabase.rpc('create_workspace_for_user', {
          p_user_id: user.id,
        });

        if (workspaceError) {
          console.error('Error ensuring workspace:', workspaceError);
          showError('Erro ao garantir workspace.');
        }
        setWorkspace(workspaceData || null);

      } else {
        // Clear data for anonymous or logged-out users
        lastUserIdRef.current = null;
        setProfile(null);
        setWorkspace(null);
      }
      setInitialLoadComplete(true);
    };

    // This check ensures we don't run on the initial undefined state of `user`
    if (user !== undefined) {
      fetchUserData();
    }
  }, [user]);

  const loading = !initialLoadComplete;

  return (
    <SessionContext.Provider value={{ session, user, profile, workspace, loading }}>
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