
-- Revoke anon execute on security definer functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_service_access(uuid, public.service_type) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_review_records(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_medical_staff(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_nurse(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_patient_location_change() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_service_access(uuid, public.service_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review_records(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_medical_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_nurse(uuid) TO authenticated;

-- Fix set_updated_at search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Tighten notifications insert (only staff)
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) OR public.is_nurse(auth.uid()) OR public.is_admin(auth.uid()));
