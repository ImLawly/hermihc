
DROP POLICY IF EXISTS "rt_authenticated_read" ON realtime.messages;
CREATE POLICY "rt_authenticated_read" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() = ('user:' || auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND (
          realtime.topic() = ('role:' || ur.role::text)
          OR (ur.service IS NOT NULL AND realtime.topic() = ('role:' || ur.role::text || ':service:' || ur.service::text))
        )
    )
    OR public.is_superuser(auth.uid())
    -- chat list channel (just used to invalidate the sidebar; messages stay RLS-protected)
    OR realtime.topic() = 'chat-list'
    -- per-conversation topic: only participants can subscribe
    OR (
      realtime.topic() LIKE 'chat-%'
      AND EXISTS (
        SELECT 1 FROM public.chat_participants p
        WHERE p.user_id = auth.uid()
          AND p.conversation_id::text = substring(realtime.topic() from 6)
      )
    )
  );
