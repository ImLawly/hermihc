
-- Helper: pediatric staff
CREATE OR REPLACE FUNCTION public.is_pediatric_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superuser(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'admin' OR service = 'pediatria')
  )
$$;

-- Helper: staff with access to mother's obstetric service
CREATE OR REPLACE FUNCTION public.is_obstetric_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superuser(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'admin' OR service = 'obstetricia')
  )
$$;

-- Enum for newborn record status
DO $$ BEGIN
  CREATE TYPE public.newborn_status AS ENUM (
    'en_sala_partos',      -- being filled by nursing pre/post birth
    'cerrado_enfermeria',  -- nursing closed → pediatrics owns it
    'ingresado_neonato',   -- pediatrics admitted to neonatology
    'constancia_historica' -- archived healthy birth record
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.respiratory_effort AS ENUM ('espontaneo','estimulacion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.newborn_sex AS ENUM ('masculino','femenino','indeterminado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.newborn_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mother_admission_id UUID NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  mother_patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,

  -- Pre-birth
  nombres TEXT,
  apellidos TEXT,
  sexo public.newborn_sex,

  -- Post-birth (nursing fills)
  fecha_nacimiento TIMESTAMPTZ,
  peso_gr INTEGER CHECK (peso_gr IS NULL OR (peso_gr > 0 AND peso_gr < 10000)),
  talla_cm NUMERIC(5,2) CHECK (talla_cm IS NULL OR (talla_cm > 0 AND talla_cm < 100)),
  apgar_1 SMALLINT CHECK (apgar_1 IS NULL OR (apgar_1 BETWEEN 0 AND 10)),
  apgar_5 SMALLINT CHECK (apgar_5 IS NULL OR (apgar_5 BETWEEN 0 AND 10)),
  esfuerzo_respiratorio public.respiratory_effort,
  notas_enfermeria TEXT,

  -- Handoff / status
  status public.newborn_status NOT NULL DEFAULT 'en_sala_partos',
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,

  -- Pediatric linkage (after handoff)
  pediatric_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  pediatric_admission_id UUID REFERENCES public.admissions(id) ON DELETE SET NULL,
  pediatric_notes TEXT,

  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_newborn_mother_admission ON public.newborn_records(mother_admission_id);
CREATE INDEX idx_newborn_mother_patient ON public.newborn_records(mother_patient_id);
CREATE INDEX idx_newborn_pediatric_patient ON public.newborn_records(pediatric_patient_id);
CREATE INDEX idx_newborn_status ON public.newborn_records(status);
CREATE INDEX idx_newborn_fecha ON public.newborn_records(fecha_nacimiento DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newborn_records TO authenticated;
GRANT ALL ON public.newborn_records TO service_role;

ALTER TABLE public.newborn_records ENABLE ROW LEVEL SECURITY;

-- SELECT: obstetric staff (mother's service), pediatric staff, admin, superuser
CREATE POLICY "newborn_select" ON public.newborn_records
FOR SELECT TO authenticated
USING (
  public.is_superuser(auth.uid())
  OR public.is_admin(auth.uid())
  OR public.is_pediatric_staff(auth.uid())
  OR public.is_obstetric_staff(auth.uid())
);

-- INSERT: obstetric or pediatric staff (nursing or medical) while record is being initialized
CREATE POLICY "newborn_insert" ON public.newborn_records
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_superuser(auth.uid())
    OR public.is_admin(auth.uid())
    OR public.is_pediatric_staff(auth.uid())
    OR public.is_obstetric_staff(auth.uid())
  )
);

-- UPDATE:
-- Before close (status = 'en_sala_partos'): obstetric OR pediatric staff.
-- After close: pediatric staff, admin, superuser only.
CREATE POLICY "newborn_update" ON public.newborn_records
FOR UPDATE TO authenticated
USING (
  public.is_superuser(auth.uid())
  OR public.is_admin(auth.uid())
  OR (
    status = 'en_sala_partos'
    AND (public.is_obstetric_staff(auth.uid()) OR public.is_pediatric_staff(auth.uid()))
  )
  OR (
    status <> 'en_sala_partos'
    AND public.is_pediatric_staff(auth.uid())
  )
)
WITH CHECK (
  public.is_superuser(auth.uid())
  OR public.is_admin(auth.uid())
  OR (
    status = 'en_sala_partos'
    AND (public.is_obstetric_staff(auth.uid()) OR public.is_pediatric_staff(auth.uid()))
  )
  OR (
    status <> 'en_sala_partos'
    AND public.is_pediatric_staff(auth.uid())
  )
);

-- DELETE: admin/superuser only
CREATE POLICY "newborn_delete" ON public.newborn_records
FOR DELETE TO authenticated
USING (public.is_superuser(auth.uid()) OR public.is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER trg_newborn_updated_at
BEFORE UPDATE ON public.newborn_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit trigger
CREATE TRIGGER trg_newborn_audit
AFTER INSERT OR UPDATE OR DELETE ON public.newborn_records
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
