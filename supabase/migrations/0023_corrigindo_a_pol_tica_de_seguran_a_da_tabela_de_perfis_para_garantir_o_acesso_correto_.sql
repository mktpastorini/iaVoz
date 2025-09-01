-- Remove a política de seleção antiga e potencialmente problemática
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Cria uma nova política de segurança que permite que usuários autenticados leiam SEU PRÓPRIO perfil.
-- Isso é seguro e resolve o erro 406.
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);