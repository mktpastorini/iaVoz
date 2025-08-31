-- 1. Adicionar a coluna 'continuation_phrase' se ela ainda não existir
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS continuation_phrase TEXT DEFAULT 'Pode falar.';

-- 2. Remover a política de UPDATE existente para a tabela settings
DROP POLICY IF EXISTS "settings_update_policy" ON public.settings;

-- 3. Recriar a política de UPDATE com a mesma lógica de segurança
CREATE POLICY "settings_update_policy" ON public.settings
FOR UPDATE TO authenticated
USING (EXISTS ( SELECT 1 FROM public.workspace_members wm WHERE ((wm.workspace_id = settings.workspace_id) AND (wm.user_id = auth.uid()))));