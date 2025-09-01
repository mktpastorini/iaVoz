-- 1. Criar a tabela principal de clientes
CREATE TABLE public.clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    whatsapp TEXT,
    city TEXT,
    state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "either_email_or_whatsapp" CHECK (email IS NOT NULL OR whatsapp IS NOT NULL)
);

-- 2. Habilitar Row Level Security (RLS) para a tabela de clientes
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de segurança para a tabela de clientes
CREATE POLICY "Members can manage clients in their own workspace"
ON public.clients
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = clients.workspace_id AND wm.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = clients.workspace_id AND wm.user_id = auth.uid()
    )
);

-- 4. Criar a tabela para armazenar os valores dos campos personalizados dos clientes
CREATE TABLE public.client_field_values (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES public.user_data_fields(id) ON DELETE CASCADE,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "unique_client_field" UNIQUE (client_id, field_id)
);

-- 5. Habilitar RLS para a tabela de valores de campos de clientes
ALTER TABLE public.client_field_values ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas de segurança para a tabela de valores de campos de clientes
CREATE POLICY "Members can manage client field values in their workspace"
ON public.client_field_values
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clients c
        JOIN public.workspace_members wm ON c.workspace_id = wm.workspace_id
        WHERE c.id = client_field_values.client_id AND wm.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clients c
        JOIN public.workspace_members wm ON c.workspace_id = wm.workspace_id
        WHERE c.id = client_field_values.client_id AND wm.user_id = auth.uid()
    )
);