-- Política para permitir que usuários anônimos insiram clientes
CREATE POLICY "Anonymous users can insert clients" ON public.clients
FOR INSERT TO anon
WITH CHECK (true);

-- Política para permitir que usuários anônimos atualizem clientes
CREATE POLICY "Anonymous users can update clients" ON public.clients
FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- Política para permitir que usuários anônimos consultem clientes
CREATE POLICY "Anonymous users can select clients" ON public.clients
FOR SELECT TO anon
USING (true);

-- Política para permitir que usuários anônimos insiram valores de campos customizados
CREATE POLICY "Anonymous users can insert client field values" ON public.client_field_values
FOR INSERT TO anon
WITH CHECK (true);

-- Política para permitir que usuários anônimos atualizem valores de campos customizados
CREATE POLICY "Anonymous users can update client field values" ON public.client_field_values
FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- Política para permitir que usuários anônimos consultem valores de campos customizados
CREATE POLICY "Anonymous users can select client field values" ON public.client_field_values
FOR SELECT TO anon
USING (true);

-- Política para permitir que usuários anônimos consultem definições de campos de dados
CREATE POLICY "Anonymous users can select user data fields" ON public.user_data_fields
FOR SELECT TO anon
USING (true);

-- Política para permitir que usuários anônimos consultem configurações (necessário para o assistente funcionar)
CREATE POLICY "Anonymous users can select settings" ON public.settings
FOR SELECT TO anon
USING (true);

-- Política para permitir que usuários anônimos consultem poderes (necessário para o assistente funcionar)
CREATE POLICY "Anonymous users can select powers" ON public.powers
FOR SELECT TO anon
USING (true);

-- Política para permitir que usuários anônimos consultem ações do cliente
CREATE POLICY "Anonymous users can select client actions" ON public.client_actions
FOR SELECT TO anon
USING (true);