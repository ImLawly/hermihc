
-- Add WITH CHECK to admissions_medical_update
DROP POLICY IF EXISTS admissions_medical_update ON public.admissions;
CREATE POLICY admissions_medical_update ON public.admissions
  FOR UPDATE
  USING (is_medical_staff(auth.uid()) AND has_service_access(auth.uid(), service))
  WITH CHECK (is_medical_staff(auth.uid()) AND has_service_access(auth.uid(), service));

-- Add WITH CHECK to patients_medical_update
DROP POLICY IF EXISTS patients_medical_update ON public.patients;
CREATE POLICY patients_medical_update ON public.patients
  FOR UPDATE
  USING (is_medical_staff(auth.uid()) AND has_service_access(auth.uid(), service))
  WITH CHECK (is_medical_staff(auth.uid()) AND has_service_access(auth.uid(), service));

-- Tighten temporary_access_tokens INSERT: require service access to the target patient
DROP POLICY IF EXISTS create_tokens_medical ON public.temporary_access_tokens;
CREATE POLICY create_tokens_medical ON public.temporary_access_tokens
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      is_superuser(auth.uid())
      OR (
        is_medical_staff(auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id = temporary_access_tokens.patient_id
            AND has_service_access(auth.uid(), p.service)
        )
      )
    )
  );

-- Explicit fail-closed immutability for delivery_notes and operative_notes
CREATE POLICY del_no_update ON public.delivery_notes
  FOR UPDATE USING (is_superuser(auth.uid())) WITH CHECK (is_superuser(auth.uid()));
CREATE POLICY del_no_delete ON public.delivery_notes
  FOR DELETE USING (is_superuser(auth.uid()));
CREATE POLICY op_no_update ON public.operative_notes
  FOR UPDATE USING (is_superuser(auth.uid())) WITH CHECK (is_superuser(auth.uid()));
CREATE POLICY op_no_delete ON public.operative_notes
  FOR DELETE USING (is_superuser(auth.uid()));
