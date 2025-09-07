ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS openai_stt_api_key TEXT,
ADD COLUMN IF NOT EXISTS google_stt_api_key TEXT;