-- Create user_field_values table
CREATE TABLE public.user_field_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.user_data_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_user_field_value UNIQUE (user_id, field_id)
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.user_field_values ENABLE ROW LEVEL SECURITY;

-- Policies for user_field_values
CREATE POLICY "Users can view their own field values" ON public.user_field_values
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own field values" ON public.user_field_values
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own field values" ON public.user_field_values
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own field values" ON public.user_field_values
FOR DELETE TO authenticated USING (auth.uid() = user_id);