"use client";

import { RefObject } from 'react';

interface ClientActionPayload {
  url?: string;
  imageUrl?: string;
  altText?: string;
}

interface ClientAction {
  action_type: 'OPEN_URL' | 'SHOW_IMAGE' | 'OPEN_IFRAME_URL';
  action_payload: ClientActionPayload;
}

interface ExecuteClientActionParams {
  action: ClientAction;
  setImageToShow: (payload: ClientActionPayload | null) => void;
  setUrlToOpenInIframe: (url: string | null) => void;
  startListening: () => void; // Callback to restart listening after action
}

export const executeClientAction = ({
  action,
  setImageToShow,
  setUrlToOpenInIframe,
  startListening,
}: ExecuteClientActionParams) => {
  console.log("[ClientActionsUtil] Executing action:", action.action_type, action.action_payload);
  switch (action.action_type) {
    case 'OPEN_URL':
      if (action.action_payload.url) {
        window.open(action.action_payload.url, '_blank', 'noopener,noreferrer');
      }
      startListening(); // Restart listening immediately after opening URL
      break;
    case 'SHOW_IMAGE':
      if (action.action_payload.imageUrl) {
        setImageToShow(action.action_payload);
      }
      // Listening will be restarted by ImageModal's onClose
      break;
    case 'OPEN_IFRAME_URL':
      if (action.action_payload.url) {
        setUrlToOpenInIframe(action.action_payload.url);
      }
      // Listening will be restarted by UrlIframeModal's onClose
      break;
    default:
      console.warn(`[ClientActionsUtil] Unknown client action type: ${action.action_type}`);
      startListening(); // Restart listening if action is unknown
      break;
  }
};