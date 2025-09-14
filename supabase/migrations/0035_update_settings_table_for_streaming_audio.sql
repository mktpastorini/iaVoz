-- Add new columns for streaming audio configuration to the settings table
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS input_mode TEXT DEFAULT 'local' NOT NULL,
ADD COLUMN IF NOT EXISTS output_mode TEXT DEFAULT 'buffered' NOT NULL,
ADD COLUMN IF NOT EXISTS streaming_stt_provider TEXT DEFAULT 'deepgram' NOT NULL,
ADD COLUMN IF NOT EXISTS deepgram_api_key TEXT,
ADD COLUMN IF NOT EXISTS openai_stt_api_key TEXT,
ADD COLUMN IF NOT EXISTS google_stt_api_key TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.settings.input_mode IS 'The mode for speech-to-text input (e.g., local, streaming).';
COMMENT ON COLUMN public.settings.output_mode IS 'The mode for text-to-speech output (e.g., buffered, streaming).';
COMMENT ON COLUMN public.settings.streaming_stt_provider IS 'The provider for streaming STT (e.g., deepgram, openai, google).';
COMMENT ON COLUMN public.settings.deepgram_api_key IS 'API key for Deepgram STT service.';
COMMENT ON COLUMN public.settings.openai_stt_api_key IS 'API key for OpenAI STT service (e.g., Whisper).';
COMMENT ON COLUMN public.settings.google_stt_api_key IS 'API key for Google STT service.';