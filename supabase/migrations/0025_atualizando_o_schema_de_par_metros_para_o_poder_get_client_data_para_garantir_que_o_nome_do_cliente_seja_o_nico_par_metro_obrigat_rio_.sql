UPDATE public.powers
SET parameters_schema = '{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "O nome completo do cliente a ser buscado."
    }
  },
  "required": ["name"]
}'
WHERE name = 'get_client_data';