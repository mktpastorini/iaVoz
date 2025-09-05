"use client";

import { useState, useEffect, useCallback } from 'react';
import { showError } from '@/utils/toast';

export const useMicrophonePermission = (onPermissionGranted: () => void) => {
  const [micPermission, setMicPermission] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

  const checkAndRequestMicPermission = useCallback(async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: "microphone" });
      setMicPermission(permissionStatus.state as 'granted' | 'denied'); // 'prompt' is also possible, but we handle it with the modal
      if (permissionStatus.state === "granted") {
        onPermissionGranted();
      } else {
        setIsPermissionModalOpen(true);
      }
      permissionStatus.onchange = () => setMicPermission(permissionStatus.state as 'granted' | 'denied');
    } catch (error) {
      console.error("Error checking microphone permission:", error);
      setMicPermission("denied");
      showError("Erro ao verificar permissão do microfone.");
    }
  }, [onPermissionGranted]);

  const handleAllowMic = useCallback(async () => {
    setIsPermissionModalOpen(false);
    try {
      // Ensure AudioContext is resumed if suspended
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      onPermissionGranted();
    } catch (error) {
      console.error("Error requesting microphone access:", error);
      setMicPermission("denied");
      setIsPermissionModalOpen(true); // Reopen modal if permission is denied after prompt
      showError("Permissão do microfone negada. Por favor, habilite-a nas configurações do navegador.");
    }
  }, [onPermissionGranted]);

  return {
    micPermission,
    isPermissionModalOpen,
    setIsPermissionModalOpen,
    checkAndRequestMicPermission,
    handleAllowMic,
  };
};