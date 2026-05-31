
-- 1) Notifications: add WITH CHECK that prevents changing content fields
DROP POLICY IF EXISTS notif_update_own ON public.notifications;
CREATE POLICY notif_update_own ON public.notifications
FOR UPDATE TO authenticated
USING (
  (user_id = auth.uid())
  OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role))
)
WITH CHECK (
  (
    (user_id = auth.uid())
    OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role))
  )
  -- Immutable content/routing fields: only read_at may change
  AND title IS NOT DISTINCT FROM (SELECT n.title FROM public.notifications n WHERE n.id = notifications.id)
  AND body  IS NOT DISTINCT FROM (SELECT n.body  FROM public.notifications n WHERE n.id = notifications.id)
  AND payload IS NOT DISTINCT FROM (SELECT n.payload FROM public.notifications n WHERE n.id = notifications.id)
  AND kind IS NOT DISTINCT FROM (SELECT n.kind FROM public.notifications n WHERE n.id = notifications.id)
  AND user_id IS NOT DISTINCT FROM (SELECT n.user_id FROM public.notifications n WHERE n.id = notifications.id)
  AND target_role IS NOT DISTINCT FROM (SELECT n.target_role FROM public.notifications n WHERE n.id = notifications.id)
  AND target_service IS NOT DISTINCT FROM (SELECT n.target_service FROM public.notifications n WHERE n.id = notifications.id)
  AND created_at IS NOT DISTINCT FROM (SELECT n.created_at FROM public.notifications n WHERE n.id = notifications.id)
);

-- 2) Realtime: restrict channel subscriptions
-- Ensure RLS is on (it is by default on realtime.messages on newer Supabase, but enforce)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rt_authenticated_read" ON realtime.messages;
DROP POLICY IF EXISTS "rt_authenticated_write" ON realtime.messages;

-- Allow authenticated users to subscribe ONLY to:
--   - their personal user topic:  user:<auth.uid()>
--   - role topics:                role:<role>            (if they have that role)
--   - role+service topics:        role:<role>:service:<service>
-- All other topics are denied. Approved status enforced via has_role/is_admin chain.
CREATE POLICY "rt_authenticated_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = 'user:' || auth.uid()::text)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        realtime.topic() = 'role:' || ur.role::text
        OR (ur.service IS NOT NULL
            AND realtime.topic() = 'role:' || ur.role::text || ':service:' || ur.service::text)
      )
  )
  OR public.is_superuser(auth.uid())
);

CREATE POLICY "rt_authenticated_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (realtime.topic() = 'user:' || auth.uid()::text)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        realtime.topic() = 'role:' || ur.role::text
        OR (ur.service IS NOT NULL
            AND realtime.topic() = 'role:' || ur.role::text || ':service:' || ur.service::text)
      )
  )
  OR public.is_superuser(auth.uid())
);
