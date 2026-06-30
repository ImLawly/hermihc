
-- 1) temporary_access_tokens: restrict SELECT to creator or superuser
DROP POLICY IF EXISTS view_own_tokens ON public.temporary_access_tokens;
CREATE POLICY view_own_tokens ON public.temporary_access_tokens
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_superuser(auth.uid()));

-- 2) patient_transfers: require service access to the patient
DROP POLICY IF EXISTS transfers_insert ON public.patient_transfers;
CREATE POLICY transfers_insert ON public.patient_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_medical_staff(auth.uid()) OR public.is_nurse(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = patient_transfers.patient_id
        AND public.has_service_access(auth.uid(), p.service)
    )
  );
