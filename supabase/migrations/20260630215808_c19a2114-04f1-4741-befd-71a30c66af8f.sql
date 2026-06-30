
-- Fix: chat_participants_self_add_any_conversation
DROP POLICY IF EXISTS "add_participants" ON public.chat_participants;
CREATE POLICY "add_participants" ON public.chat_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superuser(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.chat_participants p
      WHERE p.conversation_id = chat_participants.conversation_id
        AND p.user_id = auth.uid()
    )
  );

-- Fix: notifications_insert_unrestricted_targeting
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superuser(auth.uid())
    OR public.is_admin(auth.uid())
    OR (
      (public.is_medical_staff(auth.uid()) OR public.is_nurse(auth.uid()))
      AND user_id IS NULL
      AND target_role IS NULL
      AND target_service IS NOT NULL
      AND public.has_service_access(auth.uid(), target_service)
    )
  );
