-- supabase/migrations/0027_reconfigurando_o_poder_save_client_data_com_json_correto_v2.sql

-- Esta migração garante que o poder 'save_client_data' esteja corretamente configurado para todos os workspaces.
-- Ela corrige qualquer formatação JSON inválida que possa ter sido salva através da interface de administração.

DO $$
DECLARE
    workspace_rec RECORD;
BEGIN
    -- Itera sobre todos os workspaces existentes
    FOR workspace_rec IN SELECT id FROM public.workspaces
    LOOP
        -- Insere ou atualiza o poder 'save_client_data' com a configuração correta
        INSERT INTO public.powers (
            workspace_id,
            name,
            description,
            method,
            url,
            headers,
            body,
            parameters_schema
        )
        VALUES (
            workspace_rec.id,
            'save_client_data',
            'Salva ou atualiza os dados de um cliente, como nome, e-mail e nome da empresa. Use esta função para registrar novos clientes ou atualizar informações de clientes existentes.',
            'POST',
            'https://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/save-client-data',
            '{"Content-Type": "application/json"}',
            '{
              "name": "{name}",
              "email": "{email}",
              "custom_fields": {
                "company_name": "{company_name}"
              }
            }',
            '{
              "type": "object",
              "properties": {
                "name": {
                  "type": "string",
                  "description": "O nome completo do cliente a ser salvo ou atualizado."
                },
                "email": {
                  "type": "string",
                  "description": "O endereço de e-mail do cliente."
                },
                "company_name": {
                  "type": "string",
                  "description": "O nome da empresa onde o cliente trabalha."
                }
              },
              "required": ["name"]
            }'
        )
        ON CONFLICT (workspace_id, name)
        DO UPDATE SET
            description = EXCLUDED.description,
            method = EXCLUDED.method,
            url = EXCLUDED.url,
            headers = EXCLUDED.headers,
            body = EXCLUDED.body,
            parameters_schema = EXCLUDED.parameters_schema;
    END LOOP;
END $$;