
-- 1. Add discharge fields to interconsultations
ALTER TABLE public.interconsultations
  ADD COLUMN IF NOT EXISTS discharged_at timestamptz,
  ADD COLUMN IF NOT EXISTS discharged_by uuid REFERENCES auth.users(id);

-- 2. Helper: does user have active interconsult access to this admission?
CREATE OR REPLACE FUNCTION public.has_interconsult_access(_user_id uuid, _admission_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.interconsultations ic
    JOIN public.user_roles ur ON ur.user_id = _user_id
    WHERE ic.admission_id = _admission_id
      AND ic.discharged_at IS NULL
      AND ur.service = ic.target_service
  )
$$;

-- 3. Helper: user has interconsult access to any admission of a patient
CREATE OR REPLACE FUNCTION public.has_interconsult_access_patient(_user_id uuid, _patient_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admissions a
    WHERE a.patient_id = _patient_id
      AND public.has_interconsult_access(_user_id, a.id)
  )
$$;

-- 4. Expand SELECT policies to allow interconsult-based read access

-- patients
DROP POLICY IF EXISTS patients_service_read ON public.patients;
CREATE POLICY patients_service_read ON public.patients FOR SELECT
USING (
  has_service_access(auth.uid(), service)
  OR public.has_interconsult_access_patient(auth.uid(), id)
);

-- admissions
DROP POLICY IF EXISTS admissions_service_read ON public.admissions;
CREATE POLICY admissions_service_read ON public.admissions FOR SELECT
USING (
  has_service_access(auth.uid(), service)
  OR public.has_interconsult_access(auth.uid(), id)
);

-- evolutions
DROP POLICY IF EXISTS evolutions_read ON public.evolutions;
CREATE POLICY evolutions_read ON public.evolutions FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = evolutions.admission_id
    AND (has_service_access(auth.uid(), a.service) OR public.has_interconsult_access(auth.uid(), a.id)))
);

-- medical_orders
DROP POLICY IF EXISTS orders_read ON public.medical_orders;
CREATE POLICY orders_read ON public.medical_orders FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = medical_orders.admission_id
    AND (has_service_access(auth.uid(), a.service) OR public.has_interconsult_access(auth.uid(), a.id)))
);

-- monitoring_entries
DROP POLICY IF EXISTS mon_read ON public.monitoring_entries;
CREATE POLICY mon_read ON public.monitoring_entries FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = monitoring_entries.admission_id
    AND (has_service_access(auth.uid(), a.service) OR public.has_interconsult_access(auth.uid(), a.id)))
);

-- lab_results
DROP POLICY IF EXISTS lab_read ON public.lab_results;
CREATE POLICY lab_read ON public.lab_results FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = lab_results.admission_id
    AND (has_service_access(auth.uid(), a.service) OR public.has_interconsult_access(auth.uid(), a.id)))
);

-- clinical_notes
DROP POLICY IF EXISTS notes_read ON public.clinical_notes;
CREATE POLICY notes_read ON public.clinical_notes FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = clinical_notes.admission_id
    AND (has_service_access(auth.uid(), a.service) OR public.has_interconsult_access(auth.uid(), a.id)))
);

-- delivery_notes
DROP POLICY IF EXISTS del_read ON public.delivery_notes;
CREATE POLICY del_read ON public.delivery_notes FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = delivery_notes.admission_id
    AND (has_service_access(auth.uid(), a.service) OR public.has_interconsult_access(auth.uid(), a.id)))
);

-- operative_notes
DROP POLICY IF EXISTS op_read ON public.operative_notes;
CREATE POLICY op_read ON public.operative_notes FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = operative_notes.admission_id
    AND (has_service_access(auth.uid(), a.service) OR public.has_interconsult_access(auth.uid(), a.id)))
);

-- 5. Trigger: auto-create a medical order row for each new interconsultation
CREATE OR REPLACE FUNCTION public.create_order_for_interconsult()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_text text;
BEGIN
  v_text := 'Interconsulta a ' || NEW.target_service::text ||
            CASE WHEN NEW.comentario IS NOT NULL AND length(NEW.comentario) > 0
                 THEN ' — ' || NEW.comentario ELSE '' END;
  INSERT INTO public.medical_orders (admission_id, order_at, items, record_status, created_by, reviewed_by, reviewed_at)
  VALUES (
    NEW.admission_id,
    now(),
    jsonb_build_array(jsonb_build_object('n', 1, 'text', v_text, 'interconsult_id', NEW.id)),
    'confirmado',
    NEW.created_by,
    NEW.created_by,
    now()
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_interconsult_creates_order ON public.interconsultations;
CREATE TRIGGER trg_interconsult_creates_order
AFTER INSERT ON public.interconsultations
FOR EACH ROW EXECUTE FUNCTION public.create_order_for_interconsult();
