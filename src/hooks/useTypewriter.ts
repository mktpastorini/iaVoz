"use client";

import { useState, useEffect, useRef } from 'react';

export const useTypewriter = (text: string, speed: number = 40) => {
  const [displayedText, setDisplayedText] = useState('');
  const index = useRef(0);

  useEffect(() => {
    // Reseta o estado quando um novo texto é recebido
    setDisplayedText('');
    index.current = 0;

    if (text) {
      const intervalId = setInterval(() => {
        if (index.current < text.length) {
          // Usa o método slice para construir a string de forma mais confiável
          setDisplayedText(text.slice(0, index.current + 1));
          index.current++;
        } else {
          clearInterval(intervalId);
        }
      }, speed);
      // Limpa o intervalo se o componente for desmontado ou o texto mudar
      return () => clearInterval(intervalId);
    }
  }, [text, speed]);

  return displayedText;
};