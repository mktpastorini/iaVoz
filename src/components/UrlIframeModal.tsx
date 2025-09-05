"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { X, ExternalLink, AlertCircle } from "lucide-react";
import { cn } from '@/lib/utils';

interface UrlIframeModalProps {
  url: string;
  onClose: () => void;
}

export const UrlIframeModal: React.FC<UrlIframeModalProps> = ({ url, onClose }) => {
  const [iframeFailed, setIframeFailed] = useState(false);

  useEffect(() => {
    // Reseta o estado de falha sempre que a URL mudar
    setIframeFailed(false);
  }, [url]);

  const openInNewTab = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
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
          className={cn("flex-grow w-full h-full", { 'hidden': iframeFailed })}
          style={{ border: 'none' }}
          allowFullScreen
          sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts"
          onError={() => setIframeFailed(true)}
        ></iframe>

        {iframeFailed && (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-900">
            <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Não foi possível carregar o conteúdo</h2>
            <p className="text-muted-foreground mb-6">
              O site <span className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">{url}</span> não permite ser exibido aqui por motivos de segurança.
            </p>
            <Button onClick={openInNewTab}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir em uma nova aba
            </Button>
          </div>
        )}

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