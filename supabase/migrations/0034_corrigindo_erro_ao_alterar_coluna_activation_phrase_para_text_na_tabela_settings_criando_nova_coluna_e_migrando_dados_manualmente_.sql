-- 1. Criar nova coluna temporária para armazenar as frases de ativação como array
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS activation_phrases_tmp text[];

-- 2. Migrar dados da coluna antiga activation_phrase para a nova coluna temporária como array
UPDATE public.settings SET activation_phrases_tmp = ARRAY[activation_phrase];

-- 3. Remover a coluna antiga activation_phrase
ALTER TABLE public.settings DROP COLUMN activation_phrase;

-- 4. Renomear a coluna temporária para activation_phrases
ALTER TABLE public.settings RENAME COLUMN activation_phrases_tmp TO activation_phrases;

-- 5. Adicionar a coluna deactivation_phrases com valor padrão
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS deactivation_phrases text[]
DEFAULT ARRAY['fechar', 'encerrar', 'desligar', 'cancelar'];