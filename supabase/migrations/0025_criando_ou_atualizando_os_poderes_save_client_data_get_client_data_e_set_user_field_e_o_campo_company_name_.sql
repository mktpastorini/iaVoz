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

-- Inserir ou atualizar o poder 'get_client_data'
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
    (SELECT id FROM public.workspaces LIMIT 1),
    'get_client_data',
    'Obtém os dados de um cliente existente pelo nome. Retorna informações como email, whatsapp, cidade, estado e campos personalizados.',
    'POST',
    'https://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/get-client-data',
    '{"Content-Type": "application/json"}',
    '{}',
    $$
    {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "O nome completo do cliente a ser buscado. É obrigatório."
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

-- Inserir ou atualizar o poder 'set_user_field'
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
    (SELECT id FROM public.workspaces LIMIT 1),
    'set_user_field',
    'Define o valor de um campo de dados personalizado para o usuário atual. Use para salvar informações específicas do usuário, como nome da empresa, preferências, etc.',
    'POST',
    'https://mcnegecxqstyqlbcrhxp.supabase.co/functions/v1/set-user-field',
    '{"Content-Type": "application/json"}',
    '{}',
    $$
    {
      "type": "object",
      "properties": {
        "field_name": {
          "type": "string",
          "description": "O nome do campo de dados do usuário a ser definido (ex: company_name)."
        },
        "field_value": {
          "type": "string",
          "description": "O valor a ser atribuído ao campo."
        }
      },
      "required": ["field_name", "field_value"]
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

-- Inserir ou atualizar o campo de dados do usuário 'company_name'
INSERT INTO public.user_data_fields (
    workspace_id,
    name,
    description,
    type
) VALUES (
    (SELECT id FROM public.workspaces LIMIT 1), -- Assume que há pelo menos um workspace
    'company_name',
    'O nome da empresa do cliente.',
    'string'
)
ON CONFLICT (workspace_id, name) DO UPDATE SET
    description = EXCLUDED.description,
    type = EXCLUDED.type;