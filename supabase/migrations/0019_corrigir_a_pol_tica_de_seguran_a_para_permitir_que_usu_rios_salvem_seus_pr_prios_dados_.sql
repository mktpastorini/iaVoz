-- Remove a política de inserção antiga e incorreta da tabela user_field_values
DROP POLICY "Users can insert their own field values" ON public.user_field_values;

-- Cria uma nova política de inserção correta e segura
CREATE POLICY "Users can insert their own field values" ON public.user_field_values
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);