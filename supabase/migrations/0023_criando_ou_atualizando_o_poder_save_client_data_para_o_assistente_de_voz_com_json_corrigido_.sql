-- Inserir ou atualizar o poder 'save_client_data'
INSERT INTO public.powers (
    workspace_id,
    name,
    description,
    method,
    url,
    headers,
    body,
    parameters_schema
) VALUES (
    (SELECT id FROM public.workspaces LIMIT 1), -- Assume que há pelo menos um workspace
    'save_client_data',
    'Salva ou atualiza os dados de um cliente, incluindo nome, email, whatsapp, cidade, estado e campos personalizados como nome da empresa. Use esta função quando o usuário fornecer informações de contato ou detalhes sobre si mesmo ou um cliente.',
    'POST',
    'https://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/save-client-data',
    '{"Content-Type": "application/json"}',
    '{}',
    $$
    {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "O nome completo do cliente. É obrigatório."
        },
        "email": {
          "type": "string",
          "format": "email",
          "description": "O endereço de e-mail do cliente."
        },
        "whatsapp": {
          "type": "string",
          "description": "O número de WhatsApp do cliente, incluindo o código do país e DDD."
        },
        "city": {
          "type": "string",
          "description": "A cidade onde o cliente reside."
        },
        "state": {
          "type": "string",
          "description": "O estado onde o cliente reside."
        },
        "agendamento_solicitado": {
          "type": "string",
          "description": "Detalhes sobre um agendamento solicitado pelo cliente, como data, hora e serviço."
        },
        "custom_fields": {
          "type": "object",
          "description": "Um objeto contendo campos personalizados adicionais para o cliente, onde as chaves são os nomes dos campos e os valores são os dados. Ex: {\"company_name\": \"Minha Empresa\"}",
          "additionalProperties": {
            "type": "string"
          }
        }
      },
      "required": ["name"]
    }
    $$
)
ON CONFLICT (workspace_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    method = EXCLUDED.method,
    url = EXCLUDED.url,
    headers = EXCLUDED.headers,
    body = EXCLUDED.body,
    parameters_schema = EXCLUDED.parameters_schema,
    api_key_id = EXCLUDED.api_key_id;