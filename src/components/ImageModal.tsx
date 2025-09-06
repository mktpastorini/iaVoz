"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ImageModalProps {
  imageUrl: string;
  altText?: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, altText, onClose }) => (
  <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70" onClick={onClose}>
    <div className="relative max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
      <img src={imageUrl} alt={altText || 'Imagem exibida pelo assistente'} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 rounded-full" onClick={onClose}><X /></Button>
    </div>
  </div>
);