
-- Record locks: bloqueo concurrente cuando R2/R3 abre una historia para revisar
CREATE TABLE public.record_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL,        -- 'evolution' | 'medical_order' | 'clinical_note'
  record_id uuid NOT NULL,
  locked_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  UNIQUE (record_type, record_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_locks TO authenticated;
GRANT ALL ON public.record_locks TO service_role;

ALTER TABLE public.record_locks ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario médico autenticado puede leer locks (necesario para detectar bloqueo del propio R1)
CREATE POLICY "locks_read" ON public.record_locks FOR SELECT TO authenticated
  USING (public.is_medical_staff(auth.uid()));

-- Solo R2/R3/especialistas/admin pueden crear un lock (acto de revisar)
CREATE POLICY "locks_insert_reviewers" ON public.record_locks FOR INSERT TO authenticated
  WITH CHECK (
    public.can_review_records(auth.uid())
    AND locked_by = auth.uid()
  );

-- Solo el dueño del lock (o superuser) puede actualizar (heartbeat) o liberar
CREATE POLICY "locks_update_own" ON public.record_locks FOR UPDATE TO authenticated
  USING (locked_by = auth.uid() OR public.is_superuser(auth.uid()))
  WITH CHECK (locked_by = auth.uid() OR public.is_superuser(auth.uid()));

CREATE POLICY "locks_delete_own" ON public.record_locks FOR DELETE TO authenticated
  USING (locked_by = auth.uid() OR public.is_superuser(auth.uid()));

-- Limpieza automática de locks expirados al leer
CREATE OR REPLACE FUNCTION public.cleanup_expired_locks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.record_locks WHERE expires_at < now();
$$;

-- ============================================================
-- INMUTABILIDAD: una vez confirmado, solo el superuser puede editar
-- ============================================================
DROP POLICY IF EXISTS "evolutions_update" ON public.evolutions;
CREATE POLICY "evolutions_update" ON public.evolutions FOR UPDATE TO authenticated
  USING (
    public.is_superuser(auth.uid())
    OR (
      is_medical_staff(auth.uid())
      AND EXISTS (SELECT 1 FROM admissions a WHERE a.id = evolutions.admission_id AND has_service_access(auth.uid(), a.service))
      AND (
        -- Borrador: solo el autor puede editar mientras nadie esté revisando
        (record_status = 'pendiente_revision'
          AND created_by = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.record_locks l
            WHERE l.record_type = 'evolution' AND l.record_id = evolutions.id
              AND l.expires_at > now()
              AND l.locked_by <> auth.uid()
          )
        )
        -- Revisor con lock activo puede confirmar
        OR (record_status = 'pendiente_revision'
            AND public.can_review_records(auth.uid())
            AND EXISTS (
              SELECT 1 FROM public.record_locks l
              WHERE l.record_type = 'evolution' AND l.record_id = evolutions.id
                AND l.locked_by = auth.uid() AND l.expires_at > now()
            )
        )
        -- Revisor sin lock también puede confirmar directamente (R2/R3 que crea su propia historia)
        OR (record_status = 'pendiente_revision' AND public.can_review_records(auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "orders_update" ON public.medical_orders;
CREATE POLICY "orders_update" ON public.medical_orders FOR UPDATE TO authenticated
  USING (
    public.is_superuser(auth.uid())
    OR (
      is_medical_staff(auth.uid())
      AND EXISTS (SELECT 1 FROM admissions a WHERE a.id = medical_orders.admission_id AND has_service_access(auth.uid(), a.service))
      AND (
        (record_status = 'pendiente_revision'
          AND created_by = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.record_locks l
            WHERE l.record_type = 'medical_order' AND l.record_id = medical_orders.id
              AND l.expires_at > now()
              AND l.locked_by <> auth.uid()
          )
        )
        OR (record_status = 'pendiente_revision' AND public.can_review_records(auth.uid()))
      )
    )
  );
