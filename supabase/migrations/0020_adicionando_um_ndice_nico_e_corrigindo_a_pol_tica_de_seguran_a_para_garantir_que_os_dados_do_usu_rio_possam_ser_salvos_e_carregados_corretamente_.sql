-- Adiciona a restrição de unicidade necessária para a operação 'upsert' funcionar corretamente.
-- Isso garante que cada usuário só pode ter um valor para cada campo de dados.
ALTER TABLE public.user_field_values
ADD CONSTRAINT user_field_values_user_id_field_id_key UNIQUE (user_id, field_id);

-- Remove a política de inserção antiga e insegura da tabela de perfis.
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;

-- Cria uma nova política segura que permite aos usuários criar seu próprio perfil.
-- Isso corrige o erro que impedia a criação de perfis para novos usuários.
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);