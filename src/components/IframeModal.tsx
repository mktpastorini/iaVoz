"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface IframeModalProps {
  url: string;
  onClose: () => void;
}

export const IframeModal: React.FC<IframeModalProps> = ({ url, onClose }) => {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="relative w-11/12 h-5/6 max-w-screen-lg bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{url}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <iframe
          src={url}
          title="Conteúdo Externo"
          className="flex-grow w-full h-full rounded-b-lg"
          style={{ border: 'none' }}
          allowFullScreen
        ></iframe>
      </div>
    </div>
  );
};