
-- 1. Hardcoded superuser id helper
CREATE OR REPLACE FUNCTION public.is_superuser(_user_id uuid)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$ SELECT _user_id = '783e43b7-b112-4aba-bef4-e3f3e224e306'::uuid $$;

-- 2. Approve the superuser profile
UPDATE public.profiles SET approved = true, full_name = 'Superuser'
WHERE id = '783e43b7-b112-4aba-bef4-e3f3e224e306';

-- 3. Replace profiles policies to hide superuser from everyone except themselves
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

CREATE POLICY profiles_self_select ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR is_superuser(auth.uid())
  OR (is_admin(auth.uid()) AND NOT is_superuser(id))
);

CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR is_superuser(auth.uid())
  OR (is_admin(auth.uid()) AND NOT is_superuser(id))
);

-- 4. Replace user_roles policies similarly
DROP POLICY IF EXISTS user_roles_self_read ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_write ON public.user_roles;

CREATE POLICY user_roles_self_read ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_superuser(auth.uid())
  OR (is_admin(auth.uid()) AND NOT is_superuser(user_id))
);

CREATE POLICY user_roles_admin_write ON public.user_roles
FOR ALL TO authenticated
USING (
  is_superuser(auth.uid())
  OR (is_admin(auth.uid()) AND NOT is_superuser(user_id))
)
WITH CHECK (
  is_superuser(auth.uid())
  OR (is_admin(auth.uid()) AND NOT is_superuser(user_id))
);
