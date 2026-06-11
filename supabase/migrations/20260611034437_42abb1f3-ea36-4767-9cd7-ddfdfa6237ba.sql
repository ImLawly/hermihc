
-- Chat interno vigilado
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_group boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_conv_time ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
GRANT ALL ON public.chat_participants TO service_role;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper: is participant
CREATE OR REPLACE FUNCTION public.is_chat_participant(_user_id uuid, _conv_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = _conv_id AND user_id = _user_id)
$$;

-- Policies: conversations
CREATE POLICY "view_conversations" ON public.chat_conversations FOR SELECT TO authenticated
  USING (public.is_superuser(auth.uid()) OR public.is_chat_participant(auth.uid(), id) OR created_by = auth.uid());
CREATE POLICY "create_conversations" ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "update_own_conversations" ON public.chat_conversations FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_superuser(auth.uid()));
CREATE POLICY "delete_conversations_super" ON public.chat_conversations FOR DELETE TO authenticated
  USING (public.is_superuser(auth.uid()) OR created_by = auth.uid());

-- Policies: participants
CREATE POLICY "view_participants" ON public.chat_participants FOR SELECT TO authenticated
  USING (public.is_superuser(auth.uid()) OR user_id = auth.uid() OR public.is_chat_participant(auth.uid(), conversation_id));
CREATE POLICY "add_participants" ON public.chat_participants FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superuser(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );
CREATE POLICY "delete_participants" ON public.chat_participants FOR DELETE TO authenticated
  USING (
    public.is_superuser(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );

-- Policies: messages
CREATE POLICY "view_messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_superuser(auth.uid()) OR public.is_chat_participant(auth.uid(), conversation_id));
CREATE POLICY "send_messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_chat_participant(auth.uid(), conversation_id));
CREATE POLICY "delete_messages_super" ON public.chat_messages FOR DELETE TO authenticated
  USING (public.is_superuser(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Links temporales de acceso a historia clínica
CREATE TABLE public.temporary_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  admission_id uuid REFERENCES public.admissions(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz,
  note text
);

CREATE INDEX idx_temp_tokens_token ON public.temporary_access_tokens(token);
CREATE INDEX idx_temp_tokens_patient ON public.temporary_access_tokens(patient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.temporary_access_tokens TO authenticated;
GRANT ALL ON public.temporary_access_tokens TO service_role;

ALTER TABLE public.temporary_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_own_tokens" ON public.temporary_access_tokens FOR SELECT TO authenticated
  USING (public.is_superuser(auth.uid()) OR created_by = auth.uid() OR public.is_medical_staff(auth.uid()));
CREATE POLICY "create_tokens_medical" ON public.temporary_access_tokens FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.is_medical_staff(auth.uid()) OR public.is_superuser(auth.uid())));
CREATE POLICY "revoke_tokens" ON public.temporary_access_tokens FOR UPDATE TO authenticated
  USING (public.is_superuser(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "delete_tokens_super" ON public.temporary_access_tokens FOR DELETE TO authenticated
  USING (public.is_superuser(auth.uid()) OR created_by = auth.uid());
