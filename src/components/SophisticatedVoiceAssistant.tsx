// ... (todo o código igual até a função initializeAssistant)

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

      let debounceRestart = false;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        debounceRestart = false;
        console.log('[VA] Reconhecimento de voz iniciado.');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
        console.log('[VA] Reconhecimento de voz finalizado.');
        // Reinicia imediatamente, mas evita loop rápido
        if (!isSpeakingRef.current && !stopPermanentlyRef.current && !debounceRestart) {
          debounceRestart = true;
          setTimeout(() => {
            if (!isSpeakingRef.current && !stopPermanentlyRef.current) {
              try {
                recognitionRef.current?.start();
                debounceRestart = false;
                console.log('[VA] Reconhecimento reiniciado imediatamente após onend.');
              } catch (e) {
                console.error('[VA] Erro ao reiniciar reconhecimento:', e);
                debounceRestart = false;
              }
            }
          }, 100); // Pequeno debounce para evitar loop rápido
        }
      };

      recognitionRef.current.onerror = (e) => {
        setIsListening(false);
        isListeningRef.current = false;
        console.log(`[VA] Erro no reconhecimento de voz: ${e.error}`);
        // Reinicia imediatamente em caso de erro esperado
        if ((e.error === 'no-speech' || e.error === 'audio-capture') && !isSpeakingRef.current && !stopPermanentlyRef.current && !debounceRestart) {
          debounceRestart = true;
          setTimeout(() => {
            if (!isSpeakingRef.current && !stopPermanentlyRef.current) {
              try {
                recognitionRef.current?.start();
                debounceRestart = false;
                console.log('[VA] Reconhecimento reiniciado após erro.');
              } catch (err) {
                console.error('[VA] Erro ao reiniciar reconhecimento após erro:', err);
                debounceRestart = false;
              }
            }
          }, 100);
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
    }
    isInitializingRef.current = false;
    setTimeout(() => startListening(), 1000);
  }, [handleTranscription, startListening]);

// ... (restante do código igual)