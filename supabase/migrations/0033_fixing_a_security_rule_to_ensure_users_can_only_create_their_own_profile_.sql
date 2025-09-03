-- Drop the existing insecure policy if it exists
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;

-- Create a secure policy for inserting profiles
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);