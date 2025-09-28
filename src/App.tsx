import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import InstallationPage from "./pages/admin/Installation";
import Login from "./pages/login";
import { SessionContextProvider, useSession } from "./contexts/SessionContext";
import { SystemContextProvider } from "./contexts/SystemContext";
import React from "react";
import SophisticatedVoiceAssistant from "./components/SophisticatedVoiceAssistant";
import { VoiceAssistantProvider } from "./contexts/VoiceAssistantContext";
import SaasUsersPage from "./pages/admin/SaasUsers";
import SaasFinancialPage from "./pages/admin/SaasFinancial";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useSession();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppContent = () => {
  const location = useLocation();
  const { session } = useSession();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <>
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
          <Route path="installation" element={<InstallationPage />} />
          <Route path="saas/users" element={<SaasUsersPage />} />
          <Route path="saas/financial" element={<SaasFinancialPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* O assistente na home agora usará o workspace padrão ou o do admin logado */}
      {!isAdminRoute && <SophisticatedVoiceAssistant />}
    </>
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
              <AppContent />
            </VoiceAssistantProvider>
          </SystemContextProvider>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;