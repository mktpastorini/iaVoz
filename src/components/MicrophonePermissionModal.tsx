"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

interface MicrophonePermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onClose: () => void;
  permissionState: 'prompt' | 'denied' | 'checking';
}

export const MicrophonePermissionModal: React.FC<MicrophonePermissionModalProps> = ({ isOpen, onAllow, onClose, permissionState }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {permissionState === 'denied' ? <MicOff className="mr-2 h-5 w-5 text-red-500" /> : <Mic className="mr-2 h-5 w-5" />}
            {permissionState === 'denied' ? 'Microfone Bloqueado' : 'Habilitar Microfone'}
          </DialogTitle>
          <DialogDescription>
            {permissionState === 'prompt'
              ? "Para que eu possa te ouvir e responder aos seus comandos, preciso de permissão para usar o seu microfone."
              : "A permissão para o microfone foi negada. Por favor, habilite-a nas configurações do seu navegador para usar o assistente de voz."}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Sua privacidade é importante. O microfone só será usado para detectar a palavra de ativação e processar seus comandos de voz.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {permissionState === 'prompt' ? 'Agora não' : 'Fechar'}
          </Button>
          {permissionState === 'prompt' && (
            <Button type="button" onClick={onAllow}>
              Habilitar Microfone
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};