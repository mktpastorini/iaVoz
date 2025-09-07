-- Drop the existing policy to ensure a clean slate
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Recreate the policy to ensure users can read their own profile data
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);