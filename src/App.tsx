import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLayout from "./layouts/AdminLayout";
import SettingsPage from "./pages/admin/Settings";
import PowersPage from "./pages/admin/Powers";
import ConversationsPage from "./pages/admin/Conversations";
import SystemPowersPage from "./pages/admin/SystemPowers";
import ClientActionsPage from "./pages/admin/ClientActions";
import UserDataFieldsPage from "./pages/admin/UserDataFields";
import ClientsPage from "./pages/admin/Clients";
import Login from "./pages/login";
import { SessionContextProvider, useSession } from "./contexts/SessionContext";
import { SystemContextProvider } from "./contexts/SystemContext";
import React, { useEffect, useState } from "react";
import SophisticatedVoiceAssistant from "./components/SophisticatedVoiceAssistant";
import { supabase } from "./integrations/supabase/client";
import { VoiceAssistantProvider } from "./contexts/VoiceAssistantContext";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useSession();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// This new wrapper component will manage loading the settings and ensure the assistant only mounts when ready.
const GlobalVoiceAssistantWrapper = () => {
  const { session, loading: sessionLoading } = useSession();
  const [settings, setSettings] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return; // Wait for the session to be resolved first

    const fetchSettings = async () => {
      setSettingsLoading(true);
      try {
        let settingsData = null;
        if (session) {
          const { data: workspaceMember } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', session.user.id)
            .limit(1)
            .single();
          
          if (workspaceMember) {
            const { data } = await supabase
              .from("settings")
              .select("*")
              .eq('workspace_id', workspaceMember.workspace_id)
              .limit(1)
              .single();
            settingsData = data;
          }
        }
        
        if (!settingsData) {
          const { data } = await supabase
            .from("settings")
            .select("*")
            .order('created_at', { ascending: true })
            .limit(1)
            .single();
          settingsData = data;
        }
        
        setSettings(settingsData);
      } catch (error) {
        console.error("Erro ao carregar configurações do assistente:", error);
      } finally {
        setSettingsLoading(false);
      }
    };
    
    fetchSettings();
  }, [session, sessionLoading]);

  // The key fix: Do not render the complex assistant component until all loading is complete.
  if (sessionLoading || settingsLoading) {
    return null;
  }

  return (
    <SophisticatedVoiceAssistant
      settings={settings}
      isLoading={settingsLoading}
    />
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <SystemContextProvider>
            <VoiceAssistantProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route
                  path="/admin"
                  element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}
                >
                  <Route index element={<Navigate to="/admin/settings" replace />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="powers" element={<PowersPage />} />
                  <Route path="conversations" element={<ConversationsPage />} />
                  <Route path="system-powers" element={<SystemPowersPage />} />
                  <Route path="client-actions" element={<ClientActionsPage />} />
                  <Route path="user-data-fields" element={<UserDataFieldsPage />} />
                  <Route path="clients" element={<ClientsPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              <GlobalVoiceAssistantWrapper />
            </VoiceAssistantProvider>
          </SystemContextProvider>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;