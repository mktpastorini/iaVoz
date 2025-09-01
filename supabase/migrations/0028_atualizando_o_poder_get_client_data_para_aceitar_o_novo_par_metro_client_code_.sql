UPDATE public.powers
SET parameters_schema = '{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "O nome do cliente a ser buscado. Use se não tiver o código."
    },
    "client_code": {
      "type": "string",
      "description": "O código único do cliente (ex: CL000001). Dê preferência a este campo para buscas."
    }
  },
  "required": []
}'
WHERE name = 'get_client_data';