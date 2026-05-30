-- 1) Restrict profiles SELECT to self + admin only (was: anyone with any role could read all profiles)
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
CREATE POLICY profiles_self_select ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin(auth.uid()));

-- 2) Tighten order_administrations to require service access via the parent order/admission
DROP POLICY IF EXISTS admin_insert ON public.order_administrations;
CREATE POLICY admin_insert ON public.order_administrations
FOR INSERT TO authenticated
WITH CHECK (
  (public.is_medical_staff(auth.uid()) OR public.is_nurse(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.medical_orders mo
    JOIN public.admissions a ON a.id = mo.admission_id
    WHERE mo.id = order_administrations.order_id
      AND public.has_service_access(auth.uid(), a.service)
  )
);

DROP POLICY IF EXISTS admin_update_nurse ON public.order_administrations;
CREATE POLICY admin_update_nurse ON public.order_administrations
FOR UPDATE TO authenticated
USING (
  (public.is_nurse(auth.uid()) OR public.is_medical_staff(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.medical_orders mo
    JOIN public.admissions a ON a.id = mo.admission_id
    WHERE mo.id = order_administrations.order_id
      AND public.has_service_access(auth.uid(), a.service)
  )
);
