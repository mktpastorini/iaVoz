"use client";

import { useState, useEffect } from 'react';

export const useTypewriter = (text: string, speed: number = 40) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      return;
    }

    // Reseta o texto para começar a nova animação do zero
    setDisplayedText(''); 
    
    const intervalId = setInterval(() => {
      setDisplayedText(currentText => {
        // Se o texto atual já é igual ao texto alvo, paramos o intervalo
        if (currentText.length === text.length) {
          clearInterval(intervalId);
          return currentText;
        }
        // Adiciona o próximo caractere do texto alvo
        return text.substring(0, currentText.length + 1);
      });
    }, speed);

    // Função de limpeza para remover o intervalo quando o componente for desmontado ou o texto mudar
    return () => clearInterval(intervalId);
  }, [text, speed]); // A mágica acontece aqui: este efeito reinicia sempre que o 'text' muda

  return displayedText;
};