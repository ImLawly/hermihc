DROP POLICY IF EXISTS "orders_update" ON public.medical_orders;

CREATE POLICY "orders_update" ON public.medical_orders
FOR UPDATE TO authenticated
USING (
  public.is_superuser(auth.uid())
  OR (
    public.is_medical_staff(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.admissions a
      WHERE a.id = medical_orders.admission_id
        AND public.has_service_access(auth.uid(), a.service)
    )
    AND (
      (
        medical_orders.record_status = 'pendiente_revision'::public.record_status
        AND medical_orders.created_by = auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.record_locks l
          WHERE l.record_type = 'medical_order'
            AND l.record_id = medical_orders.id
            AND l.expires_at > now()
            AND l.locked_by <> auth.uid()
        )
      )
      OR (
        medical_orders.record_status = 'pendiente_revision'::public.record_status
        AND public.can_review_records(auth.uid())
      )
    )
  )
)
WITH CHECK (
  public.is_superuser(auth.uid())
  OR (
    public.is_medical_staff(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.admissions a
      WHERE a.id = medical_orders.admission_id
        AND public.has_service_access(auth.uid(), a.service)
    )
    AND (
      (
        medical_orders.created_by = auth.uid()
        AND medical_orders.record_status = 'pendiente_revision'::public.record_status
        AND medical_orders.reviewed_by IS NULL
        AND medical_orders.reviewed_at IS NULL
      )
      OR (
        public.can_review_records(auth.uid())
        AND medical_orders.record_status = 'confirmado'::public.record_status
        AND medical_orders.reviewed_by = auth.uid()
        AND medical_orders.reviewed_at IS NOT NULL
      )
    )
  )
);