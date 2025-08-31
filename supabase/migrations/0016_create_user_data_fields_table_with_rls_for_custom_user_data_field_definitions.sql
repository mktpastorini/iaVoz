-- Create user_data_fields table
CREATE TABLE public.user_data_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'string', -- e.g., 'string', 'number', 'boolean'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_field_name_per_workspace UNIQUE (workspace_id, name)
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.user_data_fields ENABLE ROW LEVEL SECURITY;

-- Policies for user_data_fields
CREATE POLICY "Users can view their workspace's data fields" ON public.user_data_fields
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = user_data_fields.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Users can insert data fields into their workspace" ON public.user_data_fields
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = user_data_fields.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Users can update data fields in their workspace" ON public.user_data_fields
FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = user_data_fields.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Users can delete data fields from their workspace" ON public.user_data_fields
FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.workspace_id = user_data_fields.workspace_id AND wm.user_id = auth.uid()));