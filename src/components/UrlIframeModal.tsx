"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";

interface UrlIframeModalProps {
  url: string;
  onClose: () => void;
}

export const UrlIframeModal: React.FC<UrlIframeModalProps> = ({ url, onClose }) => {
  const openInNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="relative w-full h-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{url}</h3>
          <Button variant="destructive" size="icon" className="rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <iframe
          src={url}
          title="Conteúdo Externo"
          className="flex-grow w-full h-full"
          style={{ border: 'none' }}
          allowFullScreen
          // Removido 'allow-same-origin' para evitar conflitos com conteúdo cross-origin
          sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts"
        ></iframe>
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
          <span>Alguns sites podem não carregar devido a restrições de segurança.</span>
          <Button variant="outline" size="sm" onClick={openInNewTab}>
            Abrir em nova aba
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};