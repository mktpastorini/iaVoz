-- Create client_actions table
CREATE TABLE public.client_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  trigger_phrase TEXT NOT NULL,
  action_type TEXT NOT NULL, -- e.g., 'OPEN_URL', 'SHOW_IMAGE'
  action_payload JSONB NOT NULL, -- e.g., {"url": "https://..."}, {"imageUrl": "...", "altText": "..."}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.client_actions ENABLE ROW LEVEL SECURITY;

-- Create secure policies for each operation
CREATE POLICY "Users can view their own client actions" ON public.client_actions
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = client_actions.workspace_id AND wm.user_id = auth.uid()
));

CREATE POLICY "Users can insert client actions in their workspaces" ON public.client_actions
FOR INSERT TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = client_actions.workspace_id AND wm.user_id = auth.uid()
));

CREATE POLICY "Users can update their own client actions" ON public.client_actions
FOR UPDATE TO authenticated USING (EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = client_actions.workspace_id AND wm.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own client actions" ON public.client_actions
FOR DELETE TO authenticated USING (EXISTS (
  SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = client_actions.workspace_id AND wm.user_id = auth.uid()
));