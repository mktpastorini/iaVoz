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
import { Mic } from "lucide-react";

interface MicrophonePermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onClose: () => void;
}

export const MicrophonePermissionModal: React.FC<MicrophonePermissionModalProps> = ({ isOpen, onAllow, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Mic className="mr-2 h-5 w-5" />
            Habilitar Microfone
          </DialogTitle>
          <DialogDescription>
            Para que eu possa te ouvir e responder aos seus comandos, preciso de permissão para usar o seu microfone.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Sua privacidade é importante. O microfone só será usado para detectar a palavra de ativação e processar seus comandos de voz.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Agora não
          </Button>
          <Button type="button" onClick={onAllow}>
            Habilitar Microfone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};