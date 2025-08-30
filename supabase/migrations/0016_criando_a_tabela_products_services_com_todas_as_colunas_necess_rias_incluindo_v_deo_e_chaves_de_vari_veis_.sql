-- Create products_services table with all necessary columns
CREATE TABLE public.products_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  item_key TEXT,
  description TEXT,
  page_url TEXT,
  image_url TEXT,
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_item_key_per_workspace UNIQUE (workspace_id, item_key)
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.products_services ENABLE ROW LEVEL SECURITY;

-- Create secure policies for each operation
CREATE POLICY "Users can view products and services in their workspaces" ON public.products_services
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = products_services.workspace_id AND wm.user_id = auth.uid()
));

CREATE POLICY "Users can insert products and services in their workspaces" ON public.products_services
FOR INSERT TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = products_services.workspace_id AND wm.user_id = auth.uid()
));

CREATE POLICY "Users can update products and services in their workspaces" ON public.products_services
FOR UPDATE TO authenticated USING (EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = products_services.workspace_id AND wm.user_id = auth.uid()
));

CREATE POLICY "Users can delete products and services in their workspaces" ON public.products_services
FOR DELETE TO authenticated USING (EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = products_services.workspace_id AND wm.user_id = auth.uid()
));