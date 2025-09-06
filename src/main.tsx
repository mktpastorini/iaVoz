import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter } from "react-router-dom";
import { SessionContextProvider } from "./contexts/SessionContext.tsx";
import { SystemContextProvider } from "./contexts/SystemContext.tsx";
import { VoiceAssistantProvider } from "./contexts/VoiceAssistantContext.tsx";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <SystemContextProvider>
            <VoiceAssistantProvider>
              <App />
            </VoiceAssistantProvider>
          </SystemContextProvider>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);