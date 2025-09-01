-- 1. Cria uma sequência para garantir que os números dos códigos sejam únicos e incrementais.
CREATE SEQUENCE IF NOT EXISTS client_code_seq;

-- 2. Cria uma função que pega o próximo número da sequência e o formata como um código (ex: CL000001).
CREATE OR REPLACE FUNCTION generate_client_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'CL' || LPAD(nextval('client_code_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Adiciona a coluna 'client_code' à tabela de clientes, se ela não existir.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_code TEXT;

-- 4. Garante que cada código de cliente seja único por workspace.
ALTER TABLE public.clients ADD CONSTRAINT clients_workspace_id_client_code_key UNIQUE (workspace_id, client_code);

-- 5. Define a função 'generate_client_code' como o valor padrão para a nova coluna.
--    Isso fará com que novos clientes recebam um código automaticamente.
ALTER TABLE public.clients ALTER COLUMN client_code SET DEFAULT generate_client_code();

-- 6. Gera códigos para todos os clientes existentes que ainda não têm um.
UPDATE public.clients
SET client_code = generate_client_code()
WHERE client_code IS NULL;