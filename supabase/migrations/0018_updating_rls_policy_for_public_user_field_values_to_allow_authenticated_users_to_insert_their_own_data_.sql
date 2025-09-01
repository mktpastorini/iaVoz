-- Drop the existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert their own field values" ON public.user_field_values;

-- Create a new INSERT policy that allows authenticated users to insert their own data
CREATE POLICY "Users can insert their own field values" ON public.user_field_values
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);