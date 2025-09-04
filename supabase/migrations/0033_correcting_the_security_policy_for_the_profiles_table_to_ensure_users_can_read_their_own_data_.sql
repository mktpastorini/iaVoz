-- Remove a política antiga para evitar conflitos
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Cria a política correta, garantindo que usuários autenticados possam ler seu próprio perfil
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);