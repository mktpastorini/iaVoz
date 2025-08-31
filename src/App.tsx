import { Toaster } from "@/components/ui/toaster";
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
import Login from "./pages/Login";
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

const GlobalVoiceAssistant = () => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("settings").select("*").limit(1).single();
      setSettings(data);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  return (
    <SophisticatedVoiceAssistant
      settings={settings}
      isLoading={loading}
    />
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
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
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              <GlobalVoiceAssistant />
            </VoiceAssistantProvider>
          </SystemContextProvider>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;