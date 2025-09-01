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