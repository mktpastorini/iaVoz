-- Adicionar restrição de unicidade na tabela powers
ALTER TABLE public.powers
ADD CONSTRAINT unique_workspace_name UNIQUE (workspace_id, name);

-- Adicionar restrição de unicidade na tabela user_data_fields
ALTER TABLE public.user_data_fields
ADD CONSTRAINT unique_user_data_field_workspace_name UNIQUE (workspace_id, name);