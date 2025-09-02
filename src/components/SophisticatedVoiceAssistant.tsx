[...código anterior até a função speak...]

  const speak = useCallback(async (text: string, onEndCallback?: () => void) => {
    const currentSettings = settingsRef.current;
    if (!text || !currentSettings) {
      onEndCallback?.();
      return;
    }
    console.log(`[VA] Preparando para falar: "${text}"`);
    stopListening();
    stopSpeaking();
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setAiResponse(text);

    // Flag para evitar reinício duplo
    let alreadyRestarted = false;

    const onSpeechEnd = () => {
      console.log('[VA] Finalizou a fala.');
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      onEndCallback?.();
      // Só reinicia a escuta se o assistente estiver aberto e não estiver ouvindo
      if (isOpenRef.current && !stopPermanentlyRef.current && !isListeningRef.current && !alreadyRestarted) {
        alreadyRestarted = true;
        console.log('[VA] Reiniciando escuta após fala (garantido único).');
        setTimeout(() => {
          if (!isListeningRef.current) startListening();
        }, 500);
      }
    };

    try {
      if (currentSettings.voice_model === "browser" && synthRef.current) {
        console.log('[VA] Usando o modelo de voz do navegador.');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.onend = onSpeechEnd;
        utterance.onerror = onSpeechEnd;
        synthRef.current.speak(utterance);
      } else if (currentSettings.voice_model === "openai-tts" && currentSettings.openai_api_key) {
        console.log('[VA] Usando o modelo de voz OpenAI TTS.');
        try {
          const response = await fetch(OPENAI_TTS_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSettings.openai_api_key}` },
            body: JSON.stringify({ model: "tts-1", voice: currentSettings.openai_tts_voice || "alloy", input: text }),
          });
          if (!response.ok) throw new Error("Falha na API OpenAI TTS");
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          audioRef.current = new Audio(audioUrl);
          audioRef.current.onended = () => { onSpeechEnd(); URL.revokeObjectURL(audioUrl); };
          audioRef.current.onerror = (error) => { 
            console.error('[VA] Erro ao reproduzir áudio OpenAI TTS, usando fallback:', error);
            URL.revokeObjectURL(audioUrl);
            if (synthRef.current) {
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.lang = "pt-BR";
              utterance.onend = onSpeechEnd;
              utterance.onerror = onSpeechEnd;
              synthRef.current.speak(utterance);
            } else {
              onSpeechEnd();
            }
          };
          await audioRef.current.play();
        } catch (error) {
          console.error('[VA] Erro com OpenAI TTS, usando fallback:', error);
          if (synthRef.current) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "pt-BR";
            utterance.onend = onSpeechEnd;
            utterance.onerror = onSpeechEnd;
            synthRef.current.speak(utterance);
          } else {
            onSpeechEnd();
          }
        }
      } else {
        console.warn('[VA] Nenhum modelo de voz válido configurado. Pulando a fala.');
        onSpeechEnd();
      }
    } catch (error) {
      console.error("[VA] Erro durante a fala:", error);
      onSpeechEnd();
    }
  }, [stopSpeaking, stopListening, startListening]);

[...código anterior até a função initializeAssistant...]

  const initializeAssistant = useCallback(() => {
    if (isInitializingRef.current) {
      console.log('[VA] Já está inicializando, ignorando.');
      return;
    }
    
    isInitializingRef.current = true;
    console.log('[VA] Inicializando assistente...');
    
    const webSpeechSupported = hasWebSpeechSupport();
    const hasOpenAIKey = settingsRef.current?.openai_api_key;
    
    if (webSpeechSupported) {
      setUseWebSpeech(true);
      setShowBrowserWarning(false);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onstart = () => {
        console.log('[VA] Reconhecimento de voz iniciado.');
        setIsListening(true);
        isListeningRef.current = true;
      };
      
      recognitionRef.current.onend = () => {
        console.log('[VA] Reconhecimento de voz finalizado.');
        setIsListening(false);
        isListeningRef.current = false;
        // Só reinicia se não estiver falando e não estiver ouvindo
        if (!isSpeakingRef.current && !stopPermanentlyRef.current && !isListeningRef.current) {
          console.log('[VA] Reiniciando escuta após onend (único).');
          setTimeout(() => {
            if (!isListeningRef.current) startListening();
          }, 1000);
        }
      };
      
      recognitionRef.current.onerror = (e) => {
        console.log(`[VA] Erro no reconhecimento de voz: ${e.error}`);
        setIsListening(false);
        isListeningRef.current = false;
        if ((e.error === 'no-speech' || e.error === 'audio-capture') && !isSpeakingRef.current && !stopPermanentlyRef.current && !isListeningRef.current) {
          console.log('[VA] Reiniciando escuta após erro esperado (único).');
          setTimeout(() => {
            if (!isListeningRef.current) startListening();
          }, 1500);
        }
      };
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log(`[VA] Transcrição Web Speech: "${transcript}"`);
        handleTranscription(transcript);
      };
    } else if (hasOpenAIKey) {
      setUseWebSpeech(false);
      setShowBrowserWarning(true);
    } else {
      showError("Reconhecimento de voz não suportado neste navegador e chave OpenAI não configurada.");
      isInitializingRef.current = false;
      return;
    }

    if ("speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      console.log('[VA] Síntese de voz inicializada.');
    }
    isInitializingRef.current = false;
    setTimeout(() => startListening(), 1000);
  }, [handleTranscription, startListening]);

[...restante do código igual...]