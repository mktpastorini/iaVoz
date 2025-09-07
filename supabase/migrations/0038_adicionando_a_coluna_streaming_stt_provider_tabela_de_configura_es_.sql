-- Adiciona a coluna para selecionar o provedor de STT (Speech-to-Text) em tempo real
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS streaming_stt_provider TEXT DEFAULT 'deepgram';

-- Adiciona um comentário para descrever a nova coluna
COMMENT ON COLUMN public.settings.streaming_stt_provider IS 'Especifica o provedor de Speech-to-Text a ser usado no modo streaming (ex: deepgram, openai, google).';