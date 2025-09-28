import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionContextProvider } from './contexts/SessionContext';
import { SystemContextProvider } from './contexts/SystemContext';
import { VoiceAssistantProvider } from './contexts/VoiceAssistantContext';
import SophisticatedVoiceAssistant from './components/SophisticatedVoiceAssistant';
import './globals.css';

const queryClient = new QueryClient();

const App = ({ workspaceId }: { workspaceId: string }) => (
  <QueryClientProvider client={queryClient}>
    <SessionContextProvider>
      <SystemContextProvider>
        <VoiceAssistantProvider>
          <SophisticatedVoiceAssistant embedWorkspaceId={workspaceId} />
        </VoiceAssistantProvider>
      </SystemContextProvider>
    </SessionContextProvider>
  </QueryClientProvider>
);

function renderWidget() {
  const widgetDiv = document.getElementById('iam-assistant-widget');
  const scriptTag = document.currentScript;
  
  if (widgetDiv && scriptTag) {
    const workspaceId = scriptTag.getAttribute('data-workspace-id');
    if (workspaceId) {
      const root = createRoot(widgetDiv);
      root.render(
        <React.StrictMode>
          <App workspaceId={workspaceId} />
        </React.StrictMode>
      );
    } else {
      console.error("IAM Assistant: data-workspace-id attribute is missing on the script tag.");
    }
  } else {
    if (!widgetDiv) console.error("IAM Assistant: Could not find the div with id 'iam-assistant-widget'.");
    if (!scriptTag) console.error("IAM Assistant: Could not find the script tag to read configuration.");
  }
}

renderWidget();