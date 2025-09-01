UPDATE public.powers
SET parameters_schema = '{
  "type": "object",
  "properties": {
    "client_code": {
      "type": "string",
      "description": "O código único do cliente para garantir a atualização correta."
    },
    "name": {
      "type": "string",
      "description": "O nome completo do cliente. Obrigatório para novos clientes."
    },
    "email": { "type": "string" },
    "whatsapp": { "type": "string" },
    "city": { "type": "string" },
    "state": { "type": "string" },
    "agendamento_solicitado": { "type": "string" },
    "custom_fields": { "type": "object" }
  },
  "required": []
}'
WHERE name = 'save_client_data';