UPDATE public.powers
SET parameters_schema = '{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "O nome completo do cliente."
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "O endereço de e-mail do cliente."
    },
    "whatsapp": {
      "type": "string",
      "description": "O número de WhatsApp do cliente."
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
      "description": "Detalhes sobre um agendamento solicitado pelo cliente."
    },
    "custom_fields": {
      "type": "object",
      "description": "Campos personalizados adicionais para o cliente, como ''company_name''."
    }
  },
  "required": ["name"]
}'
WHERE name = 'save_client_data';