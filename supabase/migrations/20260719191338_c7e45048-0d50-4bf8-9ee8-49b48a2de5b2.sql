DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND (
    public.is_admin(auth.uid())
    OR approved = (SELECT p.approved FROM public.profiles p WHERE p.id = auth.uid())
  )
);